# Spaced-Repetition Flashcards (SM-2)

**Tool 11 of 30 — Building in public.**

A flashcard app that schedules your reviews with the **SM-2 spaced-repetition
algorithm** (the formula behind SuperMemo and Anki). Built with **React +
TypeScript + Vite**. Cards you find easy come back rarely; cards you keep
missing come back fast.

This is the first React/TypeScript project in the 30-tools series — it focuses
on a clean separation between a **pure, fully-tested algorithm core** and a
typed React UI.

---

## What it demonstrates

- **A real algorithm, implemented from scratch.** `src/sm2.ts` is the SM-2
  scheduler: it updates each card's *ease factor*, *repetition count* and
  *interval* from a 0–5 recall grade, with the ease factor floored at 1.3 and a
  lapse (grade < 3) restarting the learning steps. It's a pure function — no
  React, no DOM, no I/O — so it's easy to reason about and test.
- **TypeScript end to end** — discriminated-union view state (`decks | deck |
  study`), typed props, a `Quality = 0|1|2|3|4|5` literal type, and `strict`
  mode with `noUnusedLocals` / `noUnusedParameters` on.
- **React patterns** — a custom `useDecks()` hook that owns state and mirrors it
  to `localStorage`, immutable state updates, `useMemo` for derived counts, and
  a frozen study queue so grading doesn't reshuffle mid-session.
- **Persistence** — decks and progress survive reloads via `localStorage`
  (`src/storage.ts`), with a seeded starter deck on first run.
- **Bulk import** — build a whole deck in seconds by pasting text or uploading a
  `.csv` / `.tsv` / `.txt` file. `src/import.ts` is a pure parser that
  auto-detects the delimiter (tab, `::`, `|`, `;` or comma with basic CSV
  quoting), ignores blank lines and `#` comments, and previews the card count
  live before you commit.
- **Tests** — two dependency-free suites: `src/sm2.test.ts` (24 assertions) for
  the scheduler and `src/import.test.ts` (28 assertions) for the import parser —
  delimiter detection, CSV quoting/escaping, first-delimiter splitting, skipped
  lines and forced delimiters.

## SM-2 in one paragraph

Each card carries `{ repetitions, easeFactor, interval }`. After you grade a
review `0..5`:

- The **ease factor** is nudged by
  `EF + (0.1 − (5 − q)(0.08 + (5 − q)·0.02))`, clamped to ≥ 1.3.
- **Grade < 3** (a lapse): repetitions reset to 0, interval back to 1 day
  (ease factor is kept).
- **Grade ≥ 3**: repetition 1 → 1 day, repetition 2 → 6 days, thereafter
  `interval = round(previous_interval × easeFactor)`.

## Run it

Requires Node 18+. Run each command on its own (don't paste the descriptions
after them — `#` is a comment on macOS/Linux but **not** in Windows CMD).

```bash
npm install
npm run dev
npm run build
npm run preview
npm test
```

| Command | What it does |
| --- | --- |
| `npm install` | install dependencies |
| `npm run dev` | start the Vite dev server (http://localhost:5173) |
| `npm run build` | type-check + production build into `dist/` |
| `npm run preview` | serve the production build locally |
| `npm test` | run the SM-2 test suite (via tsx) |

> `npm test` runs the scheduler suite. Run the import suite with
> `npx tsx src/import.test.ts`.

## Project structure

```
src/
  sm2.ts          # SM-2 scheduling algorithm (pure, framework-agnostic)
  sm2.test.ts     # scheduler test suite (24 assertions)
  import.ts       # bulk-import parser (delimiter auto-detect + CSV)
  import.test.ts  # import parser test suite (28 assertions)
  types.ts        # Card / Deck domain types
  storage.ts      # localStorage load/save + seed deck
  App.tsx         # React UI: deck list, deck detail, import panel, study
  main.tsx        # React entry point
  styles.css      # light/premium styling (pink accent, Google grade colors)
```

## How to use

1. Create a deck and add cards one at a time (front = question, back = answer),
   **or** click **Import** to add many at once.
2. Hit **Study** — reveal each answer, then grade your recall from
   *Blackout* to *Easy*.
3. SM-2 sets each card's next due date. Come back later; only due cards appear.

### Importing cards quickly

Open a deck, click **⬆ Import cards from file or text**, then paste lines or
choose a `.csv` / `.tsv` / `.txt` file. One card per line; the front and back are
separated by any of these (auto-detected):

```
capital of France, Paris
photosynthesis :: plants turning light into energy
H2O | water
mitochondria	the powerhouse of the cell
```

Blank lines and lines starting with `#` are ignored. The panel shows how many
cards were detected (and which separator) before you click **Add**.

---

Part of a 30-day *build in public* series — one tool per day, increasing in
complexity. GitHub: [github.com/w1kicartel](https://github.com/w1kicartel)
