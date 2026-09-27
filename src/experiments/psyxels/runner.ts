/**
 * The piece as a runner: one mountable scene, and nothing else.
 *
 * See `../starry-night/runner.ts` for what a runner is and why the decoding
 * happens here rather than in whatever loads it.
 *
 * ## The portrait, and what this runner cannot do
 *
 * `createPsyxels` takes an optional `avatar` image, and the `avatar` subject is
 * the one thing in this piece that needs a file rather than a number. This
 * runner does not pass one, so a scene set to `subject: "avatar"` mounts and
 * runs with a blank subject — a field with no psyxels in it.
 *
 * **That constrains what may be published, not what may be built.** Every other
 * subject — the letters, the ampersand, `Alive`, `Luna` — is drawn from glyphs
 * this bundle already contains, and those scenes are complete and frozen in the
 * ordinary way.
 *
 * Fixing it properly means deciding how a frozen runner carries an asset, and
 * that is a real question rather than an oversight. A runner is named by the
 * hash of its own bytes, and a scene pins that name; an image fetched beside it
 * is not covered by that hash, so the pair could drift apart while the address
 * claimed otherwise. Inlining the portrait as a data URI would fold it into the
 * hash and keep the guarantee.
 *
 * **That question has since been withdrawn rather than answered, and this stays
 * as it is.** A runner will not carry or fetch the piece's image, because a
 * piece owning a file is the anomaly: `subject` conflates which *shape* to draw,
 * which packs into an address, with which *external resource* to read, which
 * does not. The image becomes an input the embedder supplies and the avatar
 * subject leaves this piece — see
 * `../docs/adr/20260912-the-image-is-an-input-not-a-subject.md`. So do not build
 * an asset channel here; the scene that needs one is still not published, and
 * now that is the intended end state rather than a deferral.
 *
 * One correction while that was measured: "roughly triple this bundle" above was
 * an estimate and is high. Inlining the built webp would take 39.2kb to 47.7kb,
 * about **1.2x** — the jpeg the page loads today would be 1.9x. The decision
 * does not rest on the number, but the number should not sit here wrong.
 *
 * A piece opts in by having this file. Nothing looks for one that does not.
 */

import { decodeScene } from "@/experiments/address"
import { createPsyxels } from "@/experiments/psyxels/psyxels"
import { normalizeSettings, REGISTRY, type Settings } from "@/experiments/psyxels/settings"
import type { Live, PieceApi, Rerollable } from "@/experiments/piece"

/** The whole contract between a runner and whatever hosts it. */
export type Mounted = {
  setScene: (scene: string) => void
  setPaused: (paused: boolean) => void
  stats: () => unknown
  destroy: () => void
}

/**
 * What a host may ask of any runner. Empty, matching Starry Night's.
 *
 * The portrait is the obvious candidate for the first real option, and is
 * deliberately not one yet — see the note above. A frozen runner cannot grow a
 * parameter later, so adding one is a republish rather than an edit.
 */
export type MountOptions = Record<string, never>

/** Normalisation happens behind the freeze, so a published scene survives this piece's later defaults. */
function read(scene: string): Settings {
  const decoded = decodeScene(REGISTRY, scene)
  if (!decoded) throw new Error(`psyxels: unreadable scene ${JSON.stringify(scene.slice(0, 24))}`)
  return normalizeSettings(decoded as Partial<Settings>)
}

/**
 * The portrait, when the page supplies one on the canvas as `data-avatar`.
 *
 * Started now and handed over undecoded: the engine rebuilds when it arrives,
 * so the letter scenes never wait for a face they do not show. A showcase host
 * puts no `data-avatar` on its canvas, so a frozen runner is handed no portrait,
 * exactly as before — see the note at the top.
 */
function avatarFor(canvas: HTMLCanvasElement): { avatar?: HTMLImageElement } {
  const source = canvas.dataset.avatar
  if (!source) return {}
  const avatar = new Image()
  avatar.src = source
  return { avatar }
}

/**
 * The piece live: what the gallery's page drives, and what `mount` below is
 * written in terms of, so there is one way a point becomes pixels.
 *
 * The verbs are the piece's own, and reach the console and the bar through
 * `gallery/boot.ts`. See
 * `../docs/adr/20260928-a-piece-is-a-library-behind-three-files.md`.
 */
export function start(canvas: HTMLCanvasElement, settings: Settings) {
  const field = createPsyxels(canvas, settings, avatarFor(canvas))
  field.start()

  return {
    setSettings: field.setSettings,
    setPaused: field.setPaused,
    stats: field.stats,
    destroy: field.stop,
    verbs: {
      run: (seconds: number) => field.run(seconds),
      debug: (on: boolean) => field.setDebug(on),
    },
  } satisfies Live<Settings>
}

/** `window.experiment` on this piece's page, derived rather than written out. */
export type ExperimentApi = PieceApi<
  Settings,
  ReturnType<typeof start>["verbs"],
  ReturnType<ReturnType<typeof start>["stats"]>
> &
  Rerollable

export function mount(canvas: HTMLCanvasElement, scene: string, _options: MountOptions = {}): Mounted {
  const live = start(canvas, read(scene))

  return {
    setScene: (next) => live.setSettings(read(next)),
    setPaused: live.setPaused,
    stats: live.stats,

    /**
     * `stop()` is a complete teardown here — the most thorough of any piece.
     *
     * It disconnects the ResizeObserver and removes both the resize and the
     * avatar-load listeners, so unlike flotsam and dangler this leaves nothing
     * behind when a host mounts and unmounts repeatedly.
     */
    destroy: live.destroy,
  }
}
