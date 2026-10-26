import { MONO, SANS } from "./fonts.mjs";
import { escapeXml, renderCard } from "./card-frame.mjs";

const CENTER_X = 115;
const CENTER_Y = 145;
const RADIUS = 58;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function donutSegments(languages) {
  let consumed = 0;
  return languages
    .map((language, index) => {
      const length = language.share * CIRCUMFERENCE;
      const segment = `<circle class="segment" style="animation-delay:${index * 120}ms" cx="${CENTER_X}" cy="${CENTER_Y}" r="${RADIUS}" stroke="${language.color}" stroke-dasharray="${length.toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}" stroke-dashoffset="${(-consumed).toFixed(2)}"/>`;
      consumed += length;
      return segment;
    })
    .join("");
}

function legendRow(language, index) {
  const y = 82 + index * 18;
  return `<g class="stagger" style="animation-delay:${300 + index * 100}ms">
    <rect x="235" y="${y - 9}" width="10" height="10" rx="2" fill="${language.color}"/>
    <text x="253" y="${y}" class="text">${escapeXml(language.name)}</text>
    <text x="470" y="${y}" class="text percent" text-anchor="end">${(language.share * 100).toFixed(1)}%</text>
  </g>`;
}

export function renderLanguagesCard({ languages, palette }) {
  const leader = languages[0];
  return renderCard({
    title: "Linguagens mais usadas",
    subtitle: "Ponderado pelos seus commits em cada repositório",
    palette,
    styles: `
    .segment { fill: none; stroke-width: 22; transform: rotate(-90deg); transform-origin: ${CENTER_X}px ${CENTER_Y}px; opacity: 0; animation: fadeIn 0.5s ease-out forwards; }
    .percent { font-family: ${MONO}; font-size: 11px; fill: ${palette.muted}; }
    .leader { font: 800 20px ${SANS}; fill: ${palette.text}; }`,
    body: `<circle cx="${CENTER_X}" cy="${CENTER_Y}" r="${RADIUS}" fill="none" stroke="${palette.track}" stroke-width="22"/>
  ${donutSegments(languages)}
  <text x="${CENTER_X}" y="${CENTER_Y + 2}" class="leader" text-anchor="middle">${Math.round(leader.share * 100)}%</text>
  <text x="${CENTER_X}" y="${CENTER_Y + 18}" class="axis" text-anchor="middle">${escapeXml(leader.name)}</text>
  ${languages.map(legendRow).join("\n  ")}`,
  });
}
