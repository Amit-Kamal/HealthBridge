// shared/readability.js — Flesch-Kincaid grade level for English text.
// A rough guide, not a verdict: it measures sentence and word length, not meaning.

const MIN_WORDS = 30; // below this the formula is too noisy to show

// Common heuristic: count vowel groups after trimming silent endings.
export function countSyllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  return Math.max(1, w.match(/[aeiouy]{1,2}/g)?.length ?? 1);
}

export function textStats(text) {
  const words = text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
  // Each block is at least one sentence even without end punctuation.
  const sentences = Math.max(1, (text.match(/[.!?]+(?=\s|$)/g) ?? []).length);
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  return { words: words.length, sentences, syllables };
}

export function gradeFromStats({ words, sentences, syllables }) {
  if (!words) return null;
  const grade = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
  return Math.max(0, Math.round(grade * 10) / 10);
}

export function levelLabel(grade) {
  if (grade == null) return null;
  if (grade <= 6) return 'easy';
  if (grade <= 8) return 'ok';
  if (grade <= 12) return 'hard';
  return 'very-hard';
}

// texts: array of paragraph strings. Sentences are counted per paragraph so
// headings and list items without full stops don't merge into one long sentence.
export function readingLevel(texts) {
  const total = { words: 0, sentences: 0, syllables: 0 };
  for (const t of texts) {
    const s = textStats(t);
    if (!s.words) continue;
    total.words += s.words;
    total.sentences += s.sentences;
    total.syllables += s.syllables;
  }
  if (total.words < MIN_WORDS) return { grade: null, level: null, words: total.words };
  const grade = gradeFromStats(total);
  return { grade, level: levelLabel(grade), words: total.words };
}

// For flagging single dense paragraphs in the reader.
export function blockGrade(text) {
  const s = textStats(text);
  return s.words >= 12 ? gradeFromStats(s) : null;
}
