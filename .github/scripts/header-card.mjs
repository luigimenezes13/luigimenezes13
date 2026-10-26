import { FONT_FACES, MONO, PLATE, SANS } from "./fonts.mjs";

const WIDTH = 1000;
const HEIGHT = 420;
const PLATE_BOX = { x: 290, y: 116, width: 420, height: 136 };
const BAND_HEIGHT = 30;
const MERCOSUL_BLUE = "#003399";
const PLATE_TEXT = "LUI1G13";
const HANDLE = "luigimenezes13";

function viewfinderCorners(color) {
  const inset = 24;
  const arm = 22;
  const corners = [
    [inset, inset, 1, 1],
    [WIDTH - inset, inset, -1, 1],
    [inset, HEIGHT - inset, 1, -1],
    [WIDTH - inset, HEIGHT - inset, -1, -1],
  ];
  return corners
    .map(([x, y, dx, dy]) => `<path d="M${x} ${y + dy * arm}V${y}H${x + dx * arm}" fill="none" stroke="${color}" stroke-width="1.5"/>`)
    .join("");
}

function brazilFlag(x, y) {
  return `<g transform="translate(${x} ${y})">
      <rect width="24" height="17" fill="#009c3b"/>
      <path d="M12 2 L22 8.5 L12 15 L2 8.5Z" fill="#ffdf00"/>
      <circle cx="12" cy="8.5" r="3.6" fill="#002776"/>
    </g>`;
}

function licensePlate(palette) {
  const { x, y, width, height } = PLATE_BOX;
  return `<g class="plate">
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="#f1f2ee" stroke="#c9ccc4" stroke-width="2"/>
    <path d="M${x + 1} ${y + BAND_HEIGHT}V${y + 10}a9 9 0 0 1 9 -9H${x + width - 10}a9 9 0 0 1 9 9V${y + BAND_HEIGHT}Z" fill="${MERCOSUL_BLUE}"/>
    <text x="${x + width / 2}" y="${y + 22}" class="band" text-anchor="middle">BRASIL</text>
    <text x="${x + 14}" y="${y + 21}" class="mercosul">MERCOSUL</text>
    ${brazilFlag(x + width - 38, y + 7)}
    <text x="${x + width / 2}" y="${y + height - 16}" class="characters" text-anchor="middle" fill="${palette.plateInk}">${PLATE_TEXT}</text>
    <rect class="scan" x="${x}" y="${y}" width="${width}" height="3" fill="${palette.signal}"/>
  </g>`;
}

function detection(palette) {
  const pad = 14;
  const x = PLATE_BOX.x - pad;
  const y = PLATE_BOX.y - pad;
  const width = PLATE_BOX.width + pad * 2;
  const height = PLATE_BOX.height + pad * 2;
  return `<g class="detection">
    <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="${palette.signal}" stroke-width="2"/>
    <rect x="${x - 1}" y="${y - 24}" width="132" height="24" fill="${palette.signal}"/>
    <text x="${x + 9}" y="${y - 7}" class="tag">placa  0.98</text>
  </g>`;
}

function ocrReadout(palette) {
  const y = PLATE_BOX.y + PLATE_BOX.height + 58;
  return `<g class="ocr">
    <text x="${WIDTH / 2}" y="${y}" class="readout" text-anchor="middle"><tspan fill="${palette.muted}">ocr </tspan><tspan fill="${palette.text}">${PLATE_TEXT}</tspan><tspan fill="${palette.signal}">  →  </tspan><tspan fill="${palette.text}">${HANDLE}</tspan></text>
  </g>`;
}

function overlay(capturedAt, palette) {
  return `<text x="48" y="58" class="hud">CAM 01   CAMPINAS-SP   ${capturedAt}</text>
  <g class="rec"><circle cx="${WIDTH - 108}" cy="54" r="5" fill="${palette.signal}"/><text x="${WIDTH - 96}" y="58" class="hud">REC</text></g>
  <text x="48" y="${HEIGHT - 66}" class="name">Luigi Menezes</text>
  <text x="48" y="${HEIGHT - 44}" class="role">backend na V4 Company</text>
  <text x="${WIDTH - 48}" y="${HEIGHT - 44}" class="hud" text-anchor="end">yolov8 + paddleocr · raspberry pi</text>`;
}

export function renderHeader({ capturedAt, palette }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Câmera detecta a placa ${PLATE_TEXT} e lê ${HANDLE}">
  <style>
    ${FONT_FACES}
    .hud { font: 400 11px ${MONO}; fill: ${palette.muted}; letter-spacing: 0.06em; white-space: pre; }
    .tag { font: 600 12px ${MONO}; fill: #ffffff; white-space: pre; }
    .readout { font: 400 17px ${MONO}; white-space: pre; }
    .name { font: 600 30px ${SANS}; fill: ${palette.heading}; letter-spacing: -0.01em; }
    .role { font: 400 15px ${SANS}; fill: ${palette.muted}; }
    .band { font: 600 17px ${PLATE}; fill: #ffffff; letter-spacing: 0.32em; }
    .mercosul { font: 600 7px ${SANS}; fill: #ffffff; letter-spacing: 0.08em; }
    .characters { font: 600 112px ${PLATE}; letter-spacing: 0.04em; }
    .scan { opacity: 0; animation: scan 1.1s ease-in-out 0.3s 1 forwards; }
    .detection { opacity: 0; animation: lock 0.25s steps(2, end) 1.4s forwards; }
    .ocr { opacity: 0; clip-path: inset(0 100% 0 0); animation: type 1s steps(30, end) 1.8s forwards; }
    .rec { animation: blink 1.6s steps(1, end) infinite; }
    @keyframes scan { 0% { opacity: 1; transform: translateY(0); } 90% { opacity: 1; transform: translateY(${PLATE_BOX.height - 3}px); } 100% { opacity: 0; transform: translateY(${PLATE_BOX.height - 3}px); } }
    @keyframes lock { to { opacity: 1; } }
    @keyframes type { to { opacity: 1; clip-path: inset(0 0 0 0); } }
    @keyframes blink { 50% { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) {
      .scan, .rec { animation: none; }
      .detection, .ocr { animation: none; opacity: 1; clip-path: none; }
    }
  </style>
  <rect width="${WIDTH}" height="${HEIGHT}" rx="14" fill="${palette.frame}"/>
  ${viewfinderCorners(palette.hairline)}
  ${overlay(capturedAt, palette)}
  ${licensePlate(palette)}
  ${detection(palette)}
  ${ocrReadout(palette)}
</svg>`;
}
