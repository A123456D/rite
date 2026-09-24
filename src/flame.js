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
  const theme = document.documentElement.dataset.theme;
  const hudMode = theme === "hud";
  // Additive glow is invisible on light paper — light themes composite normally.
  const lightMode = theme === "sketch" || theme === "aura";
  const la = lightMode ? 1.7 : 1; // alpha boost: no additive glow on white paper
  const t0 = performance.now();
  const rgba = rgbaHex;
  const hotColor = hot;
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

  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = plate;
    ctx.fillRect(0, 0, cssW, cssH);
    const h = Math.max(0.12, heat / 100);
    const { cx, cy } = origin();
    // Additive glow is invisible-ish on light paper: channels clamp to white.
    // Light themes composite normally so ink/watercolor colors stay true.
    ctx.globalCompositeOperation = lightMode ? "source-over" : "lighter";

    if (hudMode) {
      drawOrb(now, h, cx, cy);
    } else {
      drawEmber(h, cx, cy);
    }

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

  function drawEmber(h, cx, cy) {
    const haloR = 62 + h * 28;
    ctx.globalAlpha = 0.55 + h * 0.25;
    ctx.drawImage(SPRITE_EMBER, cx - haloR, cy - haloR, haloR * 2, haloR * 2);

    const coreR = 26 + h * 16;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(SPRITE_CORE, cx - coreR, cy - coreR, coreR * 2, coreR * 2);
  }

  // HUD plasma orb: layered radial gradients, a wobbling energy rim, and two
  // rotating arcs. All colors come from the theme vars sampled at creation,
  // and everything scales with heat — no raster involved.
  function drawOrb(now, h, cx, cy) {
    const t = ((now || performance.now()) - t0) / 1000;
    const R = Math.min(cssW, cssH) * (0.24 + h * 0.15);
    const oy = cy + cssH * 0.12;

    let g = ctx.createRadialGradient(cx, oy, R * 0.2, cx, oy, R * 2.4);
    g.addColorStop(0, rgba(accent, Math.min(1, (0.2 + h * 0.22) * la)));
    g.addColorStop(0.5, rgba(accent2, 0.07));
    g.addColorStop(1, rgba(accent2, 0));
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, oy, R * 2.4, 0, Math.PI * 2);
    ctx.fill();

    g = ctx.createRadialGradient(cx, oy - R * 0.12, R * 0.05, cx, oy, R);
    g.addColorStop(0, rgba(hotColor, Math.min(1, (0.7 + h * 0.3) * la)));
    g.addColorStop(0.3, rgba(accent, Math.min(1, (0.55 + h * 0.25) * la)));
    g.addColorStop(0.68, rgba(accent, Math.min(1, 0.3 * la)));
    g.addColorStop(0.92, rgba(accent2, Math.min(1, 0.38 * la)));
    g.addColorStop(1, rgba(accent2, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    orbPath(cx, oy, R, t, 0);
    ctx.fill();

    ctx.lineWidth = 1.6;
    ctx.strokeStyle = rgba(hotColor, Math.min(1, 0.55 * la));
    ctx.beginPath();
    orbPath(cx, oy, R * 1.02, t, 1.7);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(accent, Math.min(1, 0.3 * la));
    ctx.beginPath();
    orbPath(cx, oy, R * 0.9, t * 1.4 + 2, -1.1);
    ctx.stroke();

    for (const [tilt, speed, span, alpha] of [
      [-0.5, 0.35, 2.1, 0.6],
      [0.9, -0.26, 1.5, 0.4],
    ]) {
      const a0 = t * speed + tilt;
      g = ctx.createLinearGradient(cx - R, oy, cx + R, oy);
      g.addColorStop(0, rgba(accent, 0));
      g.addColorStop(0.5, rgba(hotColor, alpha));
      g.addColorStop(1, rgba(accent, 0));
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(cx, oy, R * 1.16, R * 0.36, tilt, a0, a0 + span);
      ctx.stroke();
    }

    g = ctx.createRadialGradient(cx, oy - R * 0.3, 0, cx, oy - R * 0.3, R * 0.55);
    g.addColorStop(0, rgba(hotColor, Math.min(1, (0.55 + h * 0.4) * la)));
    g.addColorStop(1, rgba(hotColor, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, oy - R * 0.3, R * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Wobbling plasma silhouette: a circle modulated by three slow harmonics.
  function orbPath(cx, cy, R, t, phase) {
    for (let i = 0; i <= 72; i++) {
      const th = (i / 72) * Math.PI * 2;
      const wobble =
        1 +
        0.05 * Math.sin(3 * th + t * 1.25 + phase) +
        0.035 * Math.sin(5 * th - t * 1.9 + phase * 2) +
        0.022 * Math.sin(8 * th + t * 0.65);
      const x = cx + Math.cos(th) * R * wobble;
      const y = cy + Math.sin(th) * R * wobble;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  const reducedMotion =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cssW = Math.max(1, canvas.clientWidth);
    cssH = Math.max(1, canvas.clientHeight);
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    warm();
    if (reducedMotion) draw();
  }

  function tick() {
    step();
    draw(performance.now());
    raf = requestAnimationFrame(tick);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  if (reducedMotion) {
    // One warm, still flame instead of a looping animation.
    draw();
  } else {
    tick();
  }

  return {
    setHeat(v) {
      heat = v;
      if (reducedMotion) draw();
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
    },
  };
}
