import { useEffect, useMemo, useState } from "react";
import type { Card, Deck } from "./types";
import { review, isDue, type Quality } from "./sm2";
import { loadDecks, saveDecks, uid } from "./storage";
import { INITIAL_STATE } from "./sm2";

/**
 * useDecks — a tiny custom hook that owns the decks state and keeps it
 * mirrored to localStorage. Components below stay presentational.
 */
function useDecks() {
  const [decks, setDecks] = useState<Deck[]>(() => loadDecks());

  useEffect(() => {
    saveDecks(decks);
  }, [decks]);

  return [decks, setDecks] as const;
}

/** Cards in a deck that are due for review right now. */
function dueCards(deck: Deck, now: number): Card[] {
  return deck.cards.filter((c) => c.dueDate === 0 || isDue(c.dueDate, now));
}

type View =
  | { kind: "decks" }
  | { kind: "deck"; deckId: string }
  | { kind: "study"; deckId: string };

export function App() {
  const [decks, setDecks] = useDecks();
  const [view, setView] = useState<View>({ kind: "decks" });

  const activeDeck =
    view.kind !== "decks"
      ? decks.find((d) => d.id === view.deckId) ?? null
      : null;

  // If a deck disappears (deleted) while viewing it, bounce home.
  useEffect(() => {
    if (view.kind !== "decks" && !activeDeck) setView({ kind: "decks" });
  }, [view, activeDeck]);

  return (
    <div className="app">
      <header className="topbar">
        <h1 onClick={() => setView({ kind: "decks" })}>🃏 Flashcards</h1>
        <span className="tagline">spaced repetition · SM-2</span>
      </header>

      {view.kind === "decks" && (
        <DeckList
          decks={decks}
          onOpen={(id) => setView({ kind: "deck", deckId: id })}
          onCreate={(name) =>
            setDecks((ds) => [...ds, { id: uid(), name, cards: [] }])
          }
          onDelete={(id) => setDecks((ds) => ds.filter((d) => d.id !== id))}
        />
      )}

      {view.kind === "deck" && activeDeck && (
        <DeckDetail
          deck={activeDeck}
          onBack={() => setView({ kind: "decks" })}
          onStudy={() => setView({ kind: "study", deckId: activeDeck.id })}
          onAddCard={(front, back) =>
            setDecks((ds) =>
              ds.map((d) =>
                d.id === activeDeck.id
                  ? {
                      ...d,
                      cards: [
                        ...d.cards,
                        {
                          id: uid(),
                          front,
                          back,
                          schedule: { ...INITIAL_STATE },
                          dueDate: 0,
                          createdAt: Date.now(),
                        },
                      ],
                    }
                  : d
              )
            )
          }
          onDeleteCard={(cardId) =>
            setDecks((ds) =>
              ds.map((d) =>
                d.id === activeDeck.id
                  ? { ...d, cards: d.cards.filter((c) => c.id !== cardId) }
                  : d
              )
            )
          }
        />
      )}

      {view.kind === "study" && activeDeck && (
        <StudySession
          deck={activeDeck}
          onExit={() => setView({ kind: "deck", deckId: activeDeck.id })}
          onGrade={(cardId, quality) =>
            setDecks((ds) =>
              ds.map((d) =>
                d.id !== activeDeck.id
                  ? d
                  : {
                      ...d,
                      cards: d.cards.map((c) => {
                        if (c.id !== cardId) return c;
                        const schedule = review(c.schedule, quality);
                        const dueDate =
                          Date.now() + schedule.interval * 86_400_000;
                        return { ...c, schedule, dueDate };
                      }),
                    }
              )
            )
          }
        />
      )}

      <footer className="footer">
        Tool 11 of 30 · built in public ·{" "}
        <a href="https://github.com/w1kicartel" target="_blank" rel="noreferrer">
          github.com/w1kicartel
        </a>
      </footer>
    </div>
  );
}

/* ----------------------------- Deck list ------------------------------- */

