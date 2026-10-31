// shared/textSafety.js — checks on AI rewrites of health and billing text.
// A rewrite that drops "$4,000" or "20%" can mislead, so anything missing is flagged.

// Money, percentages, plain numbers with units, dates and times.
const FACT = /\$\s?\d+(?:,\d{3})*(?:\.\d+)?|\d+(?:[.,]\d+)*\s?%|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{1,2}:\d{2}\b|\b\d+(?:,\d{3})*(?:\.\d+)?\b/g;

// "$1,500" and "$1500", "20 %" and "20%" count as the same fact.
const normalize = (s) => s.replace(/,(?=\d{3}(?!\d))/g, '').replace(/\s+/g, '');

export function factsIn(text) {
  return [...new Set((text.match(FACT) ?? []).map((m) => m.trim()))];
}

// Facts in the original that don't appear anywhere in the rewrite.
export function missingFacts(original, rewrite) {
  const haystack = normalize(rewrite);
  return factsIn(original).filter((fact) => !haystack.includes(normalize(fact)));
}

// "not covered" and "covered" read almost the same to a model but mean the opposite.
// If the rewrite has fewer negative words than the original, the meaning may have flipped.
const NEGATION = /\b(?:not|no|never|none|nothing|nobody|neither|nor|without|cannot)\b|\b\w+n[’']t\b/gi;

export function negationsDropped(original, rewrite) {
  const count = (text) => (text.match(NEGATION) ?? []).length;
  return count(rewrite) < count(original);
}
