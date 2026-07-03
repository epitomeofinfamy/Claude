# GOING GOLD
### A Game Development Studio Simulator — Game Design Document

> *Working title. "Going gold" is the industry term for finishing a game — the moment the final build is locked and sent to manufacturing. It's the feeling this game is about: the long climb to a shippable thing you're proud of.*

**Document version:** 0.1 (design foundation)
**Genre:** Business/management simulation, single-player
**Reference points:** Game Dev Tycoon, Game Dev Story (Kairosoft), Mad Games Tycoon, Software Inc.
**Two design priorities this doc treats as non-negotiable:** (1) a review system with real depth, and (2) a core loop that feels like making games without feeling like a spreadsheet.

---

## 1. High Concept & Pillars

You start alone in a garage in 1985 and end running a studio that ships era-defining games — or a studio that chased trends into bankruptcy. Between those two outcomes is a long chain of decisions about *what to build, who builds it, how hard to push them, and when to let go and ship.*

**Design pillars** (every feature must serve at least one):

1. **Shipping is a decision, not a formality.** The most interesting moment in real game dev is the end: polish more, cut scope, crunch, or delay. That tension is the heart of the loop.
2. **Reception is earned but not owned.** A good game is necessary but not sufficient. Expectations, timing, trends, and your own reputation shape how the game lands. The player learns to read the room, not just fill bars.
3. **People are the engine.** Games are made by tired, talented, specialized humans. Managing skill, morale, and burnout is the texture of the mid-game.
4. **The past compounds.** Hits raise your reputation *and* the bar you're held to. Franchises, tech, and talent carry forward. Nothing you do is isolated.

**Anti-pillars** (things we deliberately avoid): a single dominant "correct combo"; hidden formulas the player can only brute-force; busywork clicking that doesn't express a decision.

---

## 2. Player Fantasy & Audience

**The fantasy:** "I have taste and I can build a studio that proves it." The player should feel like a creative director and a business owner at once — betting on ideas, backing people, and reading a shifting market.

**Audience:** management-sim players, and the very large overlap of people who *play* games and fantasize about *making* them. Depth is opt-in: the surface is readable, the systems reward mastery.

**Platform (the real game):** PC first (Steam), then mobile/console. Premium, single-player, high replayability from a living market simulation. Sandbox-friendly with optional scenario goals.

---

## 3. The Core Loop

The loop runs at escalating scale — a garage prototype and a 200-person open-world production are the *same eight beats* with different stakes. This is what keeps it learnable without getting stale.

```
   ┌─────────────────────────────────────────────────────────────┐
   │                                                             │
   ▼                                                             │
 1. CONCEIVE ──► 2. PRE-PRODUCTION ──► 3. PRODUCTION ──► 4. THE  │
   greenlight       vision & team        the build        SHIP   │
   the idea                                              DECISION │
                                                            │     │
   8. GROW  ◄── 7. POST-LAUNCH ◄── 6. RECEPTION ◄── 5. LAUNCH ◄──┘
   reinvest       patch/DLC/IP       reviews roll in    timing &
   & reputation                      (the reveal)       marketing
```

### The eight beats

**1. Conceive.** Choose new IP or a sequel; pick genre (hybrids allowed — see §4); pick topic/theme; target platform(s) and audience; set a **scope/budget tier** (Prototype → Indie → Double-A → AAA). *Realism:* you commit money before you know the outcome; market research buys you partial signal, not certainty. *Fun:* combination discovery and hybrid experiments.

**2. Pre-production.** Set **design pillars** for the project (2–3 chosen emphases that bias the whole build), pick or build an **engine**, and assemble the team. Pre-pro decisions ripple through everything downstream. *Fun:* ownership — this is *your* engine, *your* creative bet.

**3. Production.** The meat (see §5). You allocate your team across **workstreams** (Gameplay, Content, Tech, Art, Audio, Narrative, Polish) over a series of **milestones**. Bars fill; events interrupt; you react. *Realism:* milestones and tradeoffs. *Fun:* momentum — watching a game come together, plus a steady drip of small meaningful decisions.

**4. The Ship Decision.** The pillar moment (see §6). Near content-complete you face the real dilemma: **polish, crunch, cut scope, or delay** — each with visible costs. This single screen carries more weight than any other in the game.

**5. Launch.** Pick a **release window** (a visible competitive calendar shows rival launches), set **marketing spend and plan**, choose price and platforms. *Realism:* timing and marketing move outcomes as much as quality does.

