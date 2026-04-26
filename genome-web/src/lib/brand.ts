/**
 * BRAND TOKENS — single source of truth for the public name + tagline.
 * A public rename is one config change. The CSS variables for color and
 * typography live in src/app/brand.css.
 */

export const BRAND = {
  // Code name; replace this string when shipping publicly.
  name: process.env.NEXT_PUBLIC_GENOME_NAME ?? "Genome",
  tagline: process.env.NEXT_PUBLIC_GENOME_TAGLINE ?? "Self-hosted music discovery",
  authorOf: "Tyler",
  domain: process.env.NEXT_PUBLIC_GENOME_DOMAIN ?? "genome.tyflix.net",
  description:
    "Pick an artist or song. Get a station. Thumb up to refine. Add to your library when you fall in love.",
} as const;

export type Brand = typeof BRAND;
