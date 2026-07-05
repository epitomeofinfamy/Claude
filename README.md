# GOING GOLD

A game-dev-studio management sim. Start alone in a garage in 1985; end running a studio that ships era-defining games — or one that chased trends into bankruptcy.

The full design is in [`GOING_GOLD_GDD.md`](./GOING_GOLD_GDD.md) — the authoritative spec. Contributor/agent conventions are in [`CLAUDE.md`](./CLAUDE.md).

## Play it

```sh
npm install
npm start     # builds nothing, runs the dev server, opens your browser
```

That's it — the game runs at `http://localhost:5173`.

### How a run goes

1. **Conceive** — read the market dashboard, pick a genre/topic/platform/scope, mind the 🔒 (research and office limits), and greenlight.
2. **Pre-production** — engine, creative risk, and self-fund vs. publisher deal.
3. **Production** — allocate the team across seven workstreams each milestone; handle events; crunch if you dare. Every milestone is a market quarter: payroll burns, trends move, rivals ship.
4. **The Ship Decision** — polish, crunch, cut scope, or delay. Then pick a window, set marketing (expectations are a loan against your quality), price it, and go gold.
5. **Reception** — the reveal. Turn your sound on.
6. **Post-mortem → Grow** — learn what actually happened, bank the launch quarter, then reinvest: engine R&D, training, research, hiring, a bigger office.
7. Repeat at a bigger scale — reputation opens doors and raises the bar. Run out of cash and it's over.

## Stack

Vite · React · TypeScript · Tailwind CSS · Zustand · Vitest

## Development

```sh
npm run dev    # dev server (no auto-open)
npm test       # run the simulation test suite
npm run build  # typecheck + production build
```

All game rules live in `src/game/` as pure, tested TypeScript; `src/ui/` is display only. See `CLAUDE.md` for the architecture rules.