**6. Reception.** The reveal (see §7). Critic reviews roll in *staggered over a few in-game days* for suspense, then user reviews, then the aggregate **Metascore**. A **post-mortem** screen explains what landed and what didn't.

**7. Post-launch.** Patch bugs (raises the user score over time), ship DLC/updates, decide whether to run it as a live service or move on, and harvest the IP for a sequel. *Realism:* modern games live after launch — a rough launch can be redeemed.

**8. Grow.** Profits become hires, training, engine upgrades, bigger offices, and research into new genres/topics/platforms. **Reputation and franchises carry forward.** Then back to Conceive — at a larger scale.

### The three central tensions (the "realistic yet fun" engine)

Everything above resolves into three recurring tradeoffs. If these feel good, the game feels good.

| Tension | The realistic dilemma | Why it's fun |
|---|---|---|
| **Scope ↔ Polish ↔ Time** | The eternal triangle of shipping. Add features, make them shine, or ship on time — pick two. | Every project forces a fresh, high-stakes bet with legible consequences. |
| **Hype ↔ Delivery** | Marketing sets expectations. Over-promise and a good game still gets crucified; under-promise and a modest game becomes a darling. | Hype is a resource *and* a liability — a genuinely strategic knife's edge, and it feeds directly into reviews (§7). |
| **People ↔ Output** | Crunch buys short-term quality at the cost of morale and burnout; a burned-out star underperforms. | Your team is an asset you can overdraw. Sustainable studios and boom-bust studios both exist. |

---

## 4. Game Creation Mechanics

**Genre** defines an **ideal axis profile** — how much each of the six quality axes (§7) *should* matter for that kind of game. Matching your effort to the profile is the core "know your craft" skill.

| Genre (sample) | Emphasizes | De-emphasizes |
|---|---|---|
| RPG | Content, Narrative | — |
| Shooter | Gameplay, Presentation, Polish | Narrative |
| Puzzle | Gameplay, Innovation | Content, Presentation |
| Strategy | Gameplay, Content | Presentation |
| Adventure | Narrative, Presentation | Gameplay |
| Simulation | Gameplay, Content, Polish | Narrative |

**Hybrids** (e.g., *Action-RPG*, *Puzzle-Adventure*) **blend two profiles**, creating a merged target that no single memorized "combo" satisfies. This is a deliberate anti-solve lever (§7.9).

**Topic/Theme** (Fantasy, Space, Crime, Sports, Horror…) interacts with genre for **flavor fit** (Horror + Adventure = natural; Sports + Horror = risky novelty that can pay off or flop) and with **market trends** (§8). Topics are unlocked via research.

**Platform** carries an audience, an install base, a lifecycle stage (§8), and a **fit** with certain genres (hardcore strategy fits PC; short-session casual fits mobile). Mismatch is penalized at review (§7.6).

**Scope/Budget tier** sets the ceiling and the floor: bigger budgets raise the *possible* quality but also raise *expectations* (§7.6) and the cost of failure. A studio's tragedy is usually a AAA bet that missed.

---

## 5. Production & Team Systems

### Workstreams
Production is milestone-based. Each milestone (sprint), you distribute your team's effort across seven workstreams, each feeding one or more quality axes:

`Gameplay → Gameplay axis · Content → Content axis · Tech → enables Presentation & Polish ceilings · Art + Audio → Presentation · Narrative → Narrative axis · Polish/QA → Polish axis (and bug reduction)`

Under-serving a workstream your genre emphasizes is the most common self-inflicted wound — and the post-mortem calls it out by name so the player *learns* rather than guesses.

### Staff
- **Specialties:** Designer, Programmer, Artist, Audio, Writer, Producer, QA. Staff have per-specialty skill levels; a genius programmer is wasted on narrative.
- **Skill growth:** through shipping, training (costs time/money), and mentorship (seniors raise juniors).
- **Morale & burnout:** two separate meters. Morale affects day-to-day output quality; burnout accumulates under crunch and, past a threshold, tanks output and risks a star quitting. Recovery needs downtime between projects — a realistic reason not to ship back-to-back-to-back.
- **Producers** improve milestone efficiency and dampen the chaos of events (below).

