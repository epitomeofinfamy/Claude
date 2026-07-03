# GOING GOLD — Project Guide

## Vision

GOING GOLD is a single-player game-dev-studio management sim (Game Dev Tycoon / Software Inc. lineage). You start alone in a garage in 1985 and build a studio that ships era-defining games — or chases trends into bankruptcy. The fantasy: "I have taste and I can build a studio that proves it." The two non-negotiable design priorities are (1) a review system with real depth and (2) a core loop that feels like making games without feeling like a spreadsheet.

## Authoritative spec

**`./GOING_GOLD_GDD.md` is the source of truth for every mechanic.** When implementing or changing gameplay behavior, read the relevant GDD section first and follow it; if code and GDD disagree, the GDD wins (or the discrepancy should be raised, not silently resolved).

The load-bearing sections:

- **§7 — The Review System**: the deepest system in the game. Axis scores → objective quality `Q` → per-outlet perceived scores with context modifiers (expectations, trends, timing, platform fit, sequel fatigue, reputation) → Metascore + a separately-modeled user score → post-mortem. The ExpectationMod (hype vs. delivery gap, asymmetric punishment) is the marquee mechanic. §15 gives the exact pipeline order of operations; §16 says the review pipeline must never be stubbed.
- **§3 — The Core Loop**: eight beats (Conceive → Pre-production → Production → Ship Decision → Launch → Reception → Post-launch → Grow) at escalating scale, resolving into three central tensions: Scope↔Polish↔Time, Hype↔Delivery, People↔Output. Every feature must serve at least one of the four pillars in §1.

Also useful: §15 (implementation notes / core data objects and tuning knobs) and §16 (MVP scope).

## Tech stack

- **Vite** + **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4** (via `@tailwindcss/vite`; global entry is `src/index.css` with `@import "tailwindcss"` — no tailwind.config file)
- **Zustand** for state management
- **Vitest** for tests (`npm test` runs `vitest run`; `npm run test:watch` for watch mode)

Commands: `npm run dev` (dev server), `npm run build` (typecheck + build), `npm test`.

## Folder structure & conventions

```
src/
  game/    # Pure, deterministic game logic. Plain TypeScript only —
           #   NO React, no DOM, no Zustand, no side effects.
           #   All mechanics (axes, reviews, market, economy) live here.
           #   Tests are colocated: foo.ts + foo.test.ts.
  state/   # Zustand stores. The bridge layer: stores may import from
           #   src/game/, never the reverse.
  ui/      # React components. Read/write state via the stores;
           #   never implement game rules inline in components.
  main.tsx # Entry point.
  index.css
```

The dependency direction is one-way: `ui → state → game`. Keeping `src/game/` pure is what makes the review pipeline and simulation testable — preserve that boundary.

Conventions:

- Game logic functions take inputs and return outputs (no hidden state); randomness is passed in (e.g. an RNG or pre-rolled values), never called ambiently, so tests stay deterministic.
- Reference GDD sections in doc comments where a module implements one (e.g. `// GDD §7.3`).
- Numeric game values are 0–100 unless the GDD says otherwise; use `clamp` from `src/game/quality.ts`.
