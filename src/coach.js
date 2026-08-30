import {
  who,
  greet,
  empty,
  over,
  under,
  skip,
  protein,
  late,
  cutOver,
  bulkUnder,
  recompMiss,
  hype,
  compliments,
  jokes,
  mixed,
  lowHeat,
  highHeat,
  streak as streakLines,
  heatCaptions,
  morningHot,
  morningCold,
  morningBeige,
} from "./ash-lines.js";

const recent = [];

function pick(arr) {
  if (!arr?.length) return "";
  const blocked = new Set(recent);
  const pool = arr.filter((x) => !blocked.has(x));
  const source = pool.length ? pool : arr;
  const text = source[Math.floor(Math.random() * source.length)];
  recent.push(text);
  if (recent.length > 16) recent.shift();
  return text;
}

function pickWho(tone) {
  return pick(who[tone] || who.idle);
}

function proteinRatio(tot, t) {
  return t?.protein ? tot.protein / t.protein : 1;
}

export function greeting() {
  return pick(greet);
}

export function lineForLive(ctx) {
  const tot = ctx.tot || { kcal: 0, protein: 0 };
  const t = ctx.t || { kcal: 1, protein: 1 };
  const trained = Boolean(ctx.trained);
  const ratio = t.kcal ? tot.kcal / t.kcal : 0;
  const pRatio = proteinRatio(tot, t);
  const heat = ctx.heat ?? 50;
  const streak = ctx.streak || 0;
  const goal = ctx.goal || "recomp";
  const hour = ctx.hour ?? new Date().getHours();
  const jokeRoll = Math.random();

  if (tot.kcal < 80) {
    if (heat < 28) return { tone: "roast", who: pickWho("roast"), text: pick(lowHeat) };
    if (streak >= 4) return { tone: "mixed", who: pickWho("mixed"), text: pick(streakLines) };
    return { tone: "idle", who: pickWho("idle"), text: pick(greet) };
  }

  if (ratio > 1.22) {
    const pool = goal === "cut" ? [...over, ...cutOver] : over;
    return { tone: "roast", who: pickWho("roast"), text: pick(pool) };
  }

  if (ratio < 0.52 && tot.kcal > 180) {
    const pool = goal === "bulk" ? [...under, ...bulkUnder] : under;
    return { tone: "roast", who: pickWho("roast"), text: pick(pool) };
  }

  if (hour >= 21 && ratio > 1.06) {
    return { tone: "roast", who: pickWho("roast"), text: pick(late) };
  }

  if (!trained && tot.kcal > t.kcal * 0.48) {
    if (goal === "recomp" && Math.random() < 0.45) {
      return { tone: "roast", who: pickWho("roast"), text: pick(recompMiss) };
    }
    return { tone: "roast", who: pickWho("roast"), text: pick(skip) };
  }

  if (pRatio < 0.55 && tot.kcal > 350) {
    return { tone: "roast", who: pickWho("roast"), text: pick(protein) };
  }

  if (goal === "recomp" && (pRatio < 0.75 || !trained) && ratio > 0.6 && ratio < 1.15 && Math.random() < 0.35) {
    return { tone: "mixed", who: pickWho("mixed"), text: pick(recompMiss) };
  }

  const onTrack =
    ratio >= 0.85 &&
    ratio <= 1.1 &&
    pRatio >= 0.85;
  const cleanHit = onTrack && trained;

  if (cleanHit && streak >= 5 && Math.random() < 0.5) {
    return { tone: "hype", who: pickWho("hype"), text: pick(streakLines) };
  }

  if (cleanHit && heat >= 78 && Math.random() < 0.55) {
    return { tone: "hype", who: pickWho("hype"), text: pick(highHeat) };
  }

  if (cleanHit) {
    const pool = jokeRoll < 0.18 ? jokes : jokeRoll < 0.45 ? compliments : hype;
    return { tone: "hype", who: pickWho("hype"), text: pick(pool) };
  }

  if (onTrack && !trained) {
    return { tone: "mixed", who: pickWho("mixed"), text: pick([...mixed, ...skip.slice(0, 8)]) };
  }

  if (heat < 32 && Math.random() < 0.4) {
    return { tone: "roast", who: pickWho("roast"), text: pick(lowHeat) };
  }

  if (heat >= 82 && ratio > 1.08) {
    return { tone: "roast", who: pickWho("roast"), text: pick(highHeat) };
  }

  if (jokeRoll < 0.22) {
    return { tone: "mixed", who: pickWho("mixed"), text: pick(jokes) };
  }

  return { tone: "mixed", who: pickWho("mixed"), text: pick(mixed) };
}

export function verdictCopy(result, extra = {}) {
  const bits = [];
  const goal = extra.goal || "recomp";
  const tot = result.tot || { kcal: 0, protein: 0 };

  if (tot.kcal === 0) bits.push(pick(empty));
  else if (result.cal <= -0.8) bits.push(pick(goal === "cut" ? [...over, ...cutOver] : over));
  else if (result.cal < 0 && result.over < 0) bits.push(pick(goal === "bulk" ? [...under, ...bulkUnder] : under));
  if (!result.trained && tot.kcal > 0) bits.push(pick(skip));
  if (!result.proteinHit && tot.kcal > 200) bits.push(pick(protein));
  if (result.delta >= 10) bits.push(pick(Math.random() < 0.4 ? compliments : hype));
  if (result.delta <= -10 && extra.heat < 40) bits.push(pick(lowHeat));
  if (!bits.length) bits.push(pick(mixed));

  const headline =
    result.delta >= 12
      ? "VERDICT: STOKED"
      : result.delta >= 4
        ? "VERDICT: ALIVE"
        : result.delta > -4
          ? "VERDICT: LUKEWARM"
          : result.delta > -12
            ? "VERDICT: SLIPPING"
            : "VERDICT: EMBERS";

  const unique = [...new Set(bits)].slice(0, 2);
  return { headline, body: unique.join(" ") };
}

export function heatCaption(heat) {
  if (heat >= 88) return pick(heatCaptions.nuclear);
  if (heat >= 72) return pick(heatCaptions.hot);
  if (heat >= 55) return pick(heatCaptions.lit);
  if (heat >= 38) return pick(heatCaptions.warm);
  if (heat >= 20) return pick(heatCaptions.cool);
  return pick(heatCaptions.ash);
}

export function morningFrom(entry) {
  if (!entry) return null;
  if (entry.delta >= 4) {
    return { tone: "hype", who: "Ash · Yesterday still counts", text: pick(morningHot) };
  }
  if (entry.delta <= -4) {
    return { tone: "roast", who: "Ash · Yesterday left a bruise", text: pick(morningCold) };
  }
  return { tone: "mixed", who: "Ash · Yesterday was beige", text: pick(morningBeige) };
}
