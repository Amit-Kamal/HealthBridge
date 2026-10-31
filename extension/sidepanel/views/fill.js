// sidepanel/views/fill.js — "Fill in a form": one question at a time, answers written into
// the real form, a review screen, and the site's error messages after sending.
// Answers are kept in session storage (memory only, cleared when Chrome closes) so they
// can be put back if the portal signs the user out.

import { h, replace, announce, busy, focusOn, plural } from '../ui.js';
import { currentTab, sendToTab } from '../api.js';
import { guessAutocomplete, SAFE_INPUT_TYPES, displayValue, isEmpty } from '../../shared/fields.js';

const SAVE_MINUTES = 60;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let root;
let app;
let questions = [];
let index = 0;
let warned = new Set(); // questions where the user has already seen a "are you sure" note
let sentAt = 0;

export function init(container, appRef) {
  root = container;
  app = appRef;
  renderStart();
}

export function reset(reason) {
  // Many portals load a new page after Send; that is the expected ending, not an error.
  if (sentAt && Date.now() - sentAt < 20000 && (reason === 'loading' || reason === 'url')) {
    sentAt = 0;
    questions = [];
    replace(root,
      h('h2', {}, 'Fill in a form'),
      h('div', { className: 'notice notice-ok', role: 'status' },
        h('p', {}, h('strong', {}, 'The page changed after you sent the form.')),
        h('p', {}, 'If the new page shows a confirmation, you are done.')),
      startButton('Fill in another form'));
    return;
  }
  questions = [];
  renderStart(reason);
}

export function formChanged() {
  if (!questions.length || root.querySelector('#form-changed')) return;
  const note = h('div', { id: 'form-changed', className: 'notice notice-warn', role: 'status' },
    h('p', {}, 'This form changed. There may be new questions.'),
    h('button', { type: 'button', onclick: () => start() }, 'Read the form again'));
  root.querySelector('h2')?.after(note);
}

// ---------- Saved answers ----------

async function pageKey() {
  const tab = await currentTab();
  try {
    const url = new URL(tab?.url ?? '');
    return url.origin + url.pathname;
  } catch {
    return null;
  }
}

async function loadSaved() {
  const key = await pageKey();
  const { answers = {} } = await chrome.storage.session.get('answers');
  const saved = key && answers[key];
  if (!saved || Date.now() - saved.savedAt > SAVE_MINUTES * 60000) return null;
  return saved;
}

async function saveAnswer(question, value) {
  const key = await pageKey();
  if (!key) return;
  const { answers = {} } = await chrome.storage.session.get('answers');
  const entry = answers[key] ?? { savedAt: 0, values: {} };
  entry.values[question.key] = value;
  entry.savedAt = Date.now();
  answers[key] = entry;
  await chrome.storage.session.set({ answers });
}

async function forgetSaved() {
  const key = await pageKey();
  const { answers = {} } = await chrome.storage.session.get('answers');
  if (key && answers[key]) {
    delete answers[key];
    await chrome.storage.session.set({ answers });
  }
}

// ---------- Start ----------

function startButton(label = 'Start') {
  return h('button', { type: 'button', id: 'fill-start', className: 'primary wide', onclick: () => start() }, label);
}