### Production events (emergent texture)
Interrupts that demand a small decision, e.g.:
- *"A designer had a breakthrough on the combat system."* → spend a week to integrate it (Gameplay ↑) or ship the safe version.
- *"A rival is poaching your lead programmer."* → counter-offer (cost) or risk losing them mid-project.
- *"This feature is ballooning past estimate."* → cut it (scope ↓), or push (time/burnout ↑).

Events are the difference between "watching bars fill" and "running a studio."

---

## 6. The Ship Decision

At content-complete, a dedicated screen presents current axis readings, estimated critic/user reception, remaining bugs, team burnout, and the competitive calendar. The player chooses among (and can combine) four levers:

| Lever | Buys you | Costs you |
|---|---|---|
| **Polish** | Higher Polish axis, fewer launch bugs, better user score | Time (delays release, raises budget) |
| **Crunch** | Faster progress, short-term quality bump | Morale ↓, burnout ↑, quit risk ↑ |
| **Cut scope** | Ship on time, protect polish | Content axis ↓, potential "felt unfinished" complaints |
| **Delay** | Time to polish or add scope; dodge a crowded window | Budget ↑, hype can cool, window may still close |

Then **launch**: window (timing modifier, §7.6), marketing spend (sets the expectation baseline, §7.6 — the double-edged sword), price, and platforms.

This screen is where "realistic yet fun" lives or dies. It must feel like a *gut call with real stakes*, not an optimization.

---

## 7. The Review System (Core System)

This is the deepest system in the game. It answers "how did the world receive what I made?" — and it must do three things at once: reward genuine quality, punish miscalibration (over-hype, bad timing, tired sequels), and *teach the player how to improve* without becoming a solved formula.

### 7.1 Philosophy

Reviews are not a quality readout. They're a **perception** of quality, filtered through expectations, context, and the biases of whoever is reviewing. The player's job over a whole campaign is to internalize the difference between *making a good game* and *making a game that reviews well right now, from your studio, on that platform, in that window.*

### 7.2 The six quality axes

Every game is scored on six independent axes (0–100), produced during production:

| Axis | What it measures | Fed by |
|---|---|---|
| **Gameplay** | Mechanics, feel, systems depth | Gameplay workstream, Designer skill |
| **Content** | Amount, variety, length, replay value | Content workstream, scope tier, team size |
| **Presentation** | Visuals, audio, UI | Art + Audio workstreams, Tech ceiling |
| **Narrative** | Story, characters, writing, world | Narrative workstream, Writer skill |
| **Innovation** | Novelty and risk — did it do something new | Deliberate risk choices, novel topic/genre fits, *low on iterative sequels* |
| **Polish** | Stability, performance, bugs, quality-of-life | Polish/QA workstream, ship decision, Tech ceiling |

### 7.3 Producing an axis (link to the loop)

Each axis is computed from the production the player actually did:

```
AxisScore =
    clamp(
        BaseFromEffort(workstream_effort, assigned_staff_skill)
        × TechFactor        // Presentation/Polish are capped by engine level
        × GenreFitFactor    // did you emphasize what this genre needs?
        × ScopeFactor       // was the ambition supported by time/team? (overscope penalty)
        − CutCornerPenalty  // features cut, bugs shipped, crunch damage
        , 0, 100)
```

The **objective quality** of the game is the genre-weighted sum of the axes:

```
Q = Σ (AxisScore_i × GenreWeight_i)   // normalized 0–100
```

`Q` is what the game *deserves*. Everything in §7.6 distorts what it *gets*.

### 7.4 Critic outlets as personalities

The game is reviewed by a roster of **fictional outlets**, each with its own **axis-weight vector** (what it cares about), **harshness**, **prestige** (weight in the aggregate), and **variance** (how subjective/unpredictable it is). This models a real press landscape where the same game gets a 9 and a 6.

| Outlet archetype | Cares most about | Harshness | Prestige | Variance |
|---|---|---|---|---|
| **The Mainstream Giant** | Presentation, Polish, accessibility | Medium | High | Low |
| **The Hardcore Journal** | Gameplay, Content, depth, difficulty | High | Medium | Medium |
| **The Indie Darling Blog** | Innovation, Narrative, art | Low (rewards ambition) | Medium | High |
| **The Tech Site** | Presentation, Polish, performance | Medium | Low | Low |
| **The Populist Channel** | Fun-factor, hype alignment, Value | Low | Medium | High |

*Design note:* higher-prestige outlets have **lower variance** — they're consistent, and pleasing them is a reliable target. The high-variance outlets are where surprise scores (good and bad) come from.

