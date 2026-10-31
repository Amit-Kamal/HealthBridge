// shared/labs.js — explain the flags portals put on lab results, without interpreting them.
// HealthBridge repeats what the portal says ("marked High"); it never says what a result means.

const FLAGS = {
  h: 'High',
  hi: 'High',
  high: 'High',
  hh: 'Very high',
  l: 'Low',
  lo: 'Low',
  low: 'Low',
  ll: 'Very low',
  a: 'Abnormal',
  abn: 'Abnormal',
  abnormal: 'Abnormal',
  aa: 'Very abnormal',
  c: 'Critical',
  crit: 'Critical',
  critical: 'Critical',
  '*': 'Flagged',
  '!': 'Flagged',
};

const NORMAL = /^(n|normal|neg|negative|wnl|within normal limits)$/i;

// value: the text of a table cell, e.g. "H", "112 H", "High*".
export function flagMeaning(value) {
  const text = (value ?? '').trim();
  if (!text || NORMAL.test(text)) return null;
  const direct = FLAGS[text.toLowerCase().replace(/\*$/, '')];
  if (direct) return direct;
  // A flag letter after a number, as in "112 H" or "5.9 (H)".
  const trailing = /\d[\d.,]*\s*\(?\s*(HH|LL|H|L|A|C)\s*\)?\*?$/.exec(text);
  return trailing ? FLAGS[trailing[1].toLowerCase()] : null;
}

// Only columns that look like lab flags or results count, so a billing table cell
// that happens to say "A" is not reported as "Abnormal".
const FLAG_HEADER = /flag|abn|status|result|interp/i;

// One sentence for a row card, or '' if the portal didn't flag the row.
export function rowFlagNote(cells) {
  for (const cell of cells) {
    if (!FLAG_HEADER.test(cell.header ?? '')) continue;
    const meaning = flagMeaning(cell.value);
    if (meaning) return `The portal marked this result "${meaning}". Ask your care team what it means for you.`;
  }
  return '';
}