function renderStart(reason) {
  replace(root,
    h('h2', {}, 'Fill in a form'),
    reason === 'loading' || reason === 'url' ? h('p', { className: 'notice' }, 'The page changed.') : null,
    h('p', {}, 'Answer one question at a time. HealthBridge types your answers into the form on the page.'),
    h('p', {}, h('strong', {}, 'Nothing is sent until you choose Send.')),
    h('p', { className: 'muted' }, 'Tip: press Enter to go to the next question. In a big text box, press Ctrl+Enter.'),
    h('p', { className: 'muted' }, 'If the site signs you out, HealthBridge can put your answers back. It keeps them in this browser’s memory for up to an hour, and Chrome deletes them when you close it.'),
    startButton(),
    h('div', { id: 'fill-saved' }));
  loadSaved().then((saved) => {
    const box = root.querySelector('#fill-saved');
    if (!saved || !box) return;
    const time = new Date(saved.savedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    box.replaceChildren(h('div', { className: 'notice' },
      h('p', {}, `You have ${plural(Object.keys(saved.values).length, 'answer')} saved from ${time} for this page.`),
      h('p', { className: 'muted' }, 'If the site signed you out, HealthBridge can put them back.'),
      h('div', { className: 'row' },
        h('button', { type: 'button', className: 'primary', onclick: () => start({ refill: true }) }, 'Put my answers back'),
        h('button', { type: 'button', onclick: async () => { await forgetSaved(); box.replaceChildren(); announce('Saved answers deleted.'); } }, 'Delete them'))));
  });
}

export async function start({ refill = false } = {}) {
  const button = root.querySelector('#fill-start') ?? h('button');
  await busy(button, async () => {
    try {
      const { questions: found } = await sendToTab('READ_FORM');
      if (!found.length) {
        root.replaceChildren(h('h2', {}, 'Fill in a form'),
          h('p', { className: 'notice', role: 'status' }, 'HealthBridge didn’t find any questions on this page.'),
          startButton('Look again'));
        return;
      }
      questions = found;
      index = 0;
      warned = new Set();
      if (refill) await putBack();
      renderQuestion();
    } catch (err) {
      root.replaceChildren(h('h2', {}, 'Fill in a form'), app.explainError(err), startButton('Try again'));
    }
  });
}

async function putBack() {
  const saved = await loadSaved();
  if (!saved) return;
  let count = 0;
  for (const q of questions) {
    if (!(q.key in saved.values) || q.kind === 'unsupported') continue;
    try {
      const result = await sendToTab('FILL_FIELD', { id: q.id, value: saved.values[q.key] });
      q.value = result.value;
      if (result.stuck) count++;
    } catch {
      // The field moved or changed; the user can answer it again.
    }
  }
  announce(`Put back ${plural(count, 'answer')}. Check each one.`);
}

// ---------- One question ----------

function controlFor(q, id, describedBy) {
  const common = { id, 'aria-describedby': describedBy || null };
  if (q.kind === 'select') {
    return h('select', common, q.options.map((o) => h('option', { value: o.value, selected: o.value === q.value }, o.label || o.value)));
  }
  if (q.kind === 'textarea') return h('textarea', { ...common, value: q.value ?? '', maxLength: q.maxLength ?? null });
  if (q.kind === 'radio') {
    return h('div', {}, q.options.map((o, i) =>
      h('label', { className: 'choice' },
        h('input', { type: 'radio', name: id, id: i === 0 ? id : null, value: o.value, checked: o.value === q.value, 'aria-describedby': i === 0 ? describedBy || null : null }),
        h('span', {}, o.label || o.value))));
  }
  const type = SAFE_INPUT_TYPES.has(q.inputType) ? q.inputType : 'text';
  return h('input', {
    ...common,
    type,
    value: q.value ?? '',
    autocomplete: q.autocomplete && q.autocomplete !== 'off' ? q.autocomplete : guessAutocomplete(q.label, type),
    min: q.min ?? null,
    max: q.max ?? null,
    maxLength: q.maxLength ?? null,
  });
}

function readValue(q, form) {
  if (q.kind === 'checkbox') return form.querySelector('input[type=checkbox]').checked;
  if (q.kind === 'radio') return form.querySelector('input[type=radio]:checked')?.value ?? '';
  return form.querySelector('input, select, textarea')?.value ?? '';
}

function renderQuestion({ message } = {}) {
  const q = questions[index];
  const id = `q-${index}`;
  const position = `Question ${index + 1} of ${questions.length}`;
  const guessed = q.labelSource === 'guess' || q.labelSource === 'none';
  const requiredText = q.required && !/required/i.test(q.label) ? ' (required)' : '';
  const notes = [];
  if (message) notes.push(h('div', { id: 'q-message', className: 'notice notice-warn' }, h('p', {}, message)));
  if (q.error?.message) notes.push(h('p', { id: 'q-error', className: 'notice notice-error' }, h('strong', {}, 'The site says: '), q.error.message));
  if (guessed) {
    notes.push(h('p', { id: 'q-guess', className: 'notice notice-warn' },
      q.labelSource === 'none'
        ? 'The site didn’t name this question, and HealthBridge couldn’t guess it. Use “Show on page” to see it.'
        : `The site didn’t name this question. HealthBridge thinks it asks for: ${q.label}. Use “Show on page” to check.`));
  }
  if (q.hint) notes.push(h('p', { id: 'q-hint', className: 'muted' }, q.hint));
  const describedBy = notes.map((n) => n.id).filter(Boolean).join(' ');

  const labelText = [h('span', { className: 'visually-hidden' }, `${position}: `), q.label, requiredText];
  let body;
  if (q.kind === 'unsupported') {
    body = [h('p', { className: 'question-label' }, ...labelText),
      h('p', { className: 'notice' }, 'HealthBridge can’t fill in this kind of question. Please answer it on the page, then press Next.')];
  } else if (q.kind === 'radio') {
    body = [h('fieldset', {}, h('legend', { className: 'question-label' }, ...labelText), controlFor(q, id, describedBy))];
  } else if (q.kind === 'checkbox') {
    body = [h('label', { className: 'choice question-label' },
      h('input', { id, type: 'checkbox', checked: Boolean(q.value), 'aria-describedby': describedBy || null }),
      h('span', {}, ...labelText))];
  } else {
    body = [h('label', { className: 'question-label', htmlFor: id }, ...labelText), controlFor(q, id, describedBy)];
  }

  const form = h('form', { className: 'question', noValidate: true },
    h('p', { id: 'q-position', 'aria-hidden': 'true' }, position),
    h('progress', { max: questions.length, value: index + 1, 'aria-hidden': 'true' }),
    q.section ? h('p', { className: 'muted' }, `Part: ${q.section}`) : null,
    ...body,
    ...notes,
    h('div', { className: 'row' },
      h('button', { type: 'button', disabled: index === 0, onclick: () => move(q, form, -1) }, 'Back'),
      h('button', { type: 'submit', className: 'primary' }, index === questions.length - 1 ? 'Check my answers' : 'Next'),
      h('button', { type: 'button', className: 'link', onclick: () => sendToTab('SHOW_FIELD', { id: q.id }).catch((e) => announce(e.message)) }, 'Show on page')));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    move(q, form, 1);
  });
  // Enter means "next question" everywhere, including drop-downs and choices, where
  // browsers don't submit on Enter. Text areas keep Enter for new lines and use
  // Ctrl+Enter (Cmd+Enter on a Mac) instead.
  form.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.altKey) return;
    const inTextArea = event.target.matches('textarea');
    const modifier = event.ctrlKey || event.metaKey;
    if (inTextArea ? modifier : !modifier && event.target.matches('select, input[type=radio], input[type=checkbox]')) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  root.replaceChildren(h('h2', {}, 'Fill in a form'), form);
  (form.querySelector('input:checked') ?? form.querySelector('input, select, textarea') ?? form.querySelector('button[type=submit]')).focus();
}

