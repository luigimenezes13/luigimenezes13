import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { PALETTES } from "./palettes.mjs";
import { SPOT_COUNT, renderParkingLot } from "./parking-lot.mjs";
import { vehicleFor } from "./vehicle.mjs";

const ASSETS_DIRECTORY = process.env.PARKING_ASSETS ?? "assets";
const STATE_PATH = `${ASSETS_DIRECTORY}/parking.json`;
const README_PATH = process.env.PARKING_README ?? "README.md";
const COMMENT_PATH = process.env.PARKING_COMMENT ?? "parking-comment.md";
const REPOSITORY = process.env.GITHUB_REPOSITORY ?? "luigimenezes13/luigimenezes13";
const TITLE_PATTERN = /^estacionar\|(\d{1,2})$/i;
const SECTION_PATTERN = /<!-- parking:start -->[\s\S]*<!-- parking:end -->/;
const ISSUE_BODY = "Só clicar em **Submit new issue**. Em cerca de um minuto seu carro aparece no perfil.";

function spotLabel(spot) {
  return String(spot).padStart(2, "0");
}

function requestedSpot(title) {
  const match = TITLE_PATTERN.exec(title.trim());
  if (!match) return null;
  const spot = Number(match[1]);
  if (spot < 1 || spot > SPOT_COUNT) return null;
  return spot;
}

function isDrivenBy(vehicle, login) {
  return vehicle.login.toLowerCase() === login.toLowerCase();
}

function oldestOf(cars) {
  return [...cars].sort((left, right) => left.parkedAt.localeCompare(right.parkedAt))[0];
}

function parkedMessage(arriving, towed) {
  const lines = [
    `Estacionado na vaga ${spotLabel(arriving.spot)}.`,
    `O LPR leu a placa **${arriving.plate}** com confiança ${arriving.confidence}. Ela é gerada a partir do seu usuário, então volta igual se você estacionar de novo.`,
  ];
  if (towed) lines.push(`O estacionamento lotou, então o carro mais antigo, de @${towed.login}, foi liberado.`);
  lines.push(`Veja seu carro em https://github.com/${REPOSITORY.split("/")[0]}.`);
  return lines.join("\n\n");
}

/**
 * Parks the driver's car in the requested spot. A driver owns at most one car, so parking again moves it,
 * and the lot never fills up: when the last spot is taken the oldest car leaves, keeping a spot free for the next visitor.
 * @param {object[]} cars cars currently parked
 * @param {string} login driver's GitHub login
 * @param {number} spot requested spot, from 1 to SPOT_COUNT
 * @param {string} now ISO timestamp of the arrival
 * @returns {{ cars: object[], message: string }} the lot after the attempt and the reply to the driver
 */
function park(cars, login, spot, now) {
  const occupant = cars.find((vehicle) => vehicle.spot === spot && !isDrivenBy(vehicle, login));
  if (occupant) return { cars, message: `A vaga ${spotLabel(spot)} já está ocupada pelo carro de @${occupant.login}. Escolha uma vaga livre no perfil.` };
  const arriving = { ...vehicleFor(login), spot, parkedAt: now };
  const others = cars.filter((vehicle) => !isDrivenBy(vehicle, login));
  const towed = others.length + 1 === SPOT_COUNT ? oldestOf(others) : undefined;
  const parked = [...others.filter((vehicle) => vehicle !== towed), arriving];
  return { cars: parked, message: parkedMessage(arriving, towed) };
}

function issueLink(spot) {
  const title = encodeURIComponent(`estacionar|${spotLabel(spot)}`);
  return `https://github.com/${REPOSITORY}/issues/new?title=${title}&body=${encodeURIComponent(ISSUE_BODY)}`;
}

function parkingSection(cars) {
  const occupied = new Set(cars.map((vehicle) => vehicle.spot));
  const freeSpots = Array.from({ length: SPOT_COUNT }, (_, index) => index + 1).filter((spot) => !occupied.has(spot));
  return `<!-- parking:start -->
<picture><source media="(prefers-color-scheme: light)" srcset="${ASSETS_DIRECTORY}/parking-light.svg" /><img width="100%" src="${ASSETS_DIRECTORY}/parking.svg" alt="Estacionamento do perfil com ${cars.length} carros" /></picture>

**Estacione na vaga** ${freeSpots.map((spot) => `[${spotLabel(spot)}](${issueLink(spot)})`).join(" · ")}
<!-- parking:end -->`;
}

async function parkedCars() {
  if (!existsSync(STATE_PATH)) return [];
  return JSON.parse(await readFile(STATE_PATH, "utf8"));
}

async function publish(cars) {
  await mkdir(ASSETS_DIRECTORY, { recursive: true });
  await writeFile(STATE_PATH, `${JSON.stringify(cars, null, 2)}\n`);
  for (const [suffix, palette] of Object.entries(PALETTES)) {
    await writeFile(`${ASSETS_DIRECTORY}/parking${suffix}.svg`, renderParkingLot({ cars, palette }));
  }
  const readme = await readFile(README_PATH, "utf8");
  await writeFile(README_PATH, readme.replace(SECTION_PATTERN, parkingSection(cars)));
}

async function main() {
  const spot = requestedSpot(process.env.ISSUE_TITLE ?? "");
  const login = process.env.ISSUE_AUTHOR ?? "";
  if (!spot || !login) {
    await writeFile(COMMENT_PATH, "Não reconheci a vaga. Use os links do perfil para estacionar.");
    return;
  }
  const { cars, message } = park(await parkedCars(), login, spot, new Date().toISOString());
  await publish(cars);
  await writeFile(COMMENT_PATH, message);
}

await main();
