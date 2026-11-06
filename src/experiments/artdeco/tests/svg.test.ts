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
    // Drawn after the restore, as draw() draws the frame's outline: outside the clip.
    svg.beginPath()
    svg.moveTo(2, 2)
    svg.lineTo(8, 8)
    svg.stroke()
    const out = svg.toString()
    expect(out).toContain('<clipPath id="clip0"><path d="M0 0H100V100H0Z" clip-rule="evenodd"/></clipPath>')
    const close = out.indexOf("</g>")
    expect(close).toBeGreaterThan(out.indexOf("M1 1L9 9"))
    expect(close).toBeLessThan(out.indexOf("M2 2L8 8"))
    expect(out.match(/<g /g)).toHaveLength(1)
    expect(out.match(/<\/g>/g)).toHaveLength(1)
  })

  it("writes the canvas's mitre limit, not SVG's", () => {
    const svg = new SvgContext(10, 10)
    svg.beginPath()
    svg.moveTo(0, 0)
    svg.lineTo(5, 5)
    svg.stroke()
    expect(svg.toString()).toContain('stroke-miterlimit="10"')
  })

  it("turns the printed page to the drawing's orientation", () => {
    expect(new SvgContext(300, 200).toString()).toContain("@page { size: landscape;")
    expect(new SvgContext(200, 300).toString()).toContain("@page { size: portrait;")
  })

  it("says what made it, escaped, in each place a reader looks", () => {
    const out = new SvgContext(10, 10).toString({
      generator: "www.andrei.md",
      title: "Art Deco, seed 7",
      description: "a <scene> & -- more",
      source: "https://www.andrei.md/experiments/artdeco/?s=a&b=1",
      date: "2026-11-06T00:00:00.000Z",
    })
    expect(out.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<!-- Generator: www.andrei.md -->\n<svg ')).toBe(
      true,
    )
    expect(out).toContain("<title>Art Deco, seed 7</title>")
    expect(out).toContain("<desc>a &lt;scene&gt; &amp; -- more</desc>")
    expect(out).toContain("<dc:source>https://www.andrei.md/experiments/artdeco/?s=a&amp;b=1</dc:source>")
    expect(out).toContain("<dc:creator><cc:Agent><dc:title>www.andrei.md</dc:title></cc:Agent></dc:creator>")
    expect(out).toContain("<dc:date>2026-11-06T00:00:00.000Z</dc:date>")
  })

  it("keeps a comment free of the double dash that would end it", () => {
    const out = new SvgContext(10, 10).toString({
      generator: "a--b",
      title: "",
      description: "",
      source: "",
      date: "",
    })
    expect(out).toContain("<!-- Generator: a-b -->")
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
