/**
 * `window.experiment`, the console handle every piece exposes.
 *
 * Declared once for the section rather than by each experiment, because there is
 * only one global namespace: two experiments each declaring `Window.experiment`
 * as its own API type is a compile error, however separate they otherwise are.
 *
 * The type is `unknown` on purpose. Widening it to a union of every experiment's
 * API would make the pieces depend on one another, which is the half of
 * ADR-0002 that survives verbatim in
 * `docs/adr/20260828-the-piece-is-independent-the-gallery-is-not.md`: a piece
 * owns its rendering, and nothing shared reaches inside it. Each experiment
 * exports its own `ExperimentApi` and holds a properly typed reference to it;
 * this declaration only reserves the name.
 *
 * Naming a shared concept binds no implementation, which is why the section has
 * a glossary and a kit and still no shared API type. The kit takes a piece's
 * settings as a type parameter for the same reason — it never names one.
 */
declare global {
  interface Window {
    experiment?: unknown
  }
}

export {}
