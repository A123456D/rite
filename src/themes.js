export const APP_NAME = "RITE";

export const THEMES = {
  ember: { label: "Ember", color: "#0a0908", scheme: "dark" },
  vesper: { label: "Vesper", color: "#0c0a18", scheme: "dark" },
  hud: { label: "HUD", color: "#04080d", scheme: "dark" },
  nebula: { label: "Nebula", color: "#070512", scheme: "dark" },
  aura: { label: "Aura", color: "#f2f1fa", scheme: "light" },
  sketch: { label: "Sketch", color: "#efe9df", scheme: "light" },
};

// Heat bands drive the reactive accent ramp (see style.css [data-heat-band]).
export function heatBand(heat) {
  if (heat >= 88) return "critical";
  if (heat >= 72) return "hot";
  if (heat >= 55) return "lit";
  if (heat >= 38) return "warm";
  if (heat >= 20) return "low";
  return "ash";
}

export function applyTheme(name) {
  const theme = THEMES[name] ? name : "ember";
  const meta = THEMES[theme];
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = meta.scheme;
  const metaEl = document.querySelector('meta[name="theme-color"]');
  if (metaEl) metaEl.setAttribute("content", meta.color);
  document.title = APP_NAME;
}
