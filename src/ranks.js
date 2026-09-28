/* Rank medallions — eight distinct marks, escalating with rank.
   Family language: ember body (currentColor = var(--ember)), hot accents
   (var(--hot)), and a ring treatment that grows from "no ring" to "orbited
   flame". All inline SVG so they theme via CSS vars. */

const svg = (inner) =>
  `<svg class="rank-svg" viewBox="0 0 64 64" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

const ICONS = {
  // 0 — Cinder: a cracked coal. Raw material, no ring.
  cinder: svg(`
    <path fill="currentColor" d="M32 12l15 8 4 17-10 14H23L13 37l4-17z"/>
    <path fill="none" stroke="var(--hot)" stroke-width="2.4" stroke-linecap="round" d="M30 16l3 9-5 7 6 4"/>
    <circle cx="40" cy="37" r="2.2" fill="var(--hot)"/>
  `),
  // 1 — Spark: the four-point star.
  spark: svg(`
    <path fill="currentColor" d="M32 8l3.2 20.8L56 32l-20.8 3.2L32 56l-3.2-20.8L8 32l20.8-3.2z"/>
    <circle cx="32" cy="32" r="4" fill="var(--hot)"/>
  `),
  // 2 — Kindling: crossed sticks catching the first tongue of fire.
  kindling: svg(`
    <g stroke="currentColor" stroke-width="5.5" stroke-linecap="round">
      <path d="M17 50L45 20"/><path d="M47 50L19 20"/>
    </g>
    <path fill="var(--hot)" d="M32 8c4.5 6 6.5 11 4 16-1.5 3-5.5 3-7 0-2.5-5-1.5-10 3-16z"/>
    <path fill="currentColor" d="M32 20c2 3 3 5.5 2 8-1 1.8-3 1.8-4 0-1-2.5 0-5 2-8z"/>
  `),
  // 3 — Flame: the honest flame, ringed.
  flame: svg(`
    <circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" stroke-width="2" opacity="0.4"/>
    <path fill="currentColor" d="M32 9c1.6 10 14 13.5 14 27 0 9.6-6.3 16.6-14 18.4C24.3 52.6 18 45.6 18 36 18 22.5 30.4 19 32 9z"/>
    <path fill="var(--hot)" d="M32 26c1 5 6.5 7 6.5 13.5 0 4.8-2.9 8.6-6.5 10-3.6-1.4-6.5-5.2-6.5-10C25.5 33 31 31 32 26z"/>
  `),
  // 4 — Blaze: twin flames breaking through one ring.
  blaze: svg(`
    <path fill="none" stroke="currentColor" stroke-width="2.6" opacity="0.55" d="M14 44A21 21 0 1 1 50 44"/>
    <path fill="currentColor" d="M27 16c1 8 10 10.5 10 21 0 7-4 12.6-9.5 14.4C21.9 49.6 18 44 18 37c0-10.5 8-13 9-21z"/>
    <path fill="currentColor" d="M43 24c4 5 5.5 9.5 3.5 14-1.3 2.8-4.8 2.8-6.1 0-2-4.5-.9-9 2.6-14z"/>
    <path fill="var(--hot)" d="M27.5 30c.8 4 4.6 5.4 4.6 9.9 0 3.4-2 6.1-4.6 7-2.6-.9-4.6-3.6-4.6-7 0-4.5 3.8-5.9 4.6-9.9z"/>
  `),
  // 5 — Inferno: segmented fire ring around a blazing core.
  inferno: svg(`
    <g fill="none" stroke="currentColor" stroke-width="3.4" opacity="0.6">
      <path d="M20.5 11.5A24 24 0 0 1 43.5 11.5"/>
      <path d="M53 22a24 24 0 0 1 1 14"/>
      <path d="M11 22a24 24 0 0 0-1 14"/>
      <path d="M17 51a24 24 0 0 0 30 0"/>
    </g>
    <path fill="currentColor" d="M32 12c1.4 9 12.5 12 12.5 25 0 8.8-5.7 15.2-12.5 17-6.8-1.8-12.5-8.2-12.5-17C19.5 24 30.6 21 32 12z"/>
    <path fill="var(--hot)" d="M32 28c1 5 5.6 6.6 5.6 12 0 4.2-2.5 7.4-5.6 8.5-3.1-1.1-5.6-4.3-5.6-8.5 0-5.4 4.6-7 5.6-12z"/>
  `),
  // 6 — Solar: the standard everyone measures against.
  solar: svg(`
    <g fill="currentColor">
      <path d="M32 2l4 14h-8z"/>
      <path d="M32 62l-4-14h8z"/>
      <path d="M62 32l-14 4v-8z"/>
      <path d="M2 32l14-4v8z"/>
      <path d="M53.3 10.7L45 21.4l-5.7-5.7z" opacity="0.75"/>
      <path d="M10.7 53.3L21.4 45l5.7 5.7z" opacity="0.75"/>
      <path d="M53.3 53.3L42.6 45l5.7-5.7z" opacity="0.75"/>
      <path d="M10.7 10.7L21.4 19l-5.7 5.7z" opacity="0.75"/>
    </g>
    <circle cx="32" cy="32" r="13" fill="currentColor"/>
    <circle cx="32" cy="32" r="6.5" fill="var(--hot)"/>
  `),
  // 7 — Eternal: the orbited flame. It does not go out.
  eternal: svg(`
    <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="1.6" opacity="0.35"/>
    <g fill="none" stroke="currentColor" stroke-width="2.2" opacity="0.7" transform="rotate(-18 32 32)">
      <ellipse cx="32" cy="32" rx="30" ry="11"/>
    </g>
    <path fill="currentColor" d="M32 10c1.4 9 12.5 12 12.5 25 0 8.8-5.7 15.2-12.5 17-6.8-1.8-12.5-8.2-12.5-17C19.5 22 30.6 19 32 10z"/>
    <path fill="var(--hot)" d="M32 26c1 5 5.6 6.6 5.6 12 0 4.2-2.5 7.4-5.6 8.5-3.1-1.1-5.6-4.3-5.6-8.5 0-5.4 4.6-7 5.6-12z"/>
    <circle cx="9.5" cy="25" r="2.6" fill="var(--hot)"/>
  `),
};

export function rankMark(name, size = 22) {
  const key = String(name).toLowerCase();
  const icon = ICONS[key] || ICONS.cinder;
  return `<span class="rank-ico" style="width:${size}px;height:${size}px">${icon}</span>`;
}
