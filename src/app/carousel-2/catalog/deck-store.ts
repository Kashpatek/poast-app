// Carousel 2.0 · deck persistence (make-flow).
//
// Decks live in the same IndexedDB database as the catalog cache
// (poast-carousel-2) but in their own `decks` store. LOCAL-ONLY — no Neon /
// /api/db writes (a deck is the user's work-in-progress, mirroring the
// design-studio autosave pattern). A sentinel key tracks the last-open deck so
// the studio can auto-resume.

"use client";

import localforage from "localforage";
import type { Deck } from "./types";

let deckDb: LocalForage | null = null;
function db(): LocalForage {
  if (!deckDb) deckDb = localforage.createInstance({ name: "poast-carousel-2", storeName: "decks" });
  return deckDb;
}

const CURRENT_KEY = "__current__";

export async function saveDeck(deck: Deck): Promise<void> {
  try {
    await db().setItem(deck.id, deck);
    await db().setItem(CURRENT_KEY, deck.id);
  } catch {
    /* quota / private mode — autosave is best-effort */
  }
}

export async function loadDeck(id: string): Promise<Deck | null> {
  try {
    return (await db().getItem<Deck>(id)) || null;
  } catch {
    return null;
  }
}

export async function loadCurrentDeck(): Promise<Deck | null> {
  try {
    const id = await db().getItem<string>(CURRENT_KEY);
    return id ? await loadDeck(id) : null;
  } catch {
    return null;
  }
}

export async function listDecks(): Promise<Deck[]> {
  const out: Deck[] = [];
  try {
    await db().iterate<Deck, void>((v, k) => {
      if (k !== CURRENT_KEY && v && Array.isArray((v as Deck).slides)) out.push(v as Deck);
    });
  } catch {
    /* ignore */
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteDeck(id: string): Promise<void> {
  try {
    await db().removeItem(id);
    const cur = await db().getItem<string>(CURRENT_KEY);
    if (cur === id) await db().removeItem(CURRENT_KEY);
  } catch {
    /* ignore */
  }
}
