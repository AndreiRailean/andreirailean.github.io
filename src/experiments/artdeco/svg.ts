/**
 * A stand-in for a canvas's 2D context that writes SVG instead of pixels.
 *
 * `draw()` in `artdeco.ts` is handed one of these in place of the canvas's
 * context and runs unchanged, so the file holds exactly the lines, arcs and
 * discs the screen shows, as vectors. It implements only the calls `draw()`
 * makes, and refuses anything it cannot write faithfully rather than drawing
 * something else: a `destination-out` cutout, a transform that is more than a
 * uniform scale, a clear of less than the whole frame. A method it does not
 * have at all throws as a missing function, which is the same refusal.
 *
 * Coordinates are written in css px, before the device-pixel scale, so the
 * file's size is the frame's and it does not depend on the screen it was
 * saved from.
 */

type State = {
  fillStyle: string
  strokeStyle: string
  lineWidth: number
  lineCap: CanvasLineCap
  lineJoin: CanvasLineJoin
  globalCompositeOperation: GlobalCompositeOperation
  dash: number[]
  /** `<g>` elements opened by `clip` since the matching `save`. */
  groups: number
}

const TAU = 2 * Math.PI

/** Two decimals is a hundredth of a css px: far below anything a printer resolves. */
function n(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`svg: not a coordinate: ${value}`)
  return String(Math.round(value * 100) / 100)
}

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;")
}

export class SvgContext {
  fillStyle = "#000"
  strokeStyle = "#000"
  lineWidth = 1
  lineCap: CanvasLineCap = "butt"
  lineJoin: CanvasLineJoin = "miter"
  globalCompositeOperation: GlobalCompositeOperation = "source-over"
  private dash: number[] = []
  private groups = 0
  private stack: State[] = []
  private path: string[] = []
  /** The current point, or null when the path has none. */
  private at: [number, number] | null = null
  private start: [number, number] | null = null
  private clips: string[] = []
  private body: string[] = []

  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
    if (a !== d || b !== 0 || c !== 0 || e !== 0 || f !== 0)
      throw new Error("svg: only a uniform device-pixel scale can be written")
  }

  setLineDash(segments: number[]) {
    this.dash = [...segments]
  }

  save() {
    this.stack.push({
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      lineCap: this.lineCap,
      lineJoin: this.lineJoin,
      globalCompositeOperation: this.globalCompositeOperation,
      dash: this.dash,
      groups: this.groups,
    })
    this.groups = 0
  }

  restore() {
    const state = this.stack.pop()
    if (!state) return
    for (; this.groups > 0; this.groups--) this.body.push("</g>")
    ;({
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      lineCap: this.lineCap,
      lineJoin: this.lineJoin,
      globalCompositeOperation: this.globalCompositeOperation,
      dash: this.dash,
      groups: this.groups,
    } = state)
  }

  clearRect(x: number, y: number, w: number, h: number) {
    // An SVG starts empty, so clearing all of it writes nothing; clearing part
    // of what is already drawn has no SVG equivalent short of a mask.
    if (x > 0 || y > 0 || x + w < this.width || y + h < this.height || this.body.length > 0)
      throw new Error("svg: only a clear of the whole empty frame can be written")
  }

  fillRect(x: number, y: number, w: number, h: number) {
    this.paint()
    this.body.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${escape(this.fillStyle)}"/>`)
  }

  beginPath() {
    this.path = []
    this.at = null
    this.start = null
  }

  moveTo(x: number, y: number) {
    this.path.push(`M${n(x)} ${n(y)}`)
    this.at = [x, y]
    this.start = [x, y]
  }

  lineTo(x: number, y: number) {
    if (!this.at) return this.moveTo(x, y)
    this.path.push(`L${n(x)} ${n(y)}`)
    this.at = [x, y]
  }

  closePath() {
    if (!this.at) return
    this.path.push("Z")
    this.at = this.start
  }

  rect(x: number, y: number, w: number, h: number) {
    this.moveTo(x, y)
    this.path.push(`H${n(x + w)}V${n(y + h)}H${n(x)}Z`)
  }

  /** As the canvas does it: a line from the current point to the arc's start, then the arc. */
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw = false) {
    let sweep = ccw ? a0 - a1 : a1 - a0
    sweep = sweep >= TAU ? TAU : ((sweep % TAU) + TAU) % TAU
    if (ccw) sweep = -sweep
    const sx = x + r * Math.cos(a0)
    const sy = y + r * Math.sin(a0)
    if (!this.at) this.moveTo(sx, sy)
    else if (Math.hypot(this.at[0] - sx, this.at[1] - sy) > 1e-6) this.lineTo(sx, sy)
    // An SVG arc cannot end where it starts, so a whole turn goes in two halves.
    const pieces = Math.abs(sweep) >= TAU ? 2 : 1
    let a = a0
    for (let k = 0; k < pieces; k++) {
      const step = sweep / pieces
      a += step
      const large = Math.abs(step) > Math.PI ? 1 : 0
      const clockwise = step > 0 ? 1 : 0
      const ex = x + r * Math.cos(a)
      const ey = y + r * Math.sin(a)
      this.path.push(`A${n(r)} ${n(r)} 0 ${large} ${clockwise} ${n(ex)} ${n(ey)}`)
      this.at = [ex, ey]
    }
  }

  stroke() {
    if (this.path.length === 0) return
    this.paint()
    const dash = this.dash.length ? ` stroke-dasharray="${this.dash.map(n).join(" ")}"` : ""
    this.body.push(
      `<path d="${this.path.join("")}" fill="none" stroke="${escape(this.strokeStyle)}" stroke-width="${n(this.lineWidth)}"` +
        ` stroke-linecap="${this.lineCap}" stroke-linejoin="${this.lineJoin}"${dash}/>`,
    )
  }

  fill(rule: CanvasFillRule = "nonzero") {
    if (this.path.length === 0) return
    this.paint()
    this.body.push(`<path d="${this.path.join("")}" fill="${escape(this.fillStyle)}" fill-rule="${rule}"/>`)
  }

  clip(rule: CanvasFillRule = "nonzero") {
    const id = `clip${this.clips.length}`
    this.clips.push(`<clipPath id="${id}"><path d="${this.path.join("")}" clip-rule="${rule}"/></clipPath>`)
    this.body.push(`<g clip-path="url(#${id})">`)
    this.groups++
  }

  /** Everything drawn so far as one SVG document, with any clip still open closed. */
  toString(): string {
    const open = this.groups + this.stack.reduce((sum, state) => sum + state.groups, 0)
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${n(this.width)}" height="${n(this.height)}" viewBox="0 0 ${n(this.width)} ${n(this.height)}">`,
      this.clips.length ? `<defs>${this.clips.join("")}</defs>` : "",
      ...this.body,
      "</g>".repeat(open),
      "</svg>",
      "",
    ]
      .filter(Boolean)
      .join("\n")
  }

  /** Compositing other than painting over has no faithful SVG form here. */
  private paint() {
    if (this.globalCompositeOperation !== "source-over")
      throw new Error(`svg: cannot write ${this.globalCompositeOperation}`)
  }
}

/** Hands the browser a file to save, as a download. */
export function saveFile(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  // The click starts the download synchronously; the url is only needed until then.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
