/**
 * Seed platform catalog (GDD §4, §8). Static facts only — lifecycle stage and
 * evolving install base belong to the Market simulation.
 */

import type { Platform, PlatformInfo } from "../types";

export const PLATFORM_CATALOG: Record<Platform, PlatformInfo> = {
  pc: {
    id: "pc",
    name: "Personal Computer",
    audience: "hardcore",
    installBase: 4_000_000,
    // Hardcore, long-session genres fit PC (GDD §4).
    genreFit: { strategy: 1.1, simulation: 1.1, rpg: 1.05 },
  },
  "home-console": {
    id: "home-console",
    name: "Home Console",
    audience: "broad",
    installBase: 9_000_000,
    genreFit: { shooter: 1.1, adventure: 1.05, strategy: 0.9 },
  },
};