function DeckList(props: {
  decks: Deck[];
  onOpen: (id: string) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const now = Date.now();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    props.onCreate(trimmed);
    setName("");
  };

  return (
    <main>
      <form className="row" onSubmit={submit}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New deck name…"
          aria-label="New deck name"
        />
        <button type="submit">Add deck</button>
      </form>

      {props.decks.length === 0 && (
        <p className="empty">No decks yet — create one above.</p>
      )}

      <ul className="deck-grid">
        {props.decks.map((d) => {
          const due = dueCards(d, now).length;
          return (
            <li key={d.id} className="deck-card">
              <button className="deck-open" onClick={() => props.onOpen(d.id)}>
                <strong>{d.name}</strong>
                <span className="meta">
                  {d.cards.length} cards
                  {due > 0 && <em className="badge">{due} due</em>}
                </span>
              </button>
              <button
                className="icon danger"
                title="Delete deck"
                onClick={() => props.onDelete(d.id)}
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

/* ---------------------------- Deck detail ------------------------------ */

function DeckDetail(props: {
  deck: Deck;
  onBack: () => void;
  onStudy: () => void;
  onAddCard: (front: string, back: string) => void;
  onDeleteCard: (id: string) => void;
}) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const due = useMemo(() => dueCards(props.deck, Date.now()).length, [props.deck]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;
    props.onAddCard(front.trim(), back.trim());
    setFront("");
    setBack("");
  };

  return (
    <main>
      <div className="row spread">
        <button className="link" onClick={props.onBack}>
          ← All decks
        </button>
        <button
          className="primary"
          disabled={due === 0}
          onClick={props.onStudy}
        >
          {due > 0 ? `Study ${due} due` : "Nothing due"}
        </button>
      </div>

      <h2>{props.deck.name}</h2>

      <form className="card-form" onSubmit={submit}>
        <input
          value={front}
          onChange={(e) => setFront(e.target.value)}
          placeholder="Front (question)"
          aria-label="Card front"
        />
        <input
          value={back}
          onChange={(e) => setBack(e.target.value)}
          placeholder="Back (answer)"
          aria-label="Card back"
        />
        <button type="submit">Add card</button>
      </form>

      <ul className="card-list">
        {props.deck.cards.map((c) => (
          <li key={c.id}>
            <div className="card-text">
              <span className="front">{c.front}</span>
              <span className="back">{c.back}</span>
            </div>
            <div className="card-stats">
              <span title="ease factor">EF {c.schedule.easeFactor.toFixed(2)}</span>
              <span title="interval (days)">{c.schedule.interval}d</span>
              <button
                className="icon danger"
                onClick={() => props.onDeleteCard(c.id)}
                title="Delete card"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

/* --------------------------- Study session ----------------------------- */

const GRADES: { q: Quality; label: string; hint: string }[] = [
  { q: 0, label: "Blackout", hint: "no idea" },
  { q: 2, label: "Hard", hint: "wrong, but familiar" },
  { q: 3, label: "OK", hint: "correct, effort" },
  { q: 4, label: "Good", hint: "correct" },
  { q: 5, label: "Easy", hint: "instant" },
];

function StudySession(props: {
  deck: Deck;
  onExit: () => void;
  onGrade: (cardId: string, q: Quality) => void;
}) {
  // Freeze the queue when the session starts so grading doesn't reshuffle it.
  const [queue] = useState<string[]>(() =>
    dueCards(props.deck, Date.now()).map((c) => c.id)
  );
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const cardId = queue[index];
  const card = props.deck.cards.find((c) => c.id === cardId);

  if (!card || index >= queue.length) {
    return (
      <main className="study done">
        <h2>🎉 Session complete</h2>
        <p>You reviewed {queue.length} card{queue.length === 1 ? "" : "s"}.</p>
        <button className="primary" onClick={props.onExit}>
          Back to deck
        </button>
      </main>
    );
  }

  const grade = (q: Quality) => {
    props.onGrade(card.id, q);
    setRevealed(false);
    setIndex((i) => i + 1);
  };

  return (
    <main className="study">
      <div className="progress">
        Card {index + 1} / {queue.length}
        <button className="link" onClick={props.onExit}>
          End session
        </button>
      </div>

      <div className={`flashcard ${revealed ? "flipped" : ""}`}>
        <div className="face">{card.front}</div>
        {revealed && <div className="face answer">{card.back}</div>}
      </div>

      {!revealed ? (
        <button className="primary big" onClick={() => setRevealed(true)}>
          Show answer
        </button>
      ) : (
        <div className="grades">
          {GRADES.map((g) => (
            <button key={g.q} onClick={() => grade(g.q)} title={g.hint}>
              <strong>{g.label}</strong>
              <small>{g.hint}</small>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
