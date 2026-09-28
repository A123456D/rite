export const APP_NAME = "RITE";

/* Five clear identities + Auto. No near-duplicates: one warm signature dark,
   one true-black OLED, one cool dark, one clean light, one playful light. */
export const THEMES = {
  ember: { label: "Ember", color: "#070605", scheme: "dark" },
  onyx: { label: "Onyx", color: "#000000", scheme: "dark" },
  slate: { label: "Slate", color: "#0e141b", scheme: "dark" },
  aura: { label: "Aura", color: "#f5f4f1", scheme: "light" },
  sketch: { label: "Sketch", color: "#f1ebe1", scheme: "light" },
};

function resolveTheme(name) {
  if (name === "auto") {
    try {
      return matchMedia("(prefers-color-scheme: light)").matches ? "aura" : "ember";
    } catch {
      return "ember";
    }
  }
  return THEMES[name] ? name : "ember";
}

export function applyTheme(name) {
  const resolved = resolveTheme(name);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeSource = name === "auto" ? "auto" : "fixed";
  document.documentElement.style.colorScheme = THEMES[resolved].scheme;
  const metaEl = document.querySelector('meta[name="theme-color"]');
  if (metaEl) metaEl.setAttribute("content", THEMES[resolved].color);
  document.title = APP_NAME;
}

// system light/dark flips re-resolve "auto" live
try {
  matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
    if (document.documentElement.dataset.themeSource === "auto") applyTheme("auto");
  });
} catch {
  /* old browsers keep the last resolved theme */
}

export function heatBand(heat) {
  if (heat >= 88) return "critical";
  if (heat >= 72) return "hot";
  if (heat >= 55) return "lit";
  if (heat >= 38) return "warm";
  if (heat >= 20) return "low";
  return "ash";
}
