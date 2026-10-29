const STEP_SECONDS = 0.07;
const START_SECONDS = 2.2;
const PAUSE_SECONDS = 2.5;
const SEGMENT_SIZES = [12, 11, 10, 9, 8, 7];

function weekColumns(cells) {
  const columns = new Map();
  for (const cell of cells) {
    columns.set(cell.week, [...(columns.get(cell.week) ?? []), cell]);
  }
  return [...columns.entries()].sort(([left], [right]) => left - right).map(([, column]) => column);
}

function columnOrder(column, weekday) {
  const ascending = [...column].sort((left, right) => left.weekday - right.weekday);
  const top = ascending[0].weekday;
  const bottom = ascending.at(-1).weekday;
  if (Math.abs(weekday - top) <= Math.abs(weekday - bottom)) return ascending;
  return ascending.reverse();
}

function walk(from, to) {
  const steps = [];
  const cursor = { ...from };
  while (cursor.week !== to.week) {
    cursor.week += Math.sign(to.week - cursor.week);
    steps.push({ ...cursor });
  }
  while (cursor.weekday !== to.weekday) {
    cursor.weekday += Math.sign(to.weekday - cursor.weekday);
    steps.push({ ...cursor });
  }
  return steps;
}

/**
 * Sweeps the grid week by week, entering each column from the end closest to the head, so no cell is left behind.
 * @param {{ week: number, weekday: number, index: number }[]} cells cells that hold commits
 * @param {number} weeks grid width, used to leave through the right edge
 * @returns {{ route: { week: number, weekday: number }[], eatenAt: Map<number, number> }} positions per step and the step each cell index is eaten at
 */
function routeThrough(cells, weeks) {
  const route = [{ week: -2, weekday: 0 }];
  const eatenAt = new Map();
  for (const column of weekColumns(cells)) {
    for (const target of columnOrder(column, route.at(-1).weekday)) {
      route.push(...walk(route.at(-1), target));
      eatenAt.set(target.index, route.length - 1);
    }
  }
  route.push(...walk(route.at(-1), { week: weeks + SEGMENT_SIZES.length + 1, weekday: route.at(-1).weekday }));
  return { route, eatenAt };
}

function isTurn(route, index) {
  if (index === 0 || index === route.length - 1) return true;
  const before = route[index - 1];
  const after = route[index + 1];
  return before.week !== after.week && before.weekday !== after.weekday;
}

function percent(seconds, cycle) {
  return ((seconds / cycle) * 100).toFixed(3);
}

function movementKeyframes(route, grid, cycle) {
  const frames = route
    .map((position, index) => ({ position, index }))
    .filter(({ index }) => isTurn(route, index))
    .map(({ position, index }) => `${percent(START_SECONDS + index * STEP_SECONDS, cycle)}%{transform:translate(${grid.x(position.week)}px,${grid.y(position.weekday)}px)}`);
  const [first] = route;
  return `@keyframes slither{0%{transform:translate(${grid.x(first.week)}px,${grid.y(first.weekday)}px)}${frames.join("")}100%{transform:translate(${grid.x(route.at(-1).week)}px,${grid.y(route.at(-1).weekday)}px)}}`;
}

function eatenKeyframes(index, step, cycle) {
  const eaten = percent(START_SECONDS + step * STEP_SECONDS, cycle);
  return `@keyframes eat${index}{0%,${eaten}%{opacity:0}${(Number(eaten) + 0.001).toFixed(3)}%,99.9%{opacity:1}100%{opacity:0}}`;
}

function segment(size, order, cellSize, color) {
  const offset = (cellSize - size) / 2;
  return `<rect class="segment" style="animation-delay:${(order * STEP_SECONDS).toFixed(2)}s" x="${offset}" y="${offset}" width="${size}" height="${size}" rx="${size / 3}" fill="${color}" opacity="${(1 - order * 0.12).toFixed(2)}"/>`;
}

export function renderSnake({ cells, grid, palette }) {
  const { route, eatenAt } = routeThrough(cells, grid.weeks);
  const cycle = START_SECONDS + route.length * STEP_SECONDS + PAUSE_SECONDS;
  const eatenCells = cells.map((cell) => `<rect class="eaten" style="animation-name:eat${cell.index}" x="${grid.x(cell.week) - 0.5}" y="${grid.y(cell.weekday) - 0.5}" width="${grid.cell + 1}" height="${grid.cell + 1}" rx="2.5" fill="${palette.empty}"/>`);
  const styles = `.segment { animation: slither ${cycle.toFixed(2)}s linear infinite both; }
    .eaten { opacity: 0; animation-duration: ${cycle.toFixed(2)}s; animation-timing-function: step-end; animation-iteration-count: infinite; }
    ${movementKeyframes(route, grid, cycle)}
    ${cells.map((cell) => eatenKeyframes(cell.index, eatenAt.get(cell.index), cycle)).join("\n    ")}
    @media (prefers-reduced-motion: reduce) { .segment, .eaten { animation: none; display: none; } }`;
  const body = `<clipPath id="board"><rect x="${grid.x(0) - 2}" y="${grid.y(0) - 2}" width="${grid.weeks * grid.step + 2}" height="${7 * grid.step + 2}"/></clipPath>
  ${eatenCells.join("")}
  <g clip-path="url(#board)">${SEGMENT_SIZES.map((size, order) => segment(size, order, grid.cell, palette.heading)).reverse().join("")}</g>`;
  return { styles, body };
}