let moving = false;

async function move(q, form, step) {
  if (moving) return;
  moving = true;
  try {
    if (q.kind !== 'unsupported' && !q.readOnly) {
      const value = readValue(q, form);
      if (step > 0 && q.required && isEmpty(value) && !warned.has(q.id)) {
        warned.add(q.id);
        renderQuestion({ message: 'This question is required. The site may not accept the form without it. Press Next again to skip it for now.' });
        return;
      }
      if (value !== q.value) {
        const result = await sendToTab('FILL_FIELD', { id: q.id, value });
        q.value = result.value;
        if (!isEmpty(value)) await saveAnswer(q, value);
        if (!result.stuck && !warned.has(`${q.id}:stuck`)) {
          warned.add(`${q.id}:stuck`);
          renderQuestion({ message: `The site changed this answer to “${displayValue(q, result.value)}”. Check it, then press Next again.` });
          return;
        }
      }
    }
    index += step;
    if (index >= questions.length) renderReview();
    else renderQuestion();
  } catch (err) {
    renderQuestion({ message: err.message });
  } finally {
    moving = false;
  }
}

// ---------- Review and send ----------

function renderReview() {
  const missing = questions.filter((q) => q.required && isEmpty(q.value) && q.kind !== 'unsupported');
  replace(root,
    h('h2', {}, 'Fill in a form'),
    h('h3', { id: 'review-heading' }, 'Check your answers'),
    missing.length
      ? h('div', { className: 'notice notice-warn' }, h('p', {}, `${plural(missing.length, 'required question')} ${missing.length === 1 ? 'has' : 'have'} no answer.`))
      : null,
    h('dl', { className: 'review' }, questions.flatMap((q, i) => [
      h('dt', {}, q.label),
      h('dd', {},
        h('span', {}, q.kind === 'unsupported' ? 'Answered on the page' : displayValue(q, q.value)),
        h('button', { type: 'button', 'aria-label': `Change ${q.label}`, onclick: () => { index = i; renderQuestion(); } }, 'Change')),
    ])),
    h('p', { className: 'notice' }, h('strong', {}, 'Nothing has been sent yet. '), 'When you press Send, HealthBridge presses the form’s own Send button on the page.'),
    h('div', { className: 'row' },
      h('button', { type: 'button', id: 'fill-send', className: 'primary', onclick: (e) => send(e.currentTarget) }, 'Send the form'),
      h('button', { type: 'button', onclick: () => { index = questions.length - 1; renderQuestion(); } }, 'Back to the questions')));
  focusOn(root.querySelector('#review-heading'));
}

