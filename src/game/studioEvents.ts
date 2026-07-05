/**
 * Studio-level events & emergent narrative — GDD §11.
 *
 * Beyond production events (§5), studio-level events create story: award
 * shows validate a prestige strategy, scandals tax a crunch habit, viral
 * moments move market conditions, beloved veterans retire, acquirers come
 * knocking. They feed reputation, morale, and the market, so a campaign
 * tells a story across decades rather than repeating a spreadsheet.
 *
 * Data-driven: EVENT_TABLE is a list of definitions, each with a weight
 * function over the studio's current state (0 = can't fire) and a builder
 * producing the instance text + options. Options carry declarative
 * StudioEventEffects that the loop applies uniformly. One event may fire
 * per grow beat, rolled against QUIET_WEIGHT (most quarters, life just
 * goes on). Pure; rng injected.
 */

import type { Genre, Specialty, Staff } from "./types";
import type { Rng } from "./reviews";

export const STUDIO_EVENT_TUNING = {
  /** Weight of "nothing newsworthy happened" in the roll. */
  QUIET_WEIGHT: 120,

  AWARD_METASCORE_BAR: 78,
  AWARD_WEIGHT_PER_POINT: 8,
  AWARD_REPUTATION: 6,
  AWARD_MORALE: 8,

  SCANDAL_CRUNCH_BAR: 0.3,
  SCANDAL_WEIGHT_PER_CRUNCH: 60,
  SCANDAL_WEIGHT_PER_DEPARTURE: 25,

  VIRAL_USER_BAR: 75,
  VIRAL_WEIGHT_PER_POINT: 6,
  VIRAL_UNDERDOG_BONUS: 15,
  VIRAL_HYPE_MOMENTUM: 3,

  VETERAN_SKILL_BAR: 70,
  VETERAN_MIN_CAMPAIGN_YEARS: 4,
  VETERAN_BASE_WEIGHT: 10,
  VETERAN_WEIGHT_PER_YEAR: 3,
  VETERAN_PARTING_SKILL_GIFT: 4,
  VETERAN_SEND_OFF_COST: 5_000,

  ACQUISITION_REPUTATION_BAR: 55,
  ACQUISITION_WEIGHT_PER_POINT: 4,
  ACQUISITION_HIT_BONUS: 20,
  ACQUISITION_BASE_OFFER: 100_000,
  ACQUISITION_OFFER_PER_REPUTATION: 3_000,
} as const;

// ---------------------------------------------------------------------------
// Context & effects
// ---------------------------------------------------------------------------

/** What the event system reads about the studio (structural, loop-agnostic). */
export interface StudioEventContext {
  studio: {
    reputation: number;
    cash: number;
    staff: Staff[];
  };
  /** The just-shipped game's outcome, if this beat follows a launch. */
  launch: {
    metascore: number;
    userScore: number;
    gap: number;
    genres: Genre[];
    /** Share of milestones crunched, 0–1. */
    crunchShare: number;
    /** People who walked out during the project. */
    departures: number;
  } | null;
  /** Years since the garage opened — long campaigns accrue history. */
  campaignYears: number;
}

/** Declarative effects; the loop applies whichever fields are present. */
export interface StudioEventEffects {
  cash?: number;
  reputation?: number;
  moraleAll?: number;
  /** Staff id who leaves the studio. */
  staffLeaves?: string;
  /** Parting mentorship: everyone sharing this specialty improves. */
  skillBump?: { specialty: Specialty; amount: number };
  /** Market condition: a momentum shove to a genre's hype curve (§8). */
  genreHype?: { genre: Genre; momentum: number };
}

export interface StudioEventOption {
  id: string;
  label: string;
  effects: StudioEventEffects;
}

export type StudioEventId =
  | "award-show"
  | "crunch-expose"
  | "viral-moment"
  | "veteran-retires"
  | "acquisition-offer";

