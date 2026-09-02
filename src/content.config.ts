import { defineCollection, z } from "astro:content"
import { glob } from "astro/loaders"

/**
 * Experiment write-ups.
 *
 * The documents live beside the code they describe rather than in a separate
 * content tree, so an experiment folder holds its implementation, its
 * human-facing note and its notes for agents together. Only the index consumes
 * this collection; each experiment renders its own page, since the experiments
 * are not yet meant to share a look.
 */
const experiments = defineCollection({
  loader: glob({ base: "./src/experiments", pattern: "*/about.md" }),
  schema: ({ image }) =>
    z.object({
      /** Stated rather than derived from the file id, which the loader owns. */
      slug: z.string(),
      title: z.string(),
      summary: z.string(),
      started: z.date(),
      updated: z.date(),
      tags: z.array(z.string()).default([]),
      /**
       * The still shown on the index, captured by `pnpm run posters` and living
       * beside the piece it is of.
       *
       * Optional: a piece is allowed to exist before anyone has decided what it
       * looks like in a single frame, and the index falls back to a text-only
       * entry. `image()` resolves it relative to this `about.md` and fails the
       * build if the file is missing, so the only way to be wrong is to be
       * absent — not to be broken.
       */
      poster: image().optional(),
    }),
})

export const collections = { experiments }
