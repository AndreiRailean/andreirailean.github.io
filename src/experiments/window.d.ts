/**
 * `window.experiment`, the console handle every piece exposes.
 *
 * Declared once for the section rather than by each experiment, because there is
 * only one global namespace: two experiments each declaring `Window.experiment`
 * as its own API type is a compile error, however separate they otherwise are.
 *
 * The type is `unknown` on purpose. Widening it to a union of every experiment's
 * API would make the pieces depend on one another, which is exactly what
 * `docs/adr/0002-experiments-are-not-generalised.md` rules out. Each experiment
 * exports its own `ExperimentApi` and holds a properly typed reference to it;
 * this declaration only reserves the name.
 *
 * Naming a shared concept binds no implementation, which is the same exception
 * ADR-0002 already makes for the section's vocabulary.
 */
declare global {
  interface Window {
    experiment?: unknown
  }
}

export {}
