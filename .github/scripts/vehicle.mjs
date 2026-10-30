import { createHash } from "node:crypto";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const PLATE_PATTERN = ["letter", "letter", "letter", "digit", "letter", "digit", "digit"];
const BODY_COLORS = ["#c3c7cc", "#eceeec", "#2a2e33", "#b3202c", "#2f5597", "#5a6068", "#cbb88f", "#3f6e52"];

function digestOf(login) {
  return createHash("sha256").update(login.toLowerCase()).digest();
}

function plateCharacter(kind, byte) {
  if (kind === "digit") return String(byte % 10);
  return LETTERS[byte % LETTERS.length];
}

/**
 * Derives a Mercosul plate (LLLNLNN), a body color and an OCR confidence from the login,
 * so the same visitor always gets the same car no matter how many times they park.
 * @param {string} login GitHub login of the driver
 * @returns {{ login: string, plate: string, color: string, confidence: string }}
 */
export function vehicleFor(login) {
  const digest = digestOf(login);
  return {
    login,
    plate: PLATE_PATTERN.map((kind, index) => plateCharacter(kind, digest[index])).join(""),
    color: BODY_COLORS[digest[7] % BODY_COLORS.length],
    confidence: (0.91 + (digest[8] % 9) / 100).toFixed(2),
  };
}
