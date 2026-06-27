import type { Deck } from "./types";
import { INITIAL_STATE } from "./sm2";

const STORAGE_KEY = "srs-flashcards:v1";

/** Generate a reasonably unique id without external deps. */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** A small starter deck so the app is useful on first load. */
export function seedDecks(): Deck[] {
  const make = (front: string, back: string) => ({
    id: uid(),
    front,
    back,
    schedule: { ...INITIAL_STATE },
    dueDate: 0,
    createdAt: Date.now(),
  });
  return [
    {
      id: uid(),
      name: "TypeScript basics",
      cards: [
        make("What does `keyof` do?", "Produces a union of a type's property names."),
        make("`unknown` vs `any`?", "`unknown` is type-safe: you must narrow it before use."),
        make("What is a discriminated union?", "A union whose members share a literal 'tag' field used to narrow."),
      ],
    },
  ];
}

/** Load decks from localStorage, falling back to a seed deck. */
export function loadDecks(): Deck[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedDecks();
    const parsed = JSON.parse(raw) as Deck[];
    if (!Array.isArray(parsed)) return seedDecks();
    return parsed;
  } catch {
    return seedDecks();
  }
}

/** Persist decks to localStorage. */
export function saveDecks(decks: Deck[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
  } catch {
    // Storage may be unavailable (private mode / quota) — fail silently.
  }
}