async function send(button) {
  await busy(button, async () => {
    let result;
    try {
      result = await sendToTab('SUBMIT_FORM');
    } catch (err) {
      renderResult({ sent: false, errors: [], alerts: [err.message] });
      return;
    }
    if (!result.submitted) {
      renderResult({ ...result, sent: false });
      return;
    }
    sentAt = Date.now();
    announce('Sending…');
    await wait(1500); // give the site time to show errors or a confirmation
    try {
      renderResult({ ...(await sendToTab('CHECK_FORM')), sent: true });
    } catch {
      renderResult({ sent: true, errors: [], alerts: [], confirmation: '' });
    }
  });
}

function renderResult({ sent, errors = [], alerts = [], confirmation = '' }) {
  const fixButton = (error) => {
    const at = questions.findIndex((q) => q.id === error.id);
    return at < 0 ? null : h('button', { type: 'button', onclick: () => { index = at; warned = new Set(); questions[at].error = error; renderQuestion(); } }, `Fix “${error.label}”`);
  };
  const parts = [h('h2', {}, 'Fill in a form')];

  if (errors.length || (!sent && alerts.length)) {
    sentAt = 0;
    parts.push(h('div', { className: 'notice notice-error' },
      h('h3', { id: 'result-heading' }, sent ? 'The site found a problem with your answers' : 'The form was not sent'),
      h('ul', {}, errors.map((e) => h('li', {},
        h('p', {}, h('strong', {}, `${e.label}: `), e.message),
        e.linked ? null : h('p', { className: 'muted' }, 'The site shows this message on the page but doesn’t tell screen readers about it.'),
        fixButton(e)))),
      alerts.length ? h('ul', {}, alerts.map((a) => h('li', {}, a))) : null));
  } else if (confirmation) {
    forgetSaved();
    parts.push(h('div', { className: 'notice notice-ok' },
      h('h3', { id: 'result-heading' }, 'The form was sent'),
      h('p', {}, h('strong', {}, 'The site says: '), confirmation)));
  } else {
    parts.push(h('div', { className: 'notice' },
      h('h3', { id: 'result-heading' }, 'HealthBridge pressed Send'),
      h('p', {}, 'The site didn’t show a clear message. Please look at the page to check that it worked.'),
      alerts.length ? h('ul', {}, alerts.map((a) => h('li', {}, a))) : null));
  }
  parts.push(startButton('Start again'));
  replace(root, ...parts);
  focusOn(root.querySelector('#result-heading'));
}