export interface StudioEventInstance {
  id: StudioEventId;
  headline: string;
  body: string;
  options: StudioEventOption[];
}

// ---------------------------------------------------------------------------
// The event table
// ---------------------------------------------------------------------------

interface StudioEventDef {
  id: StudioEventId;
  weight: (ctx: StudioEventContext) => number;
  build: (ctx: StudioEventContext) => StudioEventInstance;
}

function veteranOf(staff: Staff[]): Staff | null {
  const t = STUDIO_EVENT_TUNING;
  const vets = staff.filter((s) => s.skills[s.specialty] >= t.VETERAN_SKILL_BAR);
  if (vets.length === 0) return null;
  return vets.reduce((best, s) =>
    s.skills[s.specialty] > best.skills[best.specialty] ? s : best,
  );
}

export function acquisitionOffer(reputation: number): number {
  const t = STUDIO_EVENT_TUNING;
  return t.ACQUISITION_BASE_OFFER + Math.round(reputation) * t.ACQUISITION_OFFER_PER_REPUTATION;
}

export const EVENT_TABLE: StudioEventDef[] = [
  {
    id: "award-show",
    weight: ({ launch }) => {
      const t = STUDIO_EVENT_TUNING;
      if (!launch || launch.metascore < t.AWARD_METASCORE_BAR) return 0;
      return (launch.metascore - t.AWARD_METASCORE_BAR + 1) * t.AWARD_WEIGHT_PER_POINT;
    },
    build: () => ({
      id: "award-show",
      headline: "The Golden Joystick goes to…",
      body: "Your game swept the industry awards. The trophy is heavy, the afterparty is loud, and every publisher in the room suddenly knows your name.",
      options: [
        {
          id: "take-the-stage",
          label: "Take the stage",
          effects: {
            reputation: STUDIO_EVENT_TUNING.AWARD_REPUTATION,
            moraleAll: STUDIO_EVENT_TUNING.AWARD_MORALE,
          },
        },
      ],
    }),
  },
  {
    id: "crunch-expose",
    weight: ({ launch }) => {
      const t = STUDIO_EVENT_TUNING;
      if (!launch) return 0;
      const fromCrunch =
        launch.crunchShare >= t.SCANDAL_CRUNCH_BAR
          ? launch.crunchShare * t.SCANDAL_WEIGHT_PER_CRUNCH
          : 0;
      return fromCrunch + launch.departures * t.SCANDAL_WEIGHT_PER_DEPARTURE;
    },
    build: () => ({
      id: "crunch-expose",
      headline: "Exposé: 'The human cost of going gold'",
      body: "A trade paper published a piece on your studio's hours, with quotes from people who left. The industry is reading it. Your team is reading it too.",
      options: [
        {
          id: "own-it",
          label: "Own it publicly and change the schedule",
          effects: { reputation: -2, moraleAll: 3 },
        },
        {
          id: "deny",
          label: "Deny everything",
          effects: { reputation: -7, moraleAll: -5 },
        },
      ],
    }),
  },
  {
    id: "viral-moment",
    weight: ({ launch }) => {
      const t = STUDIO_EVENT_TUNING;
      if (!launch || launch.userScore < t.VIRAL_USER_BAR) return 0;
      return (
        (launch.userScore - t.VIRAL_USER_BAR + 1) * t.VIRAL_WEIGHT_PER_POINT +
        (launch.gap > 10 ? t.VIRAL_UNDERDOG_BONUS : 0)
      );
    },
    build: (ctx) => ({
      id: "viral-moment",
      headline: "Your game is everywhere",
      body: "A clip of your game took over the airwaves and the schoolyards. Strangers are quoting it. The whole genre is suddenly hot.",
      options: [
        {
          id: "ride-wave",
          label: "Ride the wave",
          effects: {
            reputation: 3,
            genreHype: {
              genre: ctx.launch?.genres[0] ?? "rpg",
              momentum: STUDIO_EVENT_TUNING.VIRAL_HYPE_MOMENTUM,
            },
          },
        },
      ],
    }),
  },
  {
    id: "veteran-retires",
    weight: ({ studio, campaignYears }) => {
      const t = STUDIO_EVENT_TUNING;
      if (campaignYears < t.VETERAN_MIN_CAMPAIGN_YEARS || !veteranOf(studio.staff)) return 0;
      return t.VETERAN_BASE_WEIGHT + campaignYears * t.VETERAN_WEIGHT_PER_YEAR;
    },
    build: (ctx) => {
      const vet = veteranOf(ctx.studio.staff)!;
      const t = STUDIO_EVENT_TUNING;
      return {
        id: "veteran-retires",
        headline: `${vet.name} is retiring`,
        body: `After years of shipping games together, your ${vet.specialty} is hanging it up. The desk will be empty either way — the question is what the last day feels like.`,
        options: [
          {
            id: "send-off",
            label: `Throw a proper send-off ($${t.VETERAN_SEND_OFF_COST.toLocaleString()})`,
            effects: {
              cash: -t.VETERAN_SEND_OFF_COST,
              staffLeaves: vet.id,
              moraleAll: 3,
              skillBump: { specialty: vet.specialty, amount: t.VETERAN_PARTING_SKILL_GIFT },
            },
          },
          {
            id: "quiet-goodbye",
            label: "A quiet goodbye",
            effects: { staffLeaves: vet.id, moraleAll: -4 },
          },
        ],
      };
    },
  },
  {
    id: "acquisition-offer",
    weight: ({ studio, launch }) => {
      const t = STUDIO_EVENT_TUNING;
      if (studio.reputation < t.ACQUISITION_REPUTATION_BAR) return 0;
      return (
        (studio.reputation - t.ACQUISITION_REPUTATION_BAR + 1) * t.ACQUISITION_WEIGHT_PER_POINT +
        (launch && launch.metascore >= 75 ? t.ACQUISITION_HIT_BONUS : 0)
      );
    },
    build: (ctx) => {
      const offer = acquisitionOffer(ctx.studio.reputation);
      return {
        id: "acquisition-offer",
        headline: "A megacorp wants to buy the studio",
        body: `Lawyers in good suits, a number with a lot of zeros ($${offer.toLocaleString()}), and a promise that "nothing will change." Everyone is watching what you do.`,
        options: [
          {
            id: "decline",
            label: "This studio isn't for sale",
            effects: { reputation: 4, moraleAll: 5 },
          },
          {
            id: "take-the-money",
            label: "Take the money",
            effects: { cash: offer, reputation: -12, moraleAll: -10 },
          },
        ],
      };
    },
  },
];

// ---------------------------------------------------------------------------
// The roll
// ---------------------------------------------------------------------------

/** Per-event weights for this context — exported for tests and tuning. */
export function eventWeights(ctx: StudioEventContext): Record<StudioEventId, number> {
  const weights = {} as Record<StudioEventId, number>;
  for (const def of EVENT_TABLE) weights[def.id] = def.weight(ctx);
  return weights;
}

/**
 * Rolls the grow-beat event: weighted by studio state against QUIET_WEIGHT.
 * Returns null most of the time — quiet quarters are what make the loud
 * ones read as story.
 */
export function rollStudioEvent(ctx: StudioEventContext, rng: Rng): StudioEventInstance | null {
  const weights = EVENT_TABLE.map((def) => def.weight(ctx));
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (total <= 0) return null;
  const roll = rng() * (total + STUDIO_EVENT_TUNING.QUIET_WEIGHT);
  if (roll >= total) return null;
  let acc = 0;
  for (let i = 0; i < EVENT_TABLE.length; i++) {
    acc += Math.max(0, weights[i]!);
    if (roll < acc) return EVENT_TABLE[i]!.build(ctx);
  }
  return null;
}
