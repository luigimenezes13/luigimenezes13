import { FONT_FACES, MONO, PLATE } from "./fonts.mjs";
import { escapeXml } from "./card-frame.mjs";

export const SPOT_COUNT = 16;
const WIDTH = 1000;
const HEIGHT = 470;
const SPOTS_PER_ROW = 8;
const LOT_LEFT = 60;
const SPOT_WIDTH = 110;
const SPOT_DEPTH = 120;
const CAR = { width: 58, length: 100 };
const PLATE_SIZE = { width: 54, height: 14 };
const AISLE_CENTER = 246;
const LOGIN_LIMIT = 14;
const ROWS = [
  { top: 84, carOffset: 8, rotation: 0, plateY: 195, loginY: 224, arrival: "fromBelow" },
  { top: 288, carOffset: 12, rotation: 180, plateY: 283, loginY: 274, arrival: "fromAbove" },
];

function bayOf(spot) {
  const row = ROWS[Math.floor((spot - 1) / SPOTS_PER_ROW)];
  const left = LOT_LEFT + ((spot - 1) % SPOTS_PER_ROW) * SPOT_WIDTH;
  return { row, left, center: left + SPOT_WIDTH / 2 };
}

function spotLabel(spot) {
  return String(spot).padStart(2, "0");
}

function shortLogin(login) {
  if (login.length <= LOGIN_LIMIT) return `@${login}`;
  return `@${login.slice(0, LOGIN_LIMIT - 1)}…`;
}

function markings(palette) {
  const dividers = ROWS.flatMap((row) =>
    Array.from({ length: SPOTS_PER_ROW + 1 }, (_, index) => {
      const x = LOT_LEFT + index * SPOT_WIDTH;
      return `<line x1="${x}" y1="${row.top}" x2="${x}" y2="${row.top + SPOT_DEPTH}"/>`;
    }),
  );
  const lotRight = LOT_LEFT + SPOTS_PER_ROW * SPOT_WIDTH;
  return `<g stroke="${palette.hairline}" stroke-width="2">
    ${dividers.join("")}
    <line x1="${LOT_LEFT}" y1="${ROWS[0].top}" x2="${lotRight}" y2="${ROWS[0].top}"/>
    <line x1="${LOT_LEFT}" y1="${ROWS[1].top + SPOT_DEPTH}" x2="${lotRight}" y2="${ROWS[1].top + SPOT_DEPTH}"/>
    <line x1="${LOT_LEFT}" y1="${AISLE_CENTER}" x2="${lotRight}" y2="${AISLE_CENTER}" stroke-dasharray="18 14" stroke-width="1.5"/>
  </g>`;
}

function freeSpot(spot) {
  const { row, center } = bayOf(spot);
  const middle = row.top + SPOT_DEPTH / 2;
  return `<text x="${center}" y="${middle + 8}" class="spot" text-anchor="middle">${spotLabel(spot)}</text>
  <text x="${center}" y="${middle + 26}" class="free" text-anchor="middle">livre</text>`;
}

function carBody(color) {
  const { width, length } = CAR;
  return `<rect x="-3" y="14" width="${width + 6}" height="17" rx="3" fill="#0d0f12"/>
    <rect x="-3" y="${length - 31}" width="${width + 6}" height="17" rx="3" fill="#0d0f12"/>
    <rect width="${width}" height="${length}" rx="13" fill="${color}" stroke="#000000" stroke-opacity="0.35"/>
    <rect x="8" y="12" width="${width - 16}" height="13" rx="4" fill="#1b2430"/>
    <rect x="7" y="29" width="${width - 14}" height="36" rx="6" fill="#ffffff" opacity="0.1"/>
    <rect x="6" y="66" width="${width - 12}" height="18" rx="5" fill="#1b2430"/>
    <rect x="-4" y="62" width="5" height="6" rx="1.5" fill="${color}"/>
    <rect x="${width - 1}" y="62" width="5" height="6" rx="1.5" fill="${color}"/>
    <rect x="6" y="${length - 5}" width="11" height="3" rx="1.5" fill="#fff6c8"/>
    <rect x="${width - 17}" y="${length - 5}" width="11" height="3" rx="1.5" fill="#fff6c8"/>`;
}

function parkedCar(row, center, color) {
  const x = center - CAR.width / 2;
  const y = row.top + row.carOffset;
  return `<g transform="translate(${x} ${y}) rotate(${row.rotation} ${CAR.width / 2} ${CAR.length / 2})">${carBody(color)}</g>`;
}

function plate(center, y, characters, palette) {
  const x = center - PLATE_SIZE.width / 2;
  return `<rect x="${x}" y="${y}" width="${PLATE_SIZE.width}" height="${PLATE_SIZE.height}" rx="2" fill="#f1f2ee" stroke="#9da2a8" stroke-width="0.6"/>
    <rect x="${x}" y="${y}" width="${PLATE_SIZE.width}" height="3.2" rx="1" fill="#003399"/>
    <text x="${center}" y="${y + 12.6}" class="plate" text-anchor="middle" fill="${palette.plateInk}">${characters}</text>`;
}

