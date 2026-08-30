export const APP_NAME = "RITE";
export const THEME_COLOR = "#0a0908";

export function applyTheme() {
  document.documentElement.dataset.theme = "ember";
  document.documentElement.style.colorScheme = "dark";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLOR);
  document.title = APP_NAME;
}
