/* Regenerates every PNG icon from the SVG sources. Run: node tools/gen-icons.mjs */
import sharp from "sharp";
import { readFile } from "node:fs/promises";

const targets = [
  ["public/icons/icon-512.png", "public/icon.svg", 512],
  ["public/icons/icon-192.png", "public/icon.svg", 192],
  ["public/icons/icon-180.png", "public/icon.svg", 180],
  ["public/icons/icon-maskable-512.png", "public/icon-maskable.svg", 512],
];

for (const [out, src, size] of targets) {
  const svg = await readFile(new URL("../" + src, import.meta.url));
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(out);
  console.log("wrote", out);
}
