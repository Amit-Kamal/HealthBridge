// sidepanel/views/read.js — "Read this page": the page as simple blocks with hard words
// explained, its reading level, read aloud with word highlighting, and the page's links
// and buttons as big buttons.

import { h, replace, announce, busy, focusOn, plural, safeHref } from '../ui.js';
import { sendToTab } from '../api.js';
import { splitTerms } from '../../shared/glossary.js';
import { readingLevel, blockGrade } from '../../shared/readability.js';
import { rowFlagNote } from '../../shared/labs.js';
import { missingFacts, negationsDropped } from '../../shared/textSafety.js';
import * as speech from '../speech.js';
import { aiStatus, simplify } from '../ai.js';

const LEVEL_TEXT = { easy: 'easy to read', ok: 'fairly easy to read', hard: 'hard to read', 'very-hard': 'very hard to read' };
const HARD_GRADE = 12;

let root;
let app;
let page = null;
let ai = { state: 'unavailable' };
let termSeq = 0;
let rate = 1;

export function init(container, appRef) {
  root = container;
  app = appRef;
  speech.onStateChange(updateSpeakButtons);
  aiStatus().then((status) => { ai = status; });
  chrome.storage.local.get('speechRate').then(({ speechRate }) => { rate = Number(speechRate) || 1; });
  renderStart();
}

export function reset(reason) {
  speech.stop();
  page = null;
  renderStart(reason);
}

function renderStart(reason) {
  replace(root,
    h('h2', {}, 'Read this page'),
    reason === 'loading' || reason === 'url'
      ? h('p', { className: 'notice' }, 'The page changed. Press the button to read the new page.')
      : null,
    h('p', {}, 'See this page as simple text. HealthBridge explains hard words and can read the page aloud.'),
    h('button', { type: 'button', id: 'read-start', className: 'primary wide', onclick: (e) => load(e.currentTarget) }, 'Make this page easy to read'),
    h('div', { id: 'read-selection' }),
    h('div', { id: 'read-out' })
  );
}

async function load(button) {
  const out = root.querySelector('#read-out');
  return busy(button, async () => {
    try {
      announce('Reading the page…');
      page = await sendToTab('READ_PAGE');
      renderPage(out);
      announce(`Easy read is ready, with ${plural(page.blocks.length, 'part')}.`);
      focusOn(out.querySelector('h3'));
    } catch (err) {
      out.replaceChildren(app.explainError(err));
    }
  });
}

// ---------- Rendering ----------

function renderPage(out) {
  termSeq = 0;
  const seen = new Set();
  const level = readingLevel(page.blocks.filter((b) => b.kind === 'text').map((b) => b.text));

  const content = h('div', { id: 'reader-content' });
  let list = null;
  page.blocks.forEach((block, index) => {
    if (block.kind === 'text' && block.listItem) {
      if (!list) content.append((list = h('ul', {})));
      list.append(renderBlock(block, index, seen));
      return;
    }
    list = null;
    content.append(renderBlock(block, index, seen));
  });

  const headings = page.blocks.map((b, index) => ({ ...b, index })).filter((b) => b.kind === 'heading');
  const hard = level.level === 'hard' || level.level === 'very-hard';

  replace(out,
    h('h3', {}, page.title ? `Easy read: ${page.title}` : 'Easy read'),
    level.grade == null
      ? null
      : h('div', { className: `notice ${hard ? 'notice-warn' : 'notice-ok'}` },
          h('p', {}, h('strong', {}, `Reading level: about grade ${Math.round(level.grade)}`), ` (${LEVEL_TEXT[level.level]}).`),
          h('p', {}, hard
            ? 'Experts advise writing health information at a 6th-grade reading level or lower. Hard parts have a line beside them. Tap an underlined word to see what it means.'
            : 'Tap an underlined word to see what it means.')),
    speakControls(),
    headings.length >= 2
      ? h('nav', { 'aria-labelledby': 'outline-heading' },
          h('h3', { id: 'outline-heading' }, 'On this page'),
          h('ul', { className: 'outline' }, headings.map((b) =>
            h('li', {}, h('button', { type: 'button', className: 'link', onclick: () => focusOn(content.querySelector(`[data-index="${b.index}"]`)) }, b.text)))))
      : null,
    content,
    page.actions.length ? actionsSection() : null
  );
}

