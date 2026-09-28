/* The weekly verdict as a shareable image: dark instrument card, tier stamp,
   the mark, and the numbers. Canvas-rendered with the app's own webfonts,
   then handed to the share sheet (or downloaded where sharing files isn't
   supported). */

const TIER_COLORS = {
  Blaze: "#ff5500",
  Burn: "#ff8a3d",
  Smolder: "#ffb060",
  Ash: "#9c948a",
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawMark(ctx, cx, cy, r) {
  const stroke = Math.round(r * 0.24);
  // track
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = stroke;
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  // 270° gauge arc from the top, ember gradient
  const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, "#d34000");
  grad.addColorStop(0.55, "#ff5500");
  grad.addColorStop(1, "#ffb060");
  ctx.beginPath();
  ctx.strokeStyle = grad;
  ctx.lineCap = "round";
  ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI, false);
  ctx.stroke();
  // molten core
  const core = ctx.createRadialGradient(cx - r * 0.22, cy - r * 0.3, r * 0.1, cx, cy, r * 0.62);
  core.addColorStop(0, "#ffe8c4");
  core.addColorStop(0.45, "#ffb060");
  core.addColorStop(1, "#f04e00");
  ctx.beginPath();
  ctx.fillStyle = core;
  ctx.arc(cx, cy, r * 0.58, 0, Math.PI * 2);
  ctx.fill();
}

function wrap(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function loadFonts() {
  const faces = [
    '700 140px Outfit',
    '600 44px Outfit',
    "italic 52px 'Instrument Serif'",
    "italic 38px 'Instrument Serif'",
    '800 40px Manrope',
    '600 34px Manrope',
  ];
  try {
    await Promise.all(faces.map((f) => document.fonts.load(f)));
    await document.fonts.ready;
  } catch {}
}

export async function buildWeekCard(record, meta = {}) {
  await loadFonts();
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const glow = TIER_COLORS[record.tier] || "#ff5500";

  // sky
  ctx.fillStyle = "#070605";
  ctx.fillRect(0, 0, W, H);
  const sky = ctx.createRadialGradient(W / 2, 140, 40, W / 2, 140, 900);
  sky.addColorStop(0, `${glow}2b`);
  sky.addColorStop(1, "#07060500");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // wordmark
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 40px Manrope";
  try {
    ctx.letterSpacing = "16px";
  } catch {}
  ctx.fillText("RITE", W / 2 + 8, 116);
  try {
    ctx.letterSpacing = "0px";
  } catch {}
  ctx.fillStyle = glow;
  roundRect(ctx, W / 2 - 44, 138, 88, 6, 3);
  ctx.fill();

  // the mark
  drawMark(ctx, W / 2, 420, 205);

  // tier + headline
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 138px Outfit";
  ctx.fillText(record.tier, W / 2, 826);
  ctx.fillStyle = "#e8c39a";
  ctx.font = "italic 54px 'Instrument Serif'";
  ctx.fillText(record.headline, W / 2, 918);

  // delta
  const delta = record.stats.avgDelta;
  ctx.fillStyle = delta >= 0 ? "#c6f54a" : "#ff4d4d";
  ctx.font = "700 116px Outfit";
  ctx.fillText(`${delta >= 0 ? "+" : ""}${delta}`, W / 2 - 10, 1064);
  ctx.fillStyle = "#8f867c";
  ctx.font = "600 30px Manrope";
  try {
    ctx.letterSpacing = "7px";
  } catch {}
  ctx.fillText("AVG HEAT", W / 2, 1112);
  try {
    ctx.letterSpacing = "0px";
  } catch {}

  // divider
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(W / 2 - 300, 1150, 600, 2);

  // stats + streak
  const s = record.stats;
  ctx.fillStyle = "#8f867c";
  ctx.font = "600 33px Manrope";
  ctx.fillText(
    `${s.proteinHits}/${s.days} protein · ${s.trainedDays}/${s.days} trained · ${s.avgKcal.toLocaleString()} kcal`,
    W / 2,
    1214
  );
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "500 27px Manrope";
  ctx.fillText(
    `+${record.xpBonus} XP banked${meta.streak ? ` · streak ${meta.streak}d` : ""} · ends ${record.endDay}`,
    W / 2,
    1268
  );
  ctx.fillText("skitz-games.pages.dev/apps/rite", W / 2, 1320);

  return canvas;
}

export async function shareWeekCard(record, meta = {}) {
  const canvas = await buildWeekCard(record, meta);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return "failed";
  const file = new File([blob], `rite-week-${record.endDay}.png`, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "RITE — week verdict" });
      return "shared";
    } catch (err) {
      if (err && err.name === "AbortError") return "cancelled";
      // fall through to download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rite-week-${record.endDay}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}
