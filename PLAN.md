# The Eldritch Beacon — Project Plan

> A maritime cosmic horror logic puzzle game. Place Watchers. Mark Wards. Solve by logic alone.

---

## Status: Phase 1 In Progress

**Phase:** 1 — Core Built, Dev Server Running  
**Last Updated:** 2026-06-05

---

## Phase 1 — Make the Game Work

**Goal:** Playable puzzle game with correct rules, solver, hints, and local save. No final art yet.

**Success Criteria:** Fun even with placeholder graphics.

### Foundation
- [x] Init Next.js + TypeScript + Tailwind project
- [x] Set up folder structure (`/engine`, `/components`, `/data`, `/theme`, `/lib`)
- [x] Configure local storage utility (`lib/storage.ts`)

### Engine (Core — Build First)
- [x] `engine/boardTypes.ts` — Board, Cell, Territory, Watcher, Ward, Puzzle, PlayerState types
- [x] `engine/rules.ts` — Rule validation (one per row/col/territory, no adjacency)
- [x] `engine/solver.ts` — Logical solver module
  - [x] `getCandidates(board)`
  - [x] `validateBoard(board)`
  - [x] `findContradictions(board)`
  - [x] `getNextDeduction(board)`
  - [x] `solveLogically(board)`
  - [x] `hasUniqueSolution(board)`
- [x] `engine/hints.ts` — Hint engine (uses solver, never gives free answers)
- [x] `engine/difficulty.ts` — Difficulty scorer

### Puzzle Data
- [x] `data/samplePuzzles.ts` — 20 hand-authored puzzles
  - [x] 5×5 samples (5)
  - [x] 6×6 samples (5)
  - [x] 7×7 samples (5)
  - [x] 8×8 samples (5)

### UI Components
- [x] `components/Board.tsx` — Main puzzle board grid
- [x] `components/Cell.tsx` — Individual cell (empty / Watcher / Ward / highlighted)
- [x] `components/Watcher.tsx` — SVG placeholder piece
- [x] `components/Ward.tsx` — SVG placeholder piece
- [ ] `components/HintOverlay.tsx` — Hint highlight / annotation layer
- [ ] `components/GameControls.tsx` — Hint, Undo, Restart buttons

### Game Logic (UI layer)
- [x] Place / remove Watcher on tap/click (cycles empty → watcher → ward → empty)
- [x] Undo move (full undo stack, capped at 50)
- [x] Restart puzzle (confirm prompt)
- [x] LocalStorage save state per puzzle
- [x] Soft warning: "The stars drift toward madness."
- [x] Hard contradiction error with affected territory highlight
- [ ] **TODO: Verify all puzzles are actually solvable by the logical solver**

### Modes (Phase 1)
- [x] Initiate mode (5×5 – 8×8) — puzzles loaded
- [ ] Cult Master mode (8×8 – 10×10) — data needed

### Puzzle Selection
- [x] Puzzle list / selector screen
- [x] Load puzzle by ID

### Hint System (Phase 1)
- [x] Level 1 — Look Here (highlight region)
- [x] Level 2 — Show the Problem (highlight + explanation)
- [x] Level 3 — Place a Ward (player performs action)
- [x] Level 4 — Forced Watcher (last resort)

### Accessibility (Phase 1 baseline)
- [x] Territory texture patterns (not color-only) — mapped in theme/colors.ts
- [x] Readable icon sizes

---

## Puzzle Builder App (Phase 2 — Planned)

A standalone puzzle creation tool, separate from the player-facing game. The game stays lean (static puzzle data); all generation complexity lives here.

**Why separate:** puzzle generation is compute-heavy (seconds to minutes per puzzle for larger boards), requires developer tooling, and adds no value to players. Keeping it external means the game ships only what's needed.

**Planned capabilities:**
- Visual puzzle editor (draw territory boundaries, place watcher solution)
- Automatic solver validation (logic-only, unique solution check)
- Batch generation by size and difficulty
- Export to `samplePuzzles.ts` / a JSON feed
- `/generate` solver inspector (already built — see below)

---

