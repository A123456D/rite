const svg = (inner) =>
  `<svg class="rank-svg" viewBox="0 0 64 64" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

const ICONS = {
  cinder: svg(
    `<path fill="currentColor" d="M20 30c-1 10 4 22 12 26 8-4 13-16 12-26-2-10-7-18-12-22-5 4-10 12-12 22z"/><path fill="var(--hot)" d="M31 24v22h2V24z"/>`
  ),
  spark: svg(
    `<path fill="currentColor" d="M32 6l3 20 20 3-20 3-3 20-3-20-20-3 20-3z"/><circle cx="32" cy="32" r="4" fill="var(--hot)"/>`
  ),
  kindling: svg(
    `<path fill="#3a2a22" d="M18 54 14 32l10 6 8-24 8 24 10-6-4 22z"/><path fill="currentColor" d="M32 8c8 10 10 20 6 28-4-4-6-10-6-16 0-6-2 12-6 16 4-8 2-18 6-28z"/>`
  ),
  flame: svg(
    `<path fill="currentColor" d="M32 4c2 12 18 16 18 34 0 12-8 22-18 24C22 60 14 50 14 38 14 20 30 16 32 4z"/><path fill="var(--hot)" d="M32 22c1 6 8 8 8 18 0 8-4 14-8 16-4-2-8-8-8-16 0-10 7-12 8-18z"/>`
  ),
  blaze: svg(
    `<path fill="currentColor" d="M32 2c14 14 24 20 22 38-2 12-11 22-22 22S12 52 10 40C8 22 18 16 32 2z"/><path fill="var(--hot)" d="M22 36c-2-10 6-16 10-24 4 8 12 14 10 24-2 10-6 16-10 18-4-2-8-8-10-18z"/>`
  ),
  inferno: svg(
    `<path fill="currentColor" d="M8 40c0-18 12-24 24-36 12 12 24 18 24 36 0 14-11 22-24 22S8 54 8 40z"/><path fill="var(--hot)" d="M20 40c0-10 6-14 12-22 6 8 12 12 12 22 0 8-5 14-12 14s-12-6-12-14z"/>`
  ),
  solar: svg(
    `<path fill="currentColor" d="M32 2 36 18 52 14 40 28 60 32 40 36 52 50 36 46 32 62 28 46 12 50 24 36 4 32 24 28 12 14 28 18z"/><circle cx="32" cy="32" r="10" fill="var(--hot)"/>`
  ),
  eternal: svg(
    `<path fill="currentColor" fill-rule="evenodd" d="M32 6a26 26 0 1 0 0 52 26 26 0 0 0 0-52zm0 10a16 16 0 1 1 0 32 16 16 0 0 1 0-32z"/><circle cx="32" cy="32" r="6" fill="var(--hot)"/>`
  ),
};

export function rankMark(name, size = 22) {
  const key = String(name).toLowerCase();
  const icon = ICONS[key] || ICONS.cinder;
  return `<span class="rank-ico" style="width:${size}px;height:${size}px">${icon}</span>`;
}
