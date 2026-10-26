export const CARD_WIDTH = 495;
export const CARD_HEIGHT = 235;

export function escapeXml(text) {
  return String(text).replace(/[<>&"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

export function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function renderCard({ title, subtitle, palette, styles = "", body, height = CARD_HEIGHT }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${height}" viewBox="0 0 ${CARD_WIDTH} ${height}" role="img" aria-label="${escapeXml(title)}">
  <style>
    .title { font: 600 18px 'Segoe UI', Ubuntu, sans-serif; fill: ${palette.title}; }
    .subtitle { font: 400 11px 'Segoe UI', Ubuntu, sans-serif; fill: ${palette.muted}; }
    .text { font: 400 12px 'Segoe UI', Ubuntu, sans-serif; fill: ${palette.text}; }
    .axis { font: 400 10px 'Segoe UI', Ubuntu, sans-serif; fill: ${palette.muted}; }
    .stagger { opacity: 0; animation: fadeIn 0.4s ease-in-out forwards; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    ${styles}
  </style>
  <rect width="${CARD_WIDTH}" height="${height}" rx="12" fill="${palette.background}"/>
  <text x="25" y="35" class="title">${escapeXml(title)}</text>
  <text x="25" y="53" class="subtitle">${escapeXml(subtitle)}</text>
  ${body}
</svg>`;
}
