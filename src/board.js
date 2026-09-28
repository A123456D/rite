/* The global RITE board: opt-in weekly bragging rights, hosted on the skitz
   hub's KV. Fail-soft everywhere — the app is fully usable offline. */

const BOARD_URL = "https://skitz-games.pages.dev/api/rite/board";
const ID_KEY = "rite-board-client";

export function boardName() {
  try {
    return localStorage.getItem("rite-board-name") || "";
  } catch {
    return "";
  }
}

export function setBoardName(name) {
  try {
    localStorage.setItem("rite-board-name", String(name || "").slice(0, 16));
  } catch {}
}

export function clientId() {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export async function publishWeek(entry) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(BOARD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entry, client: clientId() }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return { ok: true, board: data.board || [], rank: data.rank };
  } catch {
    clearTimeout(timer);
    return { ok: false, offline: true };
  }
}

export async function fetchBoard() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(BOARD_URL, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}
