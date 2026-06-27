import { useEffect, useMemo, useRef, useState } from "react";
import type { Card, Deck } from "./types";
import { review, isDue, INITIAL_STATE, type Quality } from "./sm2";
import { loadDecks, saveDecks, uid } from "./storage";
import { parseCards, type ParsedCard } from "./import";

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

/** Build a fresh, never-reviewed Card from a front/back pair. */
function makeCard(front: string, back: string): Card {
  return {
    id: uid(),
    front,
    back,
    schedule: { ...INITIAL_STATE },
    dueDate: 0,
    createdAt: Date.now(),
  };
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
                  ? { ...d, cards: [...d.cards, makeCard(front, back)] }
                  : d
              )
            )
          }
          onImportCards={(parsed) =>
            setDecks((ds) =>
              ds.map((d) =>
                d.id === activeDeck.id
                  ? {
                      ...d,
                      cards: [
                        ...d.cards,
                        ...parsed.map((p) => makeCard(p.front, p.back)),
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
  onImportCards: (cards: ParsedCard[]) => void;
  onDeleteCard: (id: string) => void;
}) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [showImport, setShowImport] = useState(false);
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
        <button className="primary" disabled={due === 0} onClick={props.onStudy}>
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

      <div className="import-bar">
        <button
          className="ghost"
          onClick={() => setShowImport((s) => !s)}
          aria-expanded={showImport}
        >
          {showImport ? "Close import" : "⬆ Import cards from file or text"}
        </button>
      </div>

      {showImport && (
        <ImportPanel
          onImport={(cards) => {
            props.onImportCards(cards);
            setShowImport(false);
          }}
        />
      )}

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

/* ----------------------------- Import panel ---------------------------- */

const IMPORT_PLACEHOLDER = `Paste one card per line. Front and back separated by a tab, comma, ; | or ::

capital of France, Paris
photosynthesis :: plants turning light into energy
H2O | water`;

const DELIMITER_LABEL: Record<string, string> = {
  "\t": "Tab",
  "::": "::",
  "|": "Pipe |",
  ";": "Semicolon ;",
  ",": "Comma ,",
};

function ImportPanel(props: { onImport: (cards: ParsedCard[]) => void }) {
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Re-parse live so the user sees how many cards they'll get.
  const result = useMemo(() => parseCards(text), [text]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  return (
    <section className="import-panel">
      <div className="import-actions">
        <button className="ghost" onClick={() => fileRef.current?.click()}>
          Choose file (.csv, .tsv, .txt)
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt,text/plain,text/csv"
          onChange={onFile}
          hidden
        />
        <span className="hint">…or paste below</span>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={IMPORT_PLACEHOLDER}
        rows={8}
        aria-label="Cards to import"
      />

      <div className="import-footer">
        <span className="preview">
          {result.cards.length > 0 ? (
            <>
              <strong>{result.cards.length}</strong> card
              {result.cards.length === 1 ? "" : "s"} detected · separator:{" "}
              {DELIMITER_LABEL[result.delimiter]}
              {result.skipped > 0 && ` · ${result.skipped} line(s) skipped`}
            </>
          ) : (
            "No cards detected yet"
          )}
        </span>
        <button
          className="primary"
          disabled={result.cards.length === 0}
          onClick={() => props.onImport(result.cards)}
        >
          Add {result.cards.length || ""} card
          {result.cards.length === 1 ? "" : "s"}
        </button>
      </div>
    </section>
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
