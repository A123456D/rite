function makeSprite(stops) {
  const s = document.createElement("canvas");
  s.width = s.height = 128;
  const c = s.getContext("2d");
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [t, col] of stops) g.addColorStop(t, col);
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  return s;
}

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function rgbaHex(hex, a) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

function gauss() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function createFlame(canvas) {
  const accent = cssVar("--ember", "#ff5500");
  const accent2 = cssVar("--ember-2", "#d34000");
  const hot = cssVar("--hot", "#ffb060");
  const plate = cssVar("--charcoal", "#161210");
  const SPRITE_CORE = makeSprite([
    [0, rgbaHex(hot, 1)],
    [0.12, rgbaHex(accent, 0.9)],
    [0.28, rgbaHex(accent, 0.7)],
    [0.5, rgbaHex(accent2, 0.32)],
    [0.74, rgbaHex(accent2, 0.08)],
    [1, rgbaHex(accent2, 0)],
  ]);
  const SPRITE_EMBER = makeSprite([
    [0, rgbaHex(hot, 1)],
    [0.18, rgbaHex(accent, 0.8)],
    [0.4, rgbaHex(accent2, 0.4)],
    [0.64, rgbaHex(accent2, 0.12)],
    [1, rgbaHex(accent2, 0)],
  ]);
  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  const MAX = 120;
  const particles = Array.from({ length: MAX }, () => ({
    live: false,
    kind: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    decay: 0.02,
    r: 8,
  }));

  let heat = 50;
  let raf = 0;
  let cssW = 1;
  let cssH = 1;
  let dpr = 1;

  function origin() {
    return { cx: cssW * 0.5, cy: cssH * 0.55 };
  }

  function birth(p, age) {
    const h = Math.max(0.12, heat / 100);
    const { cx, cy } = origin();
    const core = Math.random() < 0.32;
    p.live = true;
    p.kind = core ? 0 : 1;
    p.x = cx + gauss() * (8 + h * 16);
    p.y = cy + gauss() * (7 + h * 12);
    if (core) {
      p.vx = gauss() * 0.08;
      p.vy = -0.05 - Math.random() * 0.14 * h;
      p.r = 22 + Math.random() * (16 + h * 18);
      p.decay = 0.007 + Math.random() * 0.006;
    } else {
      p.vx = gauss() * (0.22 + h * 0.2);
      p.vy = -(0.25 + Math.random() * (0.7 + h * 1.1));
      p.r = 4 + Math.random() * (5 + h * 6);
      p.decay = 0.012 + Math.random() * 0.014;
    }
    p.life = 1 - Math.min(0.6, age || 0);
  }

  function spawn(n) {
    let left = n;
    for (let i = 0; i < MAX && left > 0; i++) {
      if (particles[i].live) continue;
      birth(particles[i], 0);
      left--;
    }
  }

  function warm() {
    const n = 55 + Math.floor((heat / 100) * 30);
    for (let i = 0; i < n && i < MAX; i++) birth(particles[i], Math.random() * 0.55);
  }

  function step() {
    const h = heat / 100;
    spawn(1 + Math.floor(h * 3));
    const { cx, cy } = origin();
    for (let i = 0; i < MAX; i++) {
      const p = particles[i];
      if (!p.live) continue;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.kind === 0) {
        p.x += (cx - p.x) * 0.02;
        p.y += (cy - p.y) * 0.018;
      }
      if (p.life <= 0) p.live = false;
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = plate;
    ctx.fillRect(0, 0, cssW, cssH);
    const h = Math.max(0.12, heat / 100);
    const { cx, cy } = origin();
    ctx.globalCompositeOperation = "lighter";

    const haloR = 62 + h * 28;
    ctx.globalAlpha = 0.55 + h * 0.25;
    ctx.drawImage(SPRITE_EMBER, cx - haloR, cy - haloR, haloR * 2, haloR * 2);

    const coreR = 26 + h * 16;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(SPRITE_CORE, cx - coreR, cy - coreR, coreR * 2, coreR * 2);

    for (let i = 0; i < MAX; i++) {
      const p = particles[i];
      if (!p.live) continue;
      const a = Math.max(0, p.life);
      const r = p.r * (0.55 + a * 0.55);
      ctx.globalAlpha = a * (p.kind === 0 ? 0.55 : 0.85);
      const spr = p.kind === 0 ? SPRITE_CORE : SPRITE_EMBER;
      ctx.drawImage(spr, p.x - r, p.y - r, r * 2, r * 2);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cssW = Math.max(1, canvas.clientWidth);
    cssH = Math.max(1, canvas.clientHeight);
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    warm();
  }

  function tick() {
    step();
    draw();
    raf = requestAnimationFrame(tick);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  tick();

  return {
    setHeat(v) {
      heat = v;
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
    },
  };
}
