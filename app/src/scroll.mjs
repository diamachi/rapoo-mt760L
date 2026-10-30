export function validateLines(value) {
  if (!Number.isInteger(value) || value<1 || value>100) throw Error('Choose 1–100 lines per wheel notch');
  return value;
}
export function lineDelta(delta, continuous, lines) {
  validateLines(lines);
  if (continuous || !delta) return null;
  return delta*lines;
}