### 7.5 The perceived-score model

Each outlet computes its raw impression, then applies context:

```
OutletRaw = Σ (AxisScore_i × OutletWeight_i)     // that outlet's personality

OutletScore =
    OutletRaw
    × ExpectationMod      // §7.6 — the big one
    × TrendMod
    × TimingMod
    × PlatformFitMod
    × SequelMod
    × ReputationHalo
    + Variance(outlet)                             // bounded random, scaled by outlet variance
```

### 7.6 Context modifiers (why a good game can still land badly)

**ExpectationMod — the marquee mechanic.** Marketing spend, budget tier, studio reputation, and franchise pedigree set an **ExpectedQuality** baseline before anyone plays. The modifier is driven by the *gap* between what you delivered and what you promised:

```
gap = Q − ExpectedQuality
ExpectationMod = 1 + k · asym_tanh(gap / scale)
```

`asym_tanh` is **asymmetric**: falling short of hype is punished *harder* than the equivalent overachievement is rewarded. Consequences:
- Over-hyped AAA that underdelivers → **crucified** (the gap is large and negative, on a steep curve).
- Humble indie that overdelivers → **darling bump** (positive surprise).
- The strategic lesson: marketing is a loan against your quality. Borrow only what you can repay.

**TrendMod.** Is this genre/topic currently *rising, neutral,* or *fatigued/saturated*? (See §8.) Riding a wave helps; flogging a dead trend hurts.

**TimingMod.** Launching in a crowded window beside a blockbuster splits attention and invites brutal head-to-head comparison → penalty. A clear window → neutral/slight bonus. This makes the release calendar a real decision.

**PlatformFitMod.** Genre/audience vs. platform match. A hardcore 80-hour strategy game on a casual mobile audience is penalized regardless of quality.

**SequelMod.** Sequels inherit a **pedigree bump** but risk **iteration fatigue**: a sequel that scores low on Innovation (too similar to the prior entry) is penalized, while a sequel that meaningfully evolves is rewarded. This models the annual franchise that reviews well — until players and critics tire of it.

**ReputationHalo.** Established studios get a small benefit of the doubt. But note it pairs with ExpectationMod: reputation *raises the bar* even as it softens the fall. The realistic double-edge of being famous.

### 7.7 The Metascore

The public aggregate the whole economy keys off:

```
Metascore = Σ (OutletScore_j × OutletPrestige_j) / Σ OutletPrestige_j
```

Displayed alongside a **consensus tightness** indicator (are the outlets agreeing, or is this divisive?). The Metascore drives: **sales multiplier**, **awards eligibility**, **reputation delta**, and **unlocks** (publisher offers, franchise potential, talent willing to join you).

### 7.8 Critic score vs. user score (they diverge — realistically)

Users are modeled separately and weight different things:

```
UserScore = f(
    Value,          // Content relative to price — heavily weighted
    LaunchPolish,   // launch-day bugs enrage users far more than critics
    HypeBacklash,   // over-marketed games trigger user backlash even at decent quality
    Sentiment       // community goodwill / controversy
)
```

Critics over-index on **Innovation** and **Narrative**; users over-index on **Value** and **Polish**. This produces the two classic divergences on purpose:
- A **polished but derivative sequel** → high user score, middling critics.
- An **ambitious, buggy art game** → critical darling, angry users at launch.

Both are valid outcomes the player can aim for depending on strategy (prestige vs. commercial).

### 7.9 Post-launch score movement

- **Patches** raise `LaunchPolish` over time → **user score climbs** (the redemption arc). A broken launch is recoverable if you commit to support.
- **Abandonment** of a broken game → user score decays and reputation suffers.
- **DLC/updates** raise Content/Value → can lift the user score and re-engage the market.
- **Critic scores are largely locked at launch** (as in reality), but a **major update can trigger a re-review event** for a partial adjustment.

This makes §7 (Reception) flow into §7-postlaunch as a *second act*, not a verdict.

### 7.10 The post-mortem (teaching the player)

After launch, a post-mortem screen translates the math into plain language so the player *learns the system by playing it*:
- **Critic pull-quotes** generated from the axes ("Stunning to look at, but the combat never evolves.").
- **Axis breakdown vs. genre expectation** — which axes over/under-performed relative to what this genre needed.
- **Diagnoses:** over-scoped? under-polished? over-hyped (expectation gap)? bad window? tired sequel? platform mismatch?
- **Top user complaints** (usually launch bugs and value).