function renderBlock(block, index, seen) {
  const dataset = { index: String(index) };

  if (block.kind === 'heading') {
    // The panel already uses h1 and h2, so the page's h1 becomes h3.
    const level = Math.min(Math.max(block.level, 1) + 2, 6);
    return h(`h${level}`, { className: 'reader-block', dataset }, withTerms(block.text, seen));
  }

  if (block.kind === 'table') {
    return h('div', { className: 'reader-block', dataset },
      block.caption ? h('p', {}, h('strong', {}, block.caption)) : null,
      block.guessedHeaders ? h('p', { className: 'muted no-speak' }, 'This table had no column names, so HealthBridge used its first row.') : null,
      h('ul', { className: 'cards' }, block.rows.map((cells) => {
        const note = rowFlagNote(cells);
        return h('li', { className: 'card row-card' },
          h('dl', {}, cells.flatMap((c) => [h('dt', {}, c.header), h('dd', {}, withTerms(c.value, seen))])),
          note ? h('p', { className: 'flag-note' }, note) : null);
      })));
  }

  if (block.kind === 'form') {
    return h('div', { className: 'reader-block notice', dataset },
      h('p', {}, h('strong', {}, 'This page has a form.')),
      h('button', { type: 'button', className: 'primary no-speak', onclick: () => app.startFill() }, 'Fill it in one question at a time'));
  }

  const grade = blockGrade(block.text);
  const isHard = grade != null && grade > HARD_GRADE;
  return h(block.listItem ? 'li' : 'p', { className: `reader-block${isHard ? ' hard' : ''}`, dataset },
    withTerms(block.text, seen),
    isHard ? h('span', { className: 'visually-hidden no-speak' }, ' (hard to read)') : null,
    isHard && ai.state !== 'unavailable' ? aiButton(block.text) : null);
}

// Each glossary word is explained once per page, right after the word, so the
// explanation is in reading order for screen reader users.
function withTerms(text, seen) {
  return splitTerms(text).map((part) => {
    if (typeof part === 'string') return part;
    if (seen.has(part.entry.term)) return part.term;
    seen.add(part.entry.term);
    return termButton(part);
  });
}

// "Learn more" opens MedlinePlus (U.S. National Library of Medicine) only when clicked.
function learnMoreLink(entry) {
  const href = safeHref(entry.learnMore);
  return href ? [' ', h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, `Learn more about ${entry.term} on MedlinePlus (opens a new tab)`)] : null;
}

function termButton({ term, entry }) {
  const id = `term-${++termSeq}`;
  const definition = h('span', { className: 'definition', id, hidden: true }, h('strong', {}, `${entry.term}: `), entry.definition, learnMoreLink(entry));
  const button = h('button', { type: 'button', className: 'term', 'aria-expanded': 'false', 'aria-controls': id },
    term, h('span', { className: 'visually-hidden' }, ' (explain)'));
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    definition.hidden = !open;
  });
  return [button, definition];
}

function aiButton(text) {
  const out = h('span', { className: 'no-speak', 'aria-live': 'polite' });
  const button = h('button', { type: 'button', className: 'link no-speak' }, 'Say it more simply');
  button.addEventListener('click', () => busy(button, async () => {
    out.replaceChildren(h('span', { className: 'muted' }, ' Writing a simpler version on this computer…'));
    try {
      const rewrite = await simplify(text, {
        onProgress: (percent) => out.replaceChildren(` Getting Chrome’s built-in AI ready: ${percent}%`),
      });
      // Check the rewrite against the original before showing it.
      const missing = missingFacts(text, rewrite);
      const warnings = [
        missing.length ? `it may have left out: ${missing.join(', ')}` : '',
        negationsDropped(text, rewrite) ? 'it may have dropped a “not” or “no”, which can change the meaning' : '',
      ].filter(Boolean);
      out.replaceChildren(h('span', { className: 'ai-text definition' },
        h('strong', {}, 'Simpler version, written by AI on this computer. It can make mistakes: '),
        rewrite,
        warnings.length ? h('span', { className: 'definition', role: 'alert' }, `Check the original above. Compared with it, ${warnings.join('; and ')}.`) : null));
    } catch (err) {
      out.replaceChildren(h('span', { className: 'muted' }, ` ${err.message}`));
    }
  }));
  return [' ', button, out];
}

// ---------- Buttons and links ----------

function actionsSection() {
  return h('section', { id: 'read-actions', 'aria-labelledby': 'actions-heading' },
    h('h3', { id: 'actions-heading' }, 'Buttons and links on this page'),
    h('p', { className: 'muted' }, 'You can press them here instead. If the site gave one no name, HealthBridge guessed it.'),
    h('ul', { className: 'actions-list' }, page.actions.map((action) => {
      const name = action.name || (action.kind === 'link' ? 'Link with no name' : 'Button with no name');
      return h('li', {},
        h('button', { type: 'button', onclick: () => press(action, name) }, name, action.guessed ? h('span', { className: 'muted' }, ' (name guessed)') : null),
        h('button', { type: 'button', 'aria-label': `Show ${name} on the page`, onclick: () => show(action.id, name) }, 'Show'));
    })));
}

async function press(action, name) {
  try {
    await sendToTab('ACTIVATE', { id: action.id });
    announce(`Pressed ${name}.`);
  } catch (err) {
    announce(err.message);
  }
}

