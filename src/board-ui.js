/* The global board card in Self. Kept as its own module so the app.js
   template surgery stays simple. */
import { publishWeek, fetchBoard, boardName, setBoardName } from "./board.js";

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderBoardList(list, board) {
  if (!list) return;
  list.innerHTML = board.length
    ? board
        .slice(0, 10)
        .map(
          (e, i) =>
            `<div class="row"><div><strong>${i + 1}. ${esc(e.name)}</strong><div class="meta">${esc(e.tier)} · ${e.avgDelta >= 0 ? "+" : ""}${e.avgDelta} avg · ${e.streak}d streak</div></div><b class="${e.avgDelta >= 0 ? "up" : "down"}">${e.avgDelta >= 0 ? "+" : ""}${e.avgDelta}</b></div>`
        )
        .join("")
    : `<p class="tiny">Nobody has published yet. Be first.</p>`;
}

export function drawBoardCard(card, ctx) {
  if (!card) return;
  const { weeks, streak, rankName } = ctx;
  card.innerHTML = `<header class="kicker">The board</header><div id="board-body"></div>`;
  const body = card.querySelector("#board-body");
  const w = weeks[0];
  body.innerHTML = `
    <p class="lede">Opt in and compare week verdicts with everyone on RITE. Only a name, tier, and numbers are stored.</p>
    <div class="field"><label>Your name on the board</label><input id="board-name" maxlength="16" value="${esc(boardName())}" placeholder="3-16 characters" /></div>
    <div class="week-actions"><button class="btn ghost" id="board-publish" type="button">Publish this week</button></div>
    <p class="tiny" id="board-status"></p>
    <div class="list" id="board-list"><p class="tiny">Loading the board…</p></div>`;
  if (!w) {
    const btn = body.querySelector("#board-publish");
    btn.disabled = true;
    body.querySelector("#board-status").textContent = "Settle your first week to join.";
    return;
  }
  const nameInput = body.querySelector("#board-name");
  nameInput.oninput = (e) => setBoardName(e.target.value);
  const status = body.querySelector("#board-status");
  body.querySelector("#board-publish").onclick = async () => {
    const name = boardName().trim();
    if (name.length < 3) {
      status.textContent = "Pick a name first (3+ characters).";
      return;
    }
    status.textContent = "Publishing…";
    const res = await publishWeek({
      name,
      avgDelta: w.stats.avgDelta,
      tier: w.tier,
      streak,
      rank: rankName,
      xp: ctx.xp,
    });
    if (res.ok) {
      status.textContent = `Published — you're #${res.rank} this week.`;
      renderBoardList(body.querySelector("#board-list"), res.board);
    } else if (res.offline) {
      status.textContent = "Offline — try again later.";
    } else {
      status.textContent = "The board rejected that. Check the name.";
    }
  };
  fetchBoard().then((data) => {
    if (data && data.board) renderBoardList(body.querySelector("#board-list"), data.board);
  });
}