The post-mortem is the *fun* face of a deep system: it demystifies enough to improve, without ever printing the formula.

### 7.11 Keeping it learnable but never "solved"

Deliberate anti-solve levers, so no single memorized combo dominates a whole campaign:
1. **Bounded variance** — outcomes are readable, never fully deterministic.
2. **Shifting trends** (§8) — last year's winning genre/topic decays; the meta moves under you.
3. **Rising expectations** — as your reputation grows, ExpectedQuality rises, so you must keep improving. (This is the "beat your last game" pressure of the genre, reframed as *reputation and expectations* rather than an opaque hidden comparison — same pressure, legible cause.)
4. **Hybrid genre profiles** — blended targets defeat rote memorization.
5. **Context over content** — mastery is reading *your studio's current expectation level + the current market + the release window*, not a static recipe.

### 7.12 Worked example

*Mid-size studio, reputation 70, ships a heavily-marketed open-world Action-RPG **sequel**, over-scoped, launches with notable bugs to hit a holiday window.*

- **Axes produced:** Presentation 88, Content 84, Gameplay 80, Narrative 78, **Innovation 55** (it's an iterative sequel), **Polish 60** (over-scoped + shipped early). `Q ≈ 79`.
- **Expectations:** high marketing + AAA budget + franchise pedigree → ExpectedQuality ≈ 84. **gap = −5** → ExpectationMod pulls *down* (mild disappointment).
- **SequelMod:** low Innovation on a sequel → iteration-fatigue penalty.
- **TimingMod:** crowded holiday window → slight penalty and harsh comparisons.
- **Critic Metascore ≈ 78** — a good game that "didn't quite live up to the hype and doesn't reinvent the series." Consensus: fairly tight, mildly divisive on innovation.
- **User score ≈ 62** at launch — launch bugs + over-hype backlash dominate the user model, even though the underlying game is strong.
- **Two patches later:** LaunchPolish repaired → **user score climbs to ~80**; sales get a long-tail bump; reputation recovers.

**Lesson delivered by the post-mortem:** the game was strong; *hype and a rough launch* — not quality — cost the score, and *supporting it* fixed the user reception. That's the review system doing its job.

---

## 8. Market Simulation

The world the reviews live in.

- **Genre & topic trends** rise and fall on cycles (some slow, some faddish). A **hype curve** per genre/topic feeds TrendMod (§7.6). Setting a trend early (before it peaks) is high-risk, high-reward.
- **Platform lifecycles:** each platform has launch → growth → peak → decline, changing its install base and desirability. Betting on a new platform early vs. milking a mature one is a recurring call.
- **Genre saturation:** flooding a hot genre erodes its bonus for everyone, including you — you can burn out a trend by over-serving it.
- **Competitors:** AI studios ship games on the visible calendar (§6), occupy trends, and poach staff — the source of Timing pressure and a live sense that you're in an industry, not a vacuum.

---

## 9. Economy

- **Costs:** salaries (scale with skill and headcount), engine/tech R&D, marketing, office/overhead, training.
- **Revenue:** unit sales × price × **Metascore-driven sales multiplier**, minus platform cut, across the sales tail (front-loaded, extended by patches/DLC and word-of-mouth from a high user score).
- **Funding:** self-fund (keep all upside, carry all risk) vs. **publisher deals** (capital + marketing muscle in exchange for a revenue cut and sometimes creative/scope constraints — unlocked by reputation). The classic indie-vs-publisher tension.
- **Failure states:** running out of cash (over-scoped flops, bloated payroll) — the boom-bust cycle is a real, reachable outcome, which is what gives success meaning.

---

## 10. Meta-Progression

- **Studio growth:** garage → indie → studio → AAA, gating team size, engine ceilings, and project scope.
- **Reputation:** the compounding asset. Opens publishers, talent, and franchise value — and raises the expectation bar (§7.6). Being great is a treadmill, by design.
- **Research/tech tree:** unlock genres, topics, platforms, engine features (which raise Presentation/Polish ceilings, §7.3), and specialized team capabilities.
- **Franchises & IP:** successful originals become sequel-able IP with pedigree; the SequelMod (§7.6) makes managing a franchise's *evolution* a long-game skill — milk it too long and iteration fatigue catches up.

---

## 11. Events & Emergent Narrative

Beyond production events (§5), studio-level events create story: award shows (validate a prestige strategy), industry scandals, platform-holder politics, viral moments, a beloved veteran retiring, an acquisition offer. These aren't just flavor — they feed reputation, morale, and market conditions, so the campaign *tells a story* rather than repeating a spreadsheet.

---

## 12. Difficulty, Balance & Anti-Frustration

- **Difficulty tiers** primarily tune expectation steepness (§7.6), market volatility, and cash cushion — not fake stat inflation.
- **Anti-frustration:** the post-mortem (§7.10) guarantees every failure is *explained*, so losses feel earned and instructive, never random.
- **Balance goal:** no single strategy should dominate a full campaign. Prestige (chase critics/awards) and commercial (chase user score/sales) should both be viable, distinct paths — with the review system's critic/user split (§7.8) as the mechanical fork between them.

---

## 13. Endgame / Sandbox

- **Sandbox:** open-ended studio-building across decades and platform generations, with periodic "era shifts" that reshuffle the market.
- **Optional goals/scenarios:** e.g., "win Game of the Year," "survive a market crash," "build a studio that ships five 90+ Metascore games without a single crunch-driven burnout." Achievements reward *distinct* playstyles, not one optimum.

---

## 14. UI/UX & Art Direction (Brief)

- **UI:** a studio dashboard (cash, reputation, market trends, calendar) as home base; a focused **production view** with the workstream milestone board; a **launch console**; and the **reception/post-mortem** as a designed dramatic beat, not a stat dump.
- **The reveal:** staggered review roll-in (§3, beat 6) with deliberate pacing and sound — the emotional peak of every loop.
- **Art direction:** clean, warm, readable; a retro-to-modern visual progression across eras that mirrors the player's own studio growth.

---

## 15. Implementation Notes (Spec / "Prompt" Layer)

*A compact model to hand to engineers — or to a coding assistant — for a first build.*

**Core data objects**
- `Game { ipId, genre[], topic, platform[], scopeTier, engineId, axes{gameplay,content,presentation,narrative,innovation,polish}, Q, marketingSpend, releaseWindow, isSequelOf }`
- `Studio { cash, reputation, engines[], staff[], ipCatalog[], offices }`
- `Staff { specialty, skills{}, morale, burnout }`
- `Outlet { axisWeights{}, harshness, prestige, variance }`
- `Market { genreTrend{}, topicTrend{}, platformLifecycle{}, saturation{}, competitorCalendar[] }`

**Review pipeline (order of operations)**
1. Compute each `AxisScore` from production inputs (§7.3).
2. Compute `Q` = genre-weighted axis sum (§7.3).
3. Compute `ExpectedQuality` from marketing + budget tier + reputation + pedigree.
4. For each `Outlet`: `OutletRaw` → apply modifiers (§7.6) → add variance → `OutletScore`.
5. Aggregate prestige-weighted → `Metascore` (§7.7).
6. Compute `UserScore` from the separate model (§7.8).
7. Derive sales multiplier, reputation delta, unlocks, awards.
8. Generate `PostMortem` text + diagnoses from the axis gaps and modifiers (§7.10).
9. On post-launch actions, mutate `LaunchPolish`/`Content`/`Value` and re-derive `UserScore` (and re-review events) over time (§7.9).

**Tuning knobs to expose first:** `k` and `scale` in ExpectationMod (asymmetry of hype punishment), outlet variance bounds, trend cycle speed, and overscope penalty steepness. These four dials shape most of the game's feel.

---

## 16. MVP Scope (Build This First)

To validate the two priorities cheaply, the vertical slice needs only:
1. One genre + a handful of topics + one platform.
2. Milestone production with workstream allocation and 3–4 event types (§5).
3. The full **Ship Decision** screen (§6).
4. The **complete review pipeline** (§15) — axes → expectations → 3 outlets → Metascore + user score → post-mortem. *This is the point of the whole prototype; do not stub it.*
5. A minimal market with one moving trend and one competitor launch, to prove Timing and Trend modifiers matter.

If that slice is fun — if the Ship Decision feels tense and the post-mortem makes players say "next time I'll under-promise and polish" — the design is working, and everything else is expansion.

---

*End of document. Everything here is a foundation to iterate on: the review model in §7 and the loop in §3 are the load-bearing walls; the rest is meant to be pressure-tested and revised.*
