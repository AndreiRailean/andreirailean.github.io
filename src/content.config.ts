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
  schema: z.object({
    /** Stated rather than derived from the file id, which the loader owns. */
    slug: z.string(),
    title: z.string(),
    summary: z.string(),
    started: z.date(),
    updated: z.date(),
    tags: z.array(z.string()).default([]),
  }),
})

export const collections = { experiments }
