// sidepanel/speech.js — read aloud with the Web Speech API. The block being read gets a
// background color, and the current word is marked with the CSS Custom Highlight API,
// which highlights text without changing the page's structure for screen readers.
//
// Privacy: Chrome's "Google ..." voices are online voices that send the text to Google.
// HealthBridge uses voices on this computer unless the user agrees to online ones.

const CHUNK = 220; // speak about a sentence at a time: short utterances are more reliable
const SKIP = '[hidden], .definition, .no-speak, button:not(.term)';

let queue = []; // [{ utterance, el }]
let position = 0; // index in queue of the chunk being spoken (used to resume)
let state = 'idle'; // 'idle' | 'speaking' | 'paused'
const listeners = new Set();
let wordHighlight = null;

export class SpeechError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export const isSupported = () => 'speechSynthesis' in self && typeof SpeechSynthesisUtterance === 'function';

export function onStateChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setState(next) {
  if (state === next) return;
  state = next;
  for (const fn of listeners) fn(state);
}

export const getState = () => state;

// Voices load asynchronously; wait briefly for them.
export async function voicesReady(timeout = 1500) {
  if (!isSupported()) return [];
  const now = speechSynthesis.getVoices();
  if (now.length) return now;
  return new Promise((resolve) => {
    const done = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, timeout);
  });
}

// Pick a voice for the language. Local voices first; online ones only with permission.
export async function chooseVoice(lang = 'en') {
  const voices = await voicesReady();
  if (!voices.length) throw new SpeechError('no-voice', 'Read aloud needs a voice, and this computer doesn’t have one set up.');
  const base = lang.toLowerCase().split('-')[0];
  const sameLang = (v) => v.lang.toLowerCase().startsWith(base);
  const local = voices.filter((v) => v.localService);
  const pick = (list) => list.find((v) => sameLang(v) && v.default) ?? list.find(sameLang) ?? null;
  const localVoice = pick(local);
  if (localVoice) return localVoice;
  const { allowOnlineVoices } = await chrome.storage.local.get('allowOnlineVoices');
  if (!allowOnlineVoices) {
    throw new SpeechError('online-only', 'The only voices on this computer are online voices. They send the text to Google to be spoken, which could include health information on this page.');
  }
  return pick(voices) ?? voices[0];
}

// Map an element's visible text to its text nodes, so a character index from a
// boundary event can be turned into a Range. Cells in a card get ": " and ". "
// between them so the voice pauses in the right places.
export function textMap(el) {
  const segments = [];
  let text = '';
  let lastCell = null;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const cell = node.parentElement.closest('dt, dd, li, p, h1, h2, h3, h4, h5, h6, caption');
    if (text && cell !== lastCell && !/[\s.:;!?]$/.test(text)) text += lastCell?.tagName === 'DT' ? ': ' : '. ';
    segments.push({ node, start: text.length });
    text += node.data;
    lastCell = cell;
  }
  const locate = (index) => {
    for (let i = segments.length - 1; i >= 0; i--) {
      if (segments[i].start <= index) return { node: segments[i].node, offset: index - segments[i].start };
    }
    return null;
  };
  return { text, locate };
}

// Split text into chunks that end at sentence boundaries where possible.
export function chunks(text) {
  const out = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + CHUNK, text.length);
    if (end < text.length) {
      const slice = text.slice(start, end);
      const stop = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('? '), slice.lastIndexOf('! '), slice.lastIndexOf('; '));
      const space = slice.lastIndexOf(' ');
      end = start + (stop > 40 ? stop + 1 : space > 40 ? space : slice.length);
    }
    out.push({ start, text: text.slice(start, end) });
    start = end;
  }
  return out;
}

function markWord(map, index, length) {
  if (!('highlights' in CSS)) return;
  const at = map.locate(index);
  if (!at) return;
  const end = Math.min(at.offset + Math.max(length, 1), at.node.length);
  try {
    const range = new Range();
    range.setStart(at.node, at.offset);
    range.setEnd(at.node, end);
    wordHighlight ??= new Highlight();
    wordHighlight.clear();
    wordHighlight.add(range);
    CSS.highlights.set('hb-word', wordHighlight);
  } catch {
    // The text changed while speaking; skip this word.
  }
}

function clearMarks() {
  wordHighlight?.clear();
  document.querySelectorAll('.speaking').forEach((n) => n.classList.remove('speaking'));
}

function speakFrom(index) {
  for (let i = index; i < queue.length; i++) speechSynthesis.speak(queue[i].utterance);
  setState('speaking');
}

// Read elements in order.
export async function speakElements(elements, { rate = 1, lang = 'en' } = {}) {
  stop();
  if (!isSupported()) throw new SpeechError('no-voice', 'Read aloud isn’t available in this browser.');
  const voice = await chooseVoice(lang);

  queue = [];
  for (const el of elements) {
    const map = textMap(el);
    if (!map.text.trim()) continue;
    for (const chunk of chunks(map.text)) {
      const utterance = new SpeechSynthesisUtterance(chunk.text);
      const index = queue.length;
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = rate;
      utterance.onstart = () => {
        position = index;
        document.querySelectorAll('.speaking').forEach((n) => n !== el && n.classList.remove('speaking'));
        el.classList.add('speaking');
        el.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      };
      // Word positions arrive only from some voices; without them the whole block stays highlighted.
      utterance.onboundary = (event) => {
        if (event.name !== 'word') return;
        const length = event.charLength || (/^\S+/.exec(chunk.text.slice(event.charIndex))?.[0].length ?? 1);
        markWord(map, chunk.start + event.charIndex, length);
      };
      utterance.onend = () => {
        if (index === queue.length - 1 && state === 'speaking') {
          clearMarks();
          setState('idle');
        }
      };
      utterance.onerror = (event) => {
        if (event.error !== 'interrupted' && event.error !== 'canceled') {
          clearMarks();
          setState('idle');
        }
      };
      queue.push({ utterance, el });
    }
  }
  if (!queue.length) throw new SpeechError('empty', 'There is no text to read here.');

  // Chrome sometimes drops speech queued right after cancel(); give it a moment.
  await new Promise((resolve) => setTimeout(resolve, 50));
  position = 0;
  speakFrom(0);
}

// Chrome's own pause/resume is unreliable, so pause stops and remembers the sentence,
// and resume starts again from the start of that sentence.
export function pause() {
  if (state !== 'speaking') return;
  setState('paused');
  speechSynthesis.cancel();
}

export function resume() {
  if (state !== 'paused' || !queue.length) return;
  speakFrom(position);
}

export function stop() {
  if (isSupported()) speechSynthesis.cancel();
  queue = [];
  position = 0;
  clearMarks();
  setState('idle');
}