async function show(id, label) {
  try {
    await sendToTab('HIGHLIGHT', { id, label });
    announce(`${label} is outlined on the page.`);
  } catch (err) {
    announce(err.message);
  }
}

export async function showActions() {
  if (!page) await load(root.querySelector('#read-start'));
  focusOn(root.querySelector('#actions-heading'));
}

// ---------- Read aloud ----------

function speakControls() {
  const slider = h('input', { type: 'range', id: 'speech-rate', min: '0.6', max: '1.4', step: '0.1', value: String(rate) });
  const describe = () => slider.setAttribute('aria-valuetext', rate < 0.95 ? `${rate} times, slower` : rate > 1.05 ? `${rate} times, faster` : 'normal speed');
  describe();
  slider.addEventListener('input', () => {
    rate = Number(slider.value);
    describe();
    chrome.storage.local.set({ speechRate: rate });
  });
  return h('div', { className: 'notice', role: 'group', 'aria-labelledby': 'speak-heading' },
    h('h3', { id: 'speak-heading' }, 'Read aloud'),
    h('div', { className: 'row' },
      h('button', { type: 'button', id: 'speak-toggle', className: 'primary', onclick: toggleSpeech }, 'Read aloud'),
      h('button', { type: 'button', id: 'speak-stop', hidden: true, onclick: () => speech.stop() }, 'Stop')),
    h('label', { htmlFor: 'speech-rate' }, 'Reading speed'),
    slider,
    h('div', { id: 'speak-error', className: 'muted' }));
}

// One button for start, pause and resume, so keyboard focus never disappears.
async function toggleSpeech() {
  const state = speech.getState();
  if (state === 'speaking') return speech.pause();
  if (state === 'paused') return speech.resume();
  const blocks = [...root.querySelectorAll('#reader-content .reader-block')];
  // Start from the first part you can see, so scrolling down and pressing play reads from there.
  const start = Math.max(0, blocks.findIndex((b) => b.getBoundingClientRect().bottom > 0));
  await speakWithConsent(blocks.slice(start), root.querySelector('#speak-error'));
}

// Speak, and if the only voices are online ones, ask before sending any text to Google.
async function speakWithConsent(elements, messageBox) {
  messageBox.replaceChildren();
  try {
    await speech.speakElements(elements, { rate, lang: page?.lang || 'en' });
  } catch (err) {
    if (err.code !== 'online-only') {
      messageBox.replaceChildren(err.message);
      announce(err.message);
      return;
    }
    messageBox.replaceChildren(h('span', { className: 'notice notice-warn', role: 'alert', style: 'display:block' },
      h('strong', {}, 'Use an online voice? '), err.message,
      h('span', { className: 'row' },
        h('button', {
          type: 'button',
          onclick: async () => {
            await chrome.storage.local.set({ allowOnlineVoices: true });
            speakWithConsent(elements, messageBox);
          },
        }, 'Use online voices'),
        h('button', { type: 'button', onclick: () => messageBox.replaceChildren('Read aloud is off. You can change this on the Display tab.') }, 'No thanks'))));
    messageBox.querySelector('button')?.focus();
  }
}

function updateSpeakButtons(state) {
  const toggle = root.querySelector('#speak-toggle');
  const stopButton = root.querySelector('#speak-stop');
  if (!toggle) return;
  toggle.textContent = state === 'speaking' ? 'Pause' : state === 'paused' ? 'Keep reading' : 'Read aloud';
  stopButton.hidden = state === 'idle';
  if (state === 'idle' && document.activeElement === stopButton) toggle.focus();
}

// ---------- Text sent from the right-click menu ----------

export function handleSelection({ action, text }) {
  const box = root.querySelector('#read-selection');
  const para = h('p', { className: 'reader-block' }, text);
  const message = h('div', { className: 'muted' });
  const unique = [...new Map(splitTerms(text).filter((p) => typeof p !== 'string').map((p) => [p.entry.term, p.entry])).values()];
  box.replaceChildren(h('section', { className: 'notice', 'aria-labelledby': 'selection-heading' },
    h('h3', { id: 'selection-heading' }, action === 'read' ? 'Reading the text you chose' : 'The text you chose'),
    para,
    action === 'explain'
      ? unique.length
        ? h('dl', {}, unique.flatMap((entry) => [h('dt', {}, h('strong', {}, entry.term)), h('dd', {}, entry.definition, learnMoreLink(entry))]))
        : h('p', {}, 'HealthBridge has no explanations for the words in this text.')
      : null,
    action === 'explain' && ai.state !== 'unavailable' ? h('p', {}, aiButton(text)) : null,
    h('div', { className: 'row' },
      h('button', { type: 'button', onclick: () => speakWithConsent([para], message) }, 'Read aloud'),
      h('button', { type: 'button', onclick: () => { speech.stop(); box.replaceChildren(); } }, 'Close')),
    message));
  focusOn(box.querySelector('h3'));
  if (action === 'read') speakWithConsent([para], message);
}