function detection(center, y, confidence) {
  const pad = 4;
  const x = center - PLATE_SIZE.width / 2 - pad;
  return `<g class="detection">
    <rect x="${x}" y="${y - pad}" width="${PLATE_SIZE.width + pad * 2}" height="${PLATE_SIZE.height + pad * 2}" class="box"/>
    <rect x="${x - 0.75}" y="${y - pad - 12}" width="58" height="12" class="tag-fill"/>
    <text x="${x + 3}" y="${y - pad - 3}" class="tag">placa ${confidence}</text>
  </g>`;
}

function car(vehicle, isNewest, palette) {
  const { row, center } = bayOf(vehicle.spot);
  const arrival = isNewest ? ` class="arrival ${row.arrival}"` : "";
  return `<g${arrival}>
    ${parkedCar(row, center, vehicle.color)}
    ${plate(center, row.plateY, escapeXml(vehicle.plate), palette)}
    <text x="${center}" y="${row.loginY}" class="login" text-anchor="middle">${escapeXml(shortLogin(vehicle.login))}</text>
  </g>
  ${isNewest ? detection(center, row.plateY, vehicle.confidence) : ""}`;
}

function readout(newest, palette) {
  if (!newest) return `<text x="48" y="${HEIGHT - 26}" class="hud">aguardando o primeiro carro</text>`;
  return `<text x="48" y="${HEIGHT - 26}" class="readout ocr"><tspan fill="${palette.muted}">ocr </tspan><tspan fill="${palette.text}">${escapeXml(newest.plate)}</tspan><tspan fill="${palette.signal}">  →  </tspan><tspan fill="${palette.heading}">@${escapeXml(newest.login)}</tspan><tspan fill="${palette.muted}">  vaga ${spotLabel(newest.spot)}</tspan></text>`;
}

function newestOf(cars) {
  return [...cars].sort((left, right) => right.parkedAt.localeCompare(left.parkedAt))[0];
}

export function renderParkingLot({ cars, palette }) {
  const newest = newestOf(cars);
  const occupied = new Set(cars.map((vehicle) => vehicle.spot));
  const freeSpots = Array.from({ length: SPOT_COUNT }, (_, index) => index + 1).filter((spot) => !occupied.has(spot));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Estacionamento com ${cars.length} de ${SPOT_COUNT} vagas ocupadas">
  <style>
    ${FONT_FACES}
    .hud { font: 400 11px ${MONO}; fill: ${palette.muted}; letter-spacing: 0.06em; white-space: pre; }
    .readout { font: 400 15px ${MONO}; white-space: pre; }
    .spot { font: 600 34px ${PLATE}; fill: ${palette.hairline}; letter-spacing: 0.04em; }
    .free { font: 400 8px ${MONO}; fill: ${palette.muted}; letter-spacing: 0.2em; }
    .plate { font: 600 11.5px ${PLATE}; letter-spacing: 0.06em; }
    .login { font: 400 8px ${MONO}; fill: ${palette.muted}; }
    .box { fill: none; stroke: ${palette.signal}; stroke-width: 1.5; }
    .tag-fill { fill: ${palette.signal}; }
    .tag { font: 600 7.5px ${MONO}; fill: #ffffff; white-space: pre; }
    .arrival { animation: 1.3s cubic-bezier(0.2, 0.7, 0.2, 1) 0.3s both; }
    .fromBelow { animation-name: fromBelow; }
    .fromAbove { animation-name: fromAbove; }
    .detection { opacity: 0; animation: lock 0.25s steps(2, end) 1.7s forwards; }
    .ocr { opacity: 0; clip-path: inset(0 100% 0 0); animation: type 1s steps(30, end) 2.1s forwards; }
    .rec { animation: blink 1.6s steps(1, end) infinite; }
    @keyframes fromBelow { from { transform: translateY(96px); opacity: 0; } 20% { opacity: 1; } }
    @keyframes fromAbove { from { transform: translateY(-96px); opacity: 0; } 20% { opacity: 1; } }
    @keyframes lock { to { opacity: 1; } }
    @keyframes type { to { opacity: 1; clip-path: inset(0 0 0 0); } }
    @keyframes blink { 50% { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) {
      .arrival, .rec { animation: none; }
      .detection, .ocr { animation: none; opacity: 1; clip-path: none; }
    }
  </style>
  <rect width="${WIDTH}" height="${HEIGHT}" rx="14" fill="${palette.frame}"/>
  <text x="48" y="52" class="hud">CAM 02   ESTACIONAMENTO</text>
  <g class="rec"><circle cx="${WIDTH - 196}" cy="48" r="5" fill="${palette.signal}"/><text x="${WIDTH - 184}" y="52" class="hud">REC</text></g>
  <text x="${WIDTH - 48}" y="52" class="hud" text-anchor="end">${cars.length}/${SPOT_COUNT} vagas</text>
  ${markings(palette)}
  ${freeSpots.map(freeSpot).join("")}
  ${[...cars.filter((vehicle) => vehicle !== newest), newest].filter(Boolean).map((vehicle) => car(vehicle, vehicle === newest, palette)).join("")}
  ${readout(newest, palette)}
  <text x="${WIDTH - 48}" y="${HEIGHT - 26}" class="hud" text-anchor="end">escolha uma vaga livre abaixo</text>
</svg>`;
}