## Generator / Inspector Tool (Phase 1 — Complete)

A split was made between puzzle generation tooling and the playable game.

**`/generate` page** — Developer tool for building and inspecting puzzles:
- Size selector (5×5 – 10×10) and seed input
- Generates a puzzle and runs the full logical solver step by step
- Displays solve steps grouped into **waves** by technique:
  - Wave = all deductions available from the same board state
  - Steps within a wave can theoretically be spotted in parallel
  - Waves are grouped by technique label (Adjacency Cleanup, Naked Single, Row Confinement, Column Confinement, Group Elimination, Contradiction Test)
- Clicking a step shows the board state at that point, with the active cell highlighted
- Step detail card shows technique name, affected territories, and the human-readable reason
- Puzzle metadata: ID, seed, difficulty, total waves and steps

**Engine files:**
- [x] `engine/generator.ts` — Procedural puzzle generator with seed-based RNG, BFS territory growth, and logic-gate validation
- [x] `engine/solveTrace.ts` — Wave-by-wave solve analysis (`buildSolveTrace`)
- [x] `app/generate/page.tsx` — Generator/inspector UI

---

## Rendering Architecture

### Core Rule

The puzzle engine must never know how the board is rendered. The engine exposes only:

- Board state
- Territory data
- Valid moves
- Deductions
- Hints
- Puzzle metadata

The renderer consumes that output. Possible renderers: SVG, HTML/CSS, Canvas, Three.js, or a future game engine. The engine remains unchanged regardless of renderer.

Architecture:

```
Puzzle Engine → Board State → Rendering Layer
```

The engine must be capable of running entirely through unit tests without any rendering system attached.

---

### Phase 1 Rendering (current)

**Goal:** Make the game playable.

- SVG, React Components, Tailwind
- Flat puzzle board, SVG Watchers, SVG Wards, parchment textures
- Fade/scale animations, simple hint highlights

Success condition: the game is fun even with placeholder visuals.

---

### Phase 2 Rendering

**Goal:** Create depth and atmosphere.

- Framer Motion, CSS transforms, SVG animation
- Slight board perspective, layered paper effect, subtle depth
- Watcher eye opening, tentacle unfurling, Ward drawing itself, red-ink hint animations, puzzle completion effects

Visual style: the board should begin to feel like an artifact from a lighthouse journal.

---

### Phase 3 Rendering

**Goal:** Create a living diorama around the puzzle.

- Three.js, React Three Fiber
- Puzzle exists on a physical chart table, slight camera movement, atmospheric lighting
- Watchers emerge from cracks, tentacles move beneath the board, fog drifts, completion events affect the environment

**Important:** the puzzle itself remains clear and readable. Visual spectacle must never reduce puzzle usability.

---

### Campaign Environment (future)

Players ascend the Beacon. Each region represents a higher level of the lighthouse:

- The Foundations → The Shore → The Fog → The Reefs → Deep Water → The Black Tide → The Lantern Room → The Watcher Beneath

Each region may eventually have unique environment art, atmospheric effects, visual storytelling, and environmental progression.

---

### Environmental Storytelling (future)

- Tentacles wrapped around stone walls
- Strange charts pinned to walls, recovered journals
- Blinking eyes hidden in shadows, fog through broken windows
- Distant lighthouse machinery

These elements enhance atmosphere without interrupting gameplay.

---

### Puzzle Completion Events (future)

- Lighthouse rises from the completed board
- Occult sigils form across the chart
- Tentacles retreat into cracks
- The Beacon's eye opens
- Environmental changes reveal hidden lore

Treated as rewards, not gameplay mechanics.

---

### Long-Term Vision

The final version of The Eldritch Beacon should feel like solving forbidden charts within a living lighthouse. The player is not simply solving puzzles — they are ascending through a strange, impossible structure while uncovering the mystery of the Watchers and the thing that holds the Beacon in place.

The puzzle remains the heart of the experience. The visuals exist to reinforce wonder, mystery, and atmosphere.

---

## Phase 2 — Make the Game Good

**Goal:** Procedural generation, full mode support, daily puzzle, stats, better hints.

