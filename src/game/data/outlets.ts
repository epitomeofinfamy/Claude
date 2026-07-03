/**
 * The five critic-outlet archetypes from the GDD §7.4 table.
 *
 * Qualitative levels map to numbers as follows:
 *   harshness: low 0.3 · medium 0.5 · high 0.7        (0–1)
 *   prestige:  low 0.3 · medium 0.6 · high 0.9        (0–1, Metascore weight)
 *   variance:  low ±3  · medium ±6  · high ±10        (score points)
 *
 * Axis weights express "cares most about" (3), secondary interests (1–2),
 * and near-indifference (0.5); they are normalized at scoring time (§7.5).
 */

import type { Outlet } from "../types";

export const OUTLETS: Outlet[] = [
  {
    // Cares most about Presentation, Polish, accessibility (broad-appeal gameplay).
    id: "mainstream-giant",
    name: "The Mainstream Giant",
    axisWeights: {
      gameplay: 2,
      content: 1,
      presentation: 3,
      narrative: 1,
      innovation: 0.5,
      polish: 3,
    },
    harshness: 0.5,
    prestige: 0.9,
    variance: 3,
  },
  {
    // Cares most about Gameplay, Content, depth, difficulty.
    id: "hardcore-journal",
    name: "The Hardcore Journal",
    axisWeights: {
      gameplay: 3,
      content: 3,
      presentation: 0.5,
      narrative: 1,
      innovation: 1.5,
      polish: 1,
    },
    harshness: 0.7,
    prestige: 0.6,
    variance: 6,
  },
  {
    // Cares most about Innovation, Narrative, art; low harshness rewards ambition.
    id: "indie-darling-blog",
    name: "The Indie Darling Blog",
    axisWeights: {
      gameplay: 1,
      content: 0.5,
      presentation: 2,
      narrative: 3,
      innovation: 3,
      polish: 0.5,
    },
    harshness: 0.3,
    prestige: 0.6,
    variance: 10,
  },
  {
    // Cares most about Presentation, Polish, performance.
    id: "tech-site",
    name: "The Tech Site",
    axisWeights: {
      gameplay: 0.5,
      content: 0.5,
      presentation: 3,
      narrative: 0.5,
      innovation: 0.5,
      polish: 3,
    },
    harshness: 0.5,
    prestige: 0.3,
    variance: 3,
  },
  {
    // Cares most about fun-factor (gameplay), hype alignment, and value (content).
    id: "populist-channel",
    name: "The Populist Channel",
    axisWeights: {
      gameplay: 3,
      content: 2,
      presentation: 1,
      narrative: 0.5,
      innovation: 0.5,
      polish: 1,
    },
    harshness: 0.3,
    prestige: 0.6,
    variance: 10,
  },
];
