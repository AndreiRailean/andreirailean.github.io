import { describe, expect, it } from "vitest"
import { SvgContext } from "@/experiments/artdeco/svg"

/** The `d` of each path written, in order. */
function paths(svg: SvgContext): string[] {
  return [...svg.toString().matchAll(/<path d="([^"]*)"/g)].map((m) => m[1]!)
}

describe("SvgContext", () => {
  it("writes an arc from the bottom, either way round, as the canvas sweeps it", () => {
    // ring() draws each side of a circle up from its lowest point (angle pi/2).
    const svg = new SvgContext(100, 100)
    svg.beginPath()
    svg.moveTo(50, 60)
    svg.arc(50, 50, 10, Math.PI / 2, Math.PI / 2 - Math.PI / 2, true)
    svg.moveTo(50, 60)
    svg.arc(50, 50, 10, Math.PI / 2, Math.PI / 2 + Math.PI / 2)
    svg.stroke()
    // Anticlockwise on screen to the right-hand point, clockwise to the left: sweep 0, then 1.
    expect(paths(svg)).toEqual(["M50 60A10 10 0 0 0 60 50M50 60A10 10 0 0 1 40 50"])
  })

  it("writes a whole turn as two halves, since an SVG arc cannot end where it starts", () => {
    const svg = new SvgContext(100, 100)
    svg.beginPath()
    svg.moveTo(60, 50)
    svg.arc(50, 50, 10, 0, 2 * Math.PI)
    svg.fill()
    expect(paths(svg)).toEqual(["M60 50A10 10 0 0 1 40 50A10 10 0 0 1 60 50"])
  })

  it("joins the current point to an arc's start, as the canvas does", () => {
    const svg = new SvgContext(100, 100)
    svg.beginPath()
    svg.moveTo(0, 0)
    svg.arc(50, 50, 10, 0, Math.PI / 2)
    svg.stroke()
    expect(paths(svg)[0]).toMatch(/^M0 0L60 50A/)
  })

  it("closes a clip's group at the matching restore", () => {
    const svg = new SvgContext(100, 100)
    svg.save()
    svg.beginPath()
    svg.rect(0, 0, 100, 100)
    svg.clip("evenodd")
    svg.beginPath()
    svg.moveTo(1, 1)
    svg.lineTo(9, 9)
    svg.stroke()
    svg.restore()
    const out = svg.toString()
    expect(out).toContain('<clipPath id="clip0"><path d="M0 0H100V100H0Z" clip-rule="evenodd"/></clipPath>')
    expect(out.indexOf("</g>")).toBeGreaterThan(out.indexOf("M1 1L9 9"))
    expect(out.match(/<g /g)).toHaveLength(1)
    expect(out.match(/<\/g>/g)).toHaveLength(1)
  })

  it("refuses what it cannot write rather than writing something else", () => {
    const svg = new SvgContext(100, 100)
    svg.beginPath()
    svg.moveTo(50, 50)
    svg.arc(50, 50, 5, 0, 2 * Math.PI)
    svg.globalCompositeOperation = "destination-out"
    expect(() => svg.fill()).toThrow(/destination-out/)
    expect(() => svg.setTransform(2, 0, 0, 2, 10, 0)).toThrow(/scale/)
    expect(() => svg.clearRect(10, 10, 20, 20)).toThrow(/whole/)
    // The device-pixel scale draw() sets is the one transform it accepts.
    expect(() => svg.setTransform(2, 0, 0, 2, 0, 0)).not.toThrow()
  })
})