**Success Criteria:** Game generates fair puzzles without manual work.

### Pinned: Plan B — Solver-Backed 10×10 Generator

Current state: `scripts/generate10x10.ts` uses constructive shape placement (single + thin + blobs) which produces line-heavy boards. Reducing thin count to get more visual variety drops the depth-1 solver's hit rate to ~0, so we're stuck shipping line-heavy 10×10s like eb-10x10-003 / -004.

Plan B (to revisit): build a generator that constructs the territory map by *targeting solver behavior directly*. Approach: backtrack territory assignments, evaluate the trace (runup, contradiction count, technique mix) on each candidate, and prune paths that fail to meet the difficulty profile. Optionally introduce richer shape primitives (L, T, plus-sign, 2×3 block) that constrain rows/cols without being straight lines. Out of scope for the current pass — revisit when we want truly varied 10×10 hard packs.

- [x] `engine/generator.ts` — Procedural puzzle generator
  - [x] Unique solution checker
  - [x] Logic-only validation (reject if solver can't crack it)
  - [x] Seed-based generation
- [ ] `data/dailySeeds.ts` — Date-hash daily puzzle seeds
- [ ] Difficulty rating display (Initiate → Scholar → Occultist → High Priest → Eldritch)
- [ ] Puzzle Pack data structure (`PuzzlePack`)
- [ ] Lore/Codex entry structure (`CodexEntry`) — content empty, system present
- [ ] Achievement event hooks (`onPuzzleSolved`, `onHintUsed`, etc.) — wired but inert
- [ ] PlayerProgress model (separate from puzzle definitions)
- [ ] 9×9 and 10×10 puzzle generation (requires deeper contradiction solver — 2-level chains; current solver tops out at 8×8)
### Engine: Solver Instrumentation & New Techniques

- [x] **Solver instrumentation** — log technique frequency per puzzle (how often each technique fires, in what order); use output to understand what 9×9/10×10 puzzles actually require and calibrate generation difficulty filters
- [x] **Territory Dead-End** — when placing a watcher at cell X would immediately reduce another territory to 0 candidates, X can be eliminated as a Ward without hypothesis testing; faster than full contradiction test
- [x] **Dual Confinement** — detect when a territory's remaining candidates fall within a single row AND a single column simultaneously; the cell at their intersection is a forced Watcher placement
- [x] **Forced Territory Chain** — depth-2 propagation: if placing X forces deduction Y (through forward-only logic), and Y creates a contradiction, then X is eliminated; generalises the current hypothesis pass one level deeper

- [ ] Twin Watchers mode (2 per territory/row/col)
- [ ] Shattered Realms mode (disconnected color islands)
- [ ] Daily Beacon puzzle (local seed Phase 2, server seed Phase 3)
- [ ] Solve stats (time, hints, mistakes)
- [ ] Streak tracking
- [ ] Improved mobile layout
- [ ] Saved progress per puzzle
- [ ] Better board textures and SVG assets
- [ ] Add Supabase (daily puzzles, optional accounts, streak sync)

---

## Phase 3 — Make the Game Beautiful

**Goal:** Full Eldritch Beacon visual identity. Screenshots feel unmistakably like this game.

- [ ] Final Watcher design (central eye, radiating tentacles, color iris per territory)
- [ ] Final Ward design (compass rose occult sigil)
- [ ] Lighthouse main menu screen
- [ ] Animated lighthouse eye blink
- [ ] Watcher placement animation (eye opens, tentacles unfurl)
- [ ] Ward draw-in animation (stroke by stroke)
- [ ] Hint arrow sketch animation
- [ ] Territory completion tentacle animation
- [ ] Final puzzle completion sigil animation
- [ ] Fog animation on menu
- [ ] Lore journal with Codex entries
- [ ] Sound effects
- [ ] Optional music / ambient audio
- [ ] Accessibility pass (high contrast, reduced motion)
- [ ] PWA install support
- [ ] Optional Framer Motion integration

---

## Daily Beacon Integration

### Core Philosophy

The Campaign and the Daily Beacon serve fundamentally different purposes and must remain independent systems.

**Campaign:** teaches deduction techniques, puzzle logic, pattern recognition, and advanced strategies. Progression makes players stronger solvers.

**Daily Beacon:** provides a shared daily challenge, a monthly completion goal, long-term engagement, and advanced practice. It is not a tutorial.

---

### Format — Shattered Realms

Daily Beacon puzzles use **Shattered Realms** mode: territories are non-contiguous. A color may appear as multiple disconnected islands, but the rule is unchanged — exactly one Watcher per color, regardless of how many islands it spans.

This makes the daily feel meaningfully distinct from campaign puzzles and introduces a richer set of deductions (Broken Territory, Echo Territory, Phantom Refuge).

**Difficulty target:** Occultist minimum, Eldritch/Harbinger typical. The Daily Beacon is a challenge, not an introduction.

---

### Availability

The Daily Beacon must be available immediately to all players — no campaign unlock required.

A new player should be able to:
1. Install the game
2. Play today's Daily Beacon
3. Begin the Campaign

in any order, without gates.

**Reasons:** encourages daily engagement from day one, allows new players to participate in community discussions, supports long-term retention, creates a habit loop independent of campaign progression.

---

### Difficulty and Discovery

Daily Beacons may use techniques the player has not yet encountered in the Campaign. This is intentional.

If a player encounters an unknown technique:
1. The hint system explains it
2. The technique is unlocked in the Codex
3. The player may review it later

Daily Beacons function as both challenge content and discovery content.

---

### Monthly Calendar Model

The Daily Beacon tracks completions per calendar date, not just streaks. Each month is displayed as a grid of days — completed days are marked, missed days remain open.

**Key behaviours:**
- Players can go back and complete any puzzle from the current month
- A full month completion is a distinct achievement (separate from streak)
- Past months are archived and remain playable indefinitely
- Streak counts consecutive days with no gap (as usual)
- Monthly completion rate shown alongside streak (e.g. "14/30 this month")

This encourages two habits: daily play (streak), and catch-up play (monthly completion). A player who misses Tuesday can still chase the full month.

---

### Statistics (per player, separate from campaign)

- Current streak
- Longest streak
- Monthly completion count (e.g. 22/31)
- Solve time per puzzle
- Hints used per puzzle
- Mistakes per puzzle
- All-time completion count

---

### Seed Strategy

- **Phase 2:** Local seed — date string hashed to a puzzle seed. Deterministic, no server needed.
- **Phase 3:** Server seed — puzzle curated or generated server-side, allows quality control and special event puzzles.

---

### Future Features (architecture must support)

- Global daily leaderboards
- Friend challenges
- Shared puzzle seeds
- Daily Beacon archives (all past months browsable)
- Seasonal events / special puzzles
- Monthly completion badges

These must not require changes to the puzzle engine.

---

## Known Issues Fixed

- **Difficulty rating system broken (2026-06-01):** `classifyDeduction()` in `difficulty.ts` did not handle `reasonType: 'hypothetical'` (contradiction test deductions) — they fell through to the `naked` category (weight 1 instead of 5). A chain bonus heuristic also fired incorrectly, inflating all scores beyond the Eldritch threshold. Result: all 20 puzzles rated Eldritch regardless of actual technique usage. Fixed by: adding `contradictionTest` category to `TechniqueRecord`, checking `d.reasonType === 'hypothetical'` in `classifyDeduction`, removing chain bonus, and recalibrating score thresholds. Puzzles now rate Scholar–Eldritch with real variation. `samplePuzzles.ts` now calls `rateDifficulty()` dynamically so labels stay accurate after any threshold adjustment.

- **Contradiction test false positive (2026-06-01):** `contradictionTest` in `solver.ts` was checking `t2 !== territory` instead of `!occupiedTerritories.has(t2)` when looking for zero-candidate territories. This meant an already-satisfied territory (watcher placed) triggered a false "impossible" signal, incorrectly eliminating valid watcher positions. Result: `hasUniqueSolution` returned `true` for puzzles with multiple solutions, and `solveLogically` occasionally produced results on invalid or multi-solution puzzles. All 20 sample puzzles were regenerated after this fix.

- **Territory map gaps (2026-06-01):** Axis-biased BFS territory generation could leave isolated cells unassigned (value `-1`) when bias strength was high. The single-pass greedy fill missed these. Fixed with multi-pass BFS fill and an explicit `-1` cell guard in `generatePuzzle`.

---

## Architecture Constraints (Always)

These apply in every phase and must never be violated:

- Engine has zero knowledge of React, Next.js, SVG, or themes
- All puzzle state flows through the engine — UI only renders
- Every puzzle has a `seed` field from day one
- PlayerProgress stored separately from puzzle definitions
- Theme system (`watcherAsset`, `wardAsset`, `boardStyle`, `colorPalette`) is swappable without touching rules
- Achievement events emitted from gameplay — consumers attached later

---

## Folder Structure

```
/src
  /app
  /components
    Board.tsx
    Cell.tsx
    Watcher.tsx
    Ward.tsx
    HintOverlay.tsx
    GameControls.tsx
  /engine
    boardTypes.ts
    rules.ts
    solver.ts
    generator.ts
    hints.ts
    difficulty.ts
  /data
    samplePuzzles.ts
    dailySeeds.ts
  /theme
    colors.ts
    territoryPalettes.ts
  /assets
    /svg
  /lib
    storage.ts
    randomSeed.ts
```

---

## Difficulty Scale

| Rating      | Techniques Required                                        |
|-------------|------------------------------------------------------------|
| Initiate    | Single candidate                                           |
| Scholar     | Row/column elimination                                     |
| Occultist   | Territory elimination, forced row/col                      |
| High Priest | Pair/group elimination (naked sets)                        |
| Eldritch    | Multi-step chains, heavy group elimination                 |
| Harbinger   | Hidden set elimination (inverse of naked sets)             |
| Archon      | Hypothesis — place, propagate, prove contradiction         |

---

## Hint Voice Examples

> "Study the Crimson territory."

> "This square cannot shelter a Watcher."

> "If a Watcher rose here, the Azure and Ochre territories would seal each other off."

> "This Ward blocks the only refuge left to the Crimson territory."

---

## MVP Checklist

- [ ] Open the app
- [ ] Select a puzzle
- [ ] Place Watchers and Wards
- [ ] Receive a logic-based hint
- [ ] Complete a puzzle
- [ ] Restart or undo
- [ ] Progress saved locally
- [ ] At least 20 valid puzzles available

---

## Notes

- Build engine first, visuals second
- Same solver used for validation, hints, and difficulty scoring
- No guessing — every puzzle solvable by deduction only
- Monetization path exists in architecture but no pressure to activate it

---

## Deduction Technique System

The Eldritch Beacon should not simply provide puzzles and hints. The game should explicitly teach players how to solve puzzles through named, discoverable logical techniques.

---

### Tier 1: Beginner Techniques

These should be enough to solve Easy puzzles.

**Last Refuge** — Difficulty: 1  
A territory has only one possible location remaining. The Watcher must be placed there. Equivalent to a Sudoku Naked Single.

**Full Row** — Difficulty: 1  
A row already contains its Watcher. All remaining cells in that row become Wards.

**Full Column** — Difficulty: 1  
A column already contains its Watcher. All remaining cells in that column become Wards.

**Touching Shadows** — Difficulty: 1  
A placed Watcher blocks all adjacent cells, including diagonals. Those cells become Wards.

---

### Tier 2: Territory Techniques

These should appear in Normal and Hard puzzles.

**Territory Lock** — Difficulty: 2  
A territory can only place its Watcher within a specific row. Therefore no other territory may place a Watcher in that row.

**Column Lock** — Difficulty: 2  
A territory can only place its Watcher within a specific column. Therefore no other territory may place a Watcher in that column.

**Narrow Channel** — Difficulty: 2  
A territory has only a small number of candidates remaining. Those candidates strongly constrain neighboring territories.

**Shared Horizon** — Difficulty: 3  
Multiple territories can only place their Watchers within the same limited group of rows (or columns). Those rows must contain those Watchers — all other territories may eliminate candidates from those rows.  
*Example: Four territories only have candidates within four rows. No other territory may place Watchers in those rows.*

---

### Tier 3: Advanced Techniques

These should appear in Expert puzzles.

**Beacon Pair** — Difficulty: 3  
Two territories share a limited pair of candidate locations. The placement of one directly constrains the other.

**Territory Dead-End** — Difficulty: 3  
Placing a Watcher at this location would immediately eliminate all candidates from another territory, making the board unsolvable. This cell can be eliminated as a Ward without a full hypothesis test — faster and shallower than contradiction testing.

**Dual Confinement** — Difficulty: 3  
A territory's remaining candidates fall within exactly one row and one column simultaneously. The cell at their intersection becomes a forced Watcher placement.

**Mutual Exclusion** — Difficulty: 4  
If Territory A uses a candidate location, Territory B becomes impossible. Therefore Territory A cannot use that candidate.

**Forbidden Tide** — Difficulty: 4  
A candidate appears legal but creates an unavoidable future contradiction. The candidate may be eliminated immediately.

**Territory Network** — Difficulty: 5  
Several territories form a chain of constraints. A deduction in one territory creates deductions in multiple others.

---

### Tier 4: Expert Techniques

These should define Eldritch difficulty puzzles.

**Forced Territory Chain** — Difficulty: 6  
A placement triggers a cascade of forced deductions that ends in contradiction. Unlike a simple contradiction test, the chain passes through multiple territories before failing, requiring depth-2 propagation.  
*Example: Placing A forces B to be the only option for its territory → B forces C → C makes another territory impossible. Therefore A is eliminated.*

**Chain of Madness** — Difficulty: 6  
A multi-step contradiction chain.  
*Example: If Candidate A is true → B must be true → C must be true → puzzle becomes impossible. Therefore A must be false.*

**Deep Current** — Difficulty: 7  
A candidate appears valid. Following the logical consequences reveals that all outcomes eventually fail. The candidate can therefore be eliminated.

**Watcher Network** — Difficulty: 8  
A large interconnected chain of territory constraints. Multiple territories must be analyzed together.

---

### Shattered Realms Techniques

These techniques only appear in Shattered Realms puzzles.

**Broken Territory** — Difficulty: 2  
A color appears in multiple disconnected regions. All matching regions still share a single Watcher.

**Echo Territory** — Difficulty: 3  
Two disconnected islands of the same color behave as one territory. Actions in one island affect the other.

**Phantom Refuge** — Difficulty: 4  
A disconnected island appears to contain valid candidates. However another island of the same color already contains the only possible Watcher. The entire island can be eliminated.

---

### Hint System Integration

Hints should identify the deduction technique being demonstrated.

*Example hint:*  
**Technique:** Shared Horizon  
**Explanation:** These four territories can only place Watchers within these four rows. Therefore all other territories must eliminate candidates from those rows.

The player should be shown the reasoning visually before the move is revealed. Hints should prioritize teaching techniques rather than revealing answers.

---

### Technique Discovery System

Players unlock techniques as they encounter them for the first time.

*Example unlock message:*  
> **New Technique Discovered — Shared Horizon**  
> When several territories are restricted to the same set of rows or columns, those spaces become unavailable to all other territories.

This system functions as an in-game tutorial and knowledge base.

---

### Difficulty Rating System

Puzzle difficulty is determined by the techniques required to solve it. The solver records every technique used during validation; difficulty is generated automatically.

| Technique               | Score |
|-------------------------|-------|
| Last Refuge             | 1     |
| Full Row                | 1     |
| Full Column             | 1     |
| Touching Shadows        | 1     |
| Territory Lock          | 2     |
| Column Lock             | 2     |
| Narrow Channel          | 2     |
| Shared Horizon          | 3     |
| Beacon Pair             | 3     |
| Territory Dead-End      | 3     |
| Dual Confinement        | 3     |
| Mutual Exclusion        | 4     |
| Forbidden Tide          | 4     |
| Territory Network       | 5     |
| Forced Territory Chain  | 6     |
| Chain of Madness        | 6     |
| Deep Current            | 7     |
| Watcher Network         | 8     |

Aggregate technique scores map to difficulty ratings: Initiate → Scholar → Occultist → High Priest → Eldritch.

---

## Future Expansion Mechanic: Impossible Geometry

The Eldritch Beacon should support future puzzle modes that explore impossible geometry and non-Euclidean space.

These mechanics should be treated as advanced expansion content and should not appear in the core onboarding experience.

The goal is to create new logical challenges without introducing randomness or guesswork.

All geometry-based mechanics must remain fully deterministic and solvable through logic.

---

### Design Philosophy

The board should never change unexpectedly during puzzle solving.

Instead, the player's understanding of the board changes.

The puzzle remains fair.

The rules remain consistent.

The geometry is unusual.

This distinction is critical.

The game should never violate player trust.

---

### Wrapped Space

Certain puzzle modes may exist on surfaces that wrap around themselves.

Examples:

* horizontal wrap
* vertical wrap
* full toroidal wrap

The board appears finite.

The space it occupies is not.

---

### Horizontal Wrap

The left and right edges of the board are connected.

Example:

The cell on the far left of a row is adjacent to the cell on the far right of that same row.

Implications:

* Watcher influence crosses the seam.
* Territories may span the seam.
* Rows become continuous loops.

---

### Vertical Wrap

The top and bottom edges of the board are connected.

Implications:

* Columns become continuous loops.
* Watcher influence crosses vertical boundaries.
* Territory layouts become more unusual.

---

### Toroidal Geometry

The board wraps in both directions.

The board effectively behaves as a torus.

Properties:

* no true edges
* no true corners
* all rows loop
* all columns loop

This should be considered one of the most advanced puzzle modes in the game.

---

### Interactive Chart Navigation

Future puzzle modes may allow the player to shift their view of the board.

Example:

Dragging the chart horizontally rotates the visible board.

The board state does not change.

Only the viewing position changes.

Example:

ABCDE

becomes

EABCD

The puzzle remains identical.

The player is simply viewing a different section of the same continuous surface.

---

### Seam Awareness

The UI should clearly communicate when space wraps.

Potential visual approaches:

* matching symbols on opposite edges
* connecting nautical rope motifs
* chart markings
* glowing boundary indicators
* lighthouse beam projections

Players should never be confused about whether wrapping is active.

---

### Geometry-Based Techniques

Future expansions may introduce deduction techniques based on wrapped space.

Examples:

**Looped Horizon**

A deduction involving a row that wraps around itself.

**Endless Current**

A deduction involving a wrapped column.

**Beacon Meridian**

A territory spanning a seam.

**Closed Horizon**

A deduction unique to toroidal space.

---

### Campaign Integration

Impossible geometry should be introduced gradually through lore and environmental storytelling.

Early campaign:

The world appears normal.

Mid campaign:

Subtle inconsistencies appear.

Examples:

* maps that do not align
* repeated floor numbers
* contradictory diagrams

Late campaign:

The player discovers that space around the Beacon does not behave normally.

Only after this realization should geometry-based puzzle modes be introduced.

---

### Lore Interpretation

The Beacon does not distort reality through magic.

Reality simply behaves differently near the Beacon.

Human observers interpret these inconsistencies through familiar concepts such as:

* floors
* rooms
* staircases
* maps

These interpretations are often incorrect.

The player slowly learns that the Beacon cannot be accurately described using conventional geometry.

---

### Expansion Potential

Possible future expansion titles:

* The Drowned Archive
* The Black Tide
* The Endless Shore
* The Beacon's Skin

These expansions may introduce:

* wrapped geometry
* toroidal boards
* impossible territories
* advanced deduction techniques
* new visual storytelling systems

without altering the core puzzle engine.

---

### Design Goal

Impossible geometry should create wonder rather than confusion.

The player should feel:

> "I understand the rules."

while simultaneously feeling:

> "The space itself should not exist."

The challenge comes from learning a new geometry, not from hidden information or changing rules.
