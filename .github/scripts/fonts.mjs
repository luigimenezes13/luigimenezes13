import { readFileSync } from "node:fs";

const FONTS = [
  ["Plate", 600, "barlow-condensed-600"],
  ["Martian Mono", 400, "martian-mono-400"],
  ["Martian Mono", 600, "martian-mono-600"],
  ["Instrument Sans", 400, "instrument-sans-400"],
  ["Instrument Sans", 600, "instrument-sans-600"],
];

function fontFace([family, weight, file]) {
  const data = readFileSync(new URL(`../fonts/${file}.woff2`, import.meta.url)).toString("base64");
  return `@font-face { font-family: '${family}'; font-weight: ${weight}; src: url(data:font/woff2;base64,${data}) format('woff2'); }`;
}

export const FONT_FACES = FONTS.map(fontFace).join("\n    ");
export const SANS = "'Instrument Sans', 'Segoe UI', sans-serif";
export const MONO = "'Martian Mono', ui-monospace, monospace";
export const PLATE = "'Plate', 'Arial Narrow', sans-serif";
