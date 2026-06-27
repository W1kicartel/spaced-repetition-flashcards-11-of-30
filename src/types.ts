import type { ReviewState } from "./sm2";

/** A single flashcard plus its SM-2 scheduling metadata. */
export interface Card {
  id: string;
  front: string;
  back: string;
  /** SM-2 learning state. */
  schedule: ReviewState;
  /** Next due date as ms since epoch. 0 means "new / due now". */
  dueDate: number;
  /** Creation timestamp (ms since epoch). */
  createdAt: number;
}

/** A named collection of cards. */
export interface Deck {
  id: string;
  name: string;
  cards: Card[];
}
