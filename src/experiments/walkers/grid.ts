/**
 * A uniform grid over the ground, so avoidance does not cost n².
 *
 * Everyone in the crowd asks the same question every frame — who is near me —
 * and the honest answer at thirty people is "just check them all". This exists
 * for the top of the density slider, where a wide window at 40 people per 100 m²
 * is a few hundred walkers and the pair count starts to bite.
 *
 * Deliberately plain. The cell is sized to the interaction radius, so a query
 * touches nine cells and no more; buckets are plain arrays rebuilt each frame,
 * because the population changes every frame anyway and an incremental structure
 * would have to be kept honest against spawning, despawning and teleporting for
 * no measurable gain at these counts.
 */

export type Grid = {
  cell: number
  cols: number
  rows: number
  minX: number
  minY: number
  buckets: number[][]
}

export function createGrid(minX: number, minY: number, maxX: number, maxY: number, cell: number): Grid {
  const size = Math.max(0.5, cell)
  const cols = Math.max(1, Math.ceil((maxX - minX) / size))
  const rows = Math.max(1, Math.ceil((maxY - minY) / size))
  const buckets: number[][] = new Array(cols * rows)
  for (let i = 0; i < buckets.length; i++) buckets[i] = []
  return { cell: size, cols, rows, minX, minY, buckets }
}

const columnOf = (grid: Grid, x: number) =>
  Math.min(grid.cols - 1, Math.max(0, Math.floor((x - grid.minX) / grid.cell)))
const rowOf = (grid: Grid, y: number) => Math.min(grid.rows - 1, Math.max(0, Math.floor((y - grid.minY) / grid.cell)))

export function clearGrid(grid: Grid): void {
  for (const bucket of grid.buckets) bucket.length = 0
}

export function insert(grid: Grid, index: number, x: number, y: number): void {
  grid.buckets[rowOf(grid, y) * grid.cols + columnOf(grid, x)]!.push(index)
}

/**
 * Every index within `radius` of (x, y), give or take a cell.
 *
 * Approximate on purpose: the caller is applying a force that falls off with
 * distance and already tests the real separation, so paying for an exact
 * circular query here would be work done twice.
 */
export function forNear(grid: Grid, x: number, y: number, radius: number, visit: (index: number) => void): void {
  const reach = Math.ceil(radius / grid.cell)
  const column = columnOf(grid, x)
  const row = rowOf(grid, y)

  const fromColumn = Math.max(0, column - reach)
  const toColumn = Math.min(grid.cols - 1, column + reach)
  const fromRow = Math.max(0, row - reach)
  const toRow = Math.min(grid.rows - 1, row + reach)

  for (let r = fromRow; r <= toRow; r++) {
    for (let c = fromColumn; c <= toColumn; c++) {
      for (const index of grid.buckets[r * grid.cols + c]!) visit(index)
    }
  }
}
