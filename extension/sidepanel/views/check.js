// sidepanel/views/check.js — "Check this site": axe-core results plus HealthBridge's own
// checks as a report card. Every problem says who it affects, can be shown on the page,
// and offers a HealthBridge workaround where there is one.

import { h, replace, announce, busy, focusOn, plural, safeHref } from '../ui.js';
import { sendToTab } from '../api.js';
import { scoreScan, sortByImpact, splitByVersion, WEIGHTS } from '../../shared/scoring.js';
import { helpFor, WHO } from '../../shared/ruleHelp.js';
import { CHECK_HELP, MANUAL_CHECKS } from '../../shared/checkHelp.js';
import { criteriaFromTags, describeCriterion } from '../../shared/wcag.js';
import { readingLevel } from '../../shared/readability.js';
import { feedbackMessage, reportHtml, NEEDS } from '../../shared/report.js';

const IMPACT_LABEL = { critical: 'Blocker', serious: 'Serious', moderate: 'Moderate', minor: 'Minor' };
const LEVEL_TEXT = { easy: 'easy', ok: 'fairly easy', hard: 'hard', 'very-hard': 'very hard' };
const TASKS = ['use the portal', 'book a visit', 'see my test results', 'pay a bill', 'send a message to my care team', 'fill in a form'];

// Workarounds HealthBridge can switch on from a problem card.
const ACTIONS = {
  contrast: ['Turn on high contrast', (app) => app.turnOnDisplay('contrast')],
  spacing: ['Turn on more spacing', (app) => app.turnOnDisplay('spacing')],
  focus: ['Turn on a strong focus outline', (app) => app.turnOnDisplay('focus')],
  targets: ['Turn on bigger buttons', (app) => app.turnOnDisplay('targets')],
  motion: ['Stop moving things', (app) => app.turnOnDisplay('motion')],
  zoom: ['Make the page bigger', (app) => app.zoomPage(1.5)],
  helper: ['Use the form helper', (app) => app.startFill()],
  actions: ['Press buttons from HealthBridge', (app) => app.showActions()],
  reader: ['Use Easy read', (app) => app.selectTab('read')],
};

let root;
let app;
let last = null; // { scan, summary }

export function init(container, appRef) {
  root = container;
  app = appRef;
  renderStart();
}

export function reset(reason) {
  last = null;
  renderStart(reason);
}

function renderStart(reason) {
  replace(root,
    h('h2', {}, 'Check this site'),
    reason === 'loading' || reason === 'url' ? h('p', { className: 'notice' }, 'The page changed. Check it again to see its problems.') : null,
    h('p', {}, 'HealthBridge looks for problems that make this page hard to use. Checking doesn’t change the page.'),
    h('button', { type: 'button', id: 'check-start', className: 'primary wide', onclick: (e) => run(e.currentTarget) }, 'Check this page'),
    h('div', { id: 'check-out' }));
}

async function run(button) {
  const out = root.querySelector('#check-out');
  await busy(button, async () => {
    try {
      announce('Checking the page. This takes a few seconds.');
      out.replaceChildren(h('p', { role: 'status' }, 'Checking…'));
      const scan = await sendToTab('SCAN');
      const summary = scoreScan(splitByVersion(scan.violations).graded);
      last = { scan, summary };
      render(out, scan, summary);
      const found = scan.violations.length + scan.checks.length;
      announce(`Check finished. Grade ${summary.grade}. ${plural(found, 'kind of problem', 'kinds of problems')} found.`);
      focusOn(out.querySelector('#grade-heading'));
    } catch (err) {
      out.replaceChildren(app.explainError(err));
    }
  });
}

// ---------- Report card ----------

function render(out, scan, summary) {
  const { graded, newer } = splitByVersion(sortByImpact(scan.violations));
  const level = readingLevel(scan.textBlocks ?? []);

  replace(out,
    h('section', { className: 'card', 'aria-labelledby': 'grade-heading' },
      h('h3', { id: 'grade-heading' }, `Result: grade ${summary.grade}`),
      h('div', { className: 'grade' },
        h('p', { className: 'grade-letter', 'aria-hidden': 'true' }, summary.grade),
        h('div', {},
          h('p', {}, h('strong', {}, `${summary.score} out of 100`)),
          h('p', {}, summary.blockers ? `${plural(summary.blockers, 'problem')} can stop people finishing a task.` : 'No problems that stop people finishing a task were found.'))),
      h('p', {}, h('strong', {}, 'These are the site’s problems, not yours.'), ' If something on this page was hard to use, it is not your fault.'),
      h('p', { className: 'notice notice-warn' }, 'This grade comes from automated checks. They find only some problems, so a good grade doesn’t prove a site is easy to use.'),
      h('ul', {}, ['critical', 'serious', 'moderate', 'minor'].map((k) => h('li', {}, `${IMPACT_LABEL[k]}: ${summary.byImpact[k]}`))),
      level.grade != null ? h('p', {}, `Reading level of the page: about grade ${Math.round(level.grade)} (${LEVEL_TEXT[level.level]}).`) : null,
      h('details', {},
        h('summary', {}, 'How the grade works'),
        h('p', {}, `Only WCAG 2.1 problems count, because that is the version US health rules use. Each kind of problem costs points: blocker ${WEIGHTS.critical}, serious ${WEIGHTS.serious}, moderate ${WEIGHTS.moderate}, minor ${WEIGHTS.minor}. A problem that repeats in many places costs up to twice as much. Any blocker limits the grade to C. WCAG 2.2 problems and HealthBridge’s own checks don’t change the grade.`)),
      shareTools(scan, summary)),

    h('h3', {}, `Problems found by automated checks (${graded.length})`),
    h('p', { className: 'muted' }, 'These use WCAG 2.1 Level A and AA, the standard US health rules use. They set the grade.'),
    graded.length
      ? h('ul', { className: 'cards' }, graded.map(issueCard))
      : h('p', {}, 'The automated checks found no problems.'),

    newer.length ? h('h3', {}, `Problems from WCAG 2.2, the newest version (${newer.length})`) : null,
    newer.length ? h('p', { className: 'muted' }, 'Not part of the grade, because US rules still use WCAG 2.1. They can still get in your way.') : null,
    newer.length ? h('ul', { className: 'cards' }, newer.map(issueCard)) : null,

    h('h3', {}, `More problems HealthBridge found (${scan.checks.length})`),
    h('p', { className: 'muted' }, 'These are problems automated checks can’t test. They are not part of the grade.'),
    scan.checks.length
      ? h('ul', { className: 'cards' }, scan.checks.map(checkCard))
      : h('p', {}, 'HealthBridge’s own checks found nothing.'),

    scan.incomplete.length
      ? h('details', {},
          h('summary', {}, `Needs a person to check (${scan.incomplete.length})`),
          h('ul', {}, scan.incomplete.map((v) => h('li', {}, `${helpFor(v).title} (${plural(v.nodeCount, 'place')})`))))
      : null,

    h('details', {},
      h('summary', {}, 'Check these yourself'),
      h('ul', {}, MANUAL_CHECKS.map((m) => h('li', {}, h('strong', {}, m.title), ' ', m.detail)))),

    h('p', { className: 'muted' },
      `Checked with axe-core ${scan.engine} using WCAG 2.1 and 2.2 Level A and AA rules. ${plural(scan.passCount, 'rule')} passed.`,
      scan.frameCount ? ` ${plural(scan.frameCount, 'embedded frame')} (such as a payment box) ${scan.frameCount === 1 ? 'was' : 'were'} not checked.` : ''));
}

function showButton(nodes, label) {
  const targets = nodes.filter((n) => n.id);
  if (!targets.length) return null;
  let at = -1;
  const button = h('button', { type: 'button' }, 'Show on page');
  button.addEventListener('click', async () => {
    at = (at + 1) % targets.length;
    try {
      await sendToTab('HIGHLIGHT', { id: targets[at].id, label });
      announce(targets.length > 1 ? `Outlined place ${at + 1} of ${targets.length} on the page.` : 'Outlined on the page.');
      if (targets.length > 1) button.textContent = `Show place ${((at + 1) % targets.length) + 1} of ${targets.length}`;
    } catch (err) {
      announce(err.message);
    }
  });
  return button;
}

function actionButton(key) {
  const action = ACTIONS[key];
  if (!action) return null;
  const [label, runAction] = action;
  return h('button', { type: 'button', className: 'primary', onclick: () => runAction(app) }, label);
}

const whoLine = (who = []) => (who.length ? h('p', { className: 'muted' }, `Affects: ${who.map((k) => WHO[k]).join(', ')}.`) : null);

function issueCard(v) {
  const help = helpFor(v);
  const criteria = criteriaFromTags(v.tags);
  const href = safeHref(v.helpUrl);
  return h('li', { className: `card impact-${v.impact}` },
    h('h4', {}, help.title),
    h('p', {}, h('span', { className: 'chip' }, IMPACT_LABEL[v.impact] ?? v.impact), ` Found in ${plural(v.nodeCount, 'place')}.`),
    h('p', {}, help.forYou),
    whoLine(help.who),
    h('div', { className: 'row' }, actionButton(help.action), showButton(v.nodes, help.title)),
    h('details', {},
      h('summary', {}, 'Details for the site’s developers'),
      h('p', {}, `axe-core rule “${v.id}”: ${v.help}.`),
      criteria.length ? h('p', {}, `WCAG: ${criteria.map((c) => `${c.number} ${c.name} (Level ${c.level})`).join('; ')}`) : null,
      href ? h('p', {}, h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, 'How to fix it (opens in a new tab)')) : null));
}

function checkCard(c) {
  const help = CHECK_HELP[c.id] ?? { title: c.id, forYou: '', who: [] };
  const criterion = help.criterion ? describeCriterion(help.criterion) : null;
  return h('li', { className: `card ${c.confidence === 'likely' ? 'impact-serious' : ''}` },
    h('h4', {}, help.title),
    h('p', {}, h('span', { className: 'chip' }, c.confidence === 'likely' ? 'Likely problem' : 'Possible problem'), c.confidence === 'likely' ? '' : ' Please check this one yourself.'),
    h('p', {}, help.forYou),
    whoLine(help.who),
    h('div', { className: 'row' }, actionButton(help.action), showButton(c.nodes ?? [], help.title)),
    criterion || c.examples?.length
      ? h('details', {},
          h('summary', {}, 'Details for the site’s developers'),
          criterion ? h('p', {}, `WCAG ${criterion.number} ${criterion.name} (Level ${criterion.level}).`) : null,
          c.examples?.length ? h('ul', {}, c.examples.map((e) => h('li', {}, h('code', {}, e)))) : null)
      : null);
}

// ---------- Telling the clinic ----------

function shareTools(scan, summary) {
  const box = h('div', { id: 'share-box' });
  return h('div', {},
    h('div', { className: 'row' },
      h('button', { type: 'button', onclick: () => openMessage(box, scan) }, 'Write a message to the clinic'),
      h('button', { type: 'button', onclick: () => saveReport(scan, summary) }, 'Save the full report')),
    h('p', { className: 'muted' }, 'The message and report include the page address and the problems found. They never include anything you typed.'),
    box);
}

// Many clinics must name a Section 1557 coordinator to handle these requests (45 CFR 92.7).
function sendToTip() {
  return h('p', { className: 'muted' },
    h('strong', {}, 'Who to send it to: '),
    'the clinic’s patient relations team, or its Section 1557 coordinator. Many clinics must name this person in their nondiscrimination notice, which is often linked at the bottom of their website.');
}

const NEED_LABELS = {
  phone: 'Book and get help by phone or in person',
  time: 'More time before being signed out',
  formats: 'Large print or another format for documents',
  caregiver: 'Access for a caregiver who helps me',
};

function openMessage(box, scan) {
  const select = h('select', { id: 'share-task' }, TASKS.map((t) => h('option', { value: t }, t)));
  const needBoxes = Object.keys(NEEDS).map((key) => h('input', { type: 'checkbox', id: `need-${key}`, value: key }));
  const text = h('textarea', { id: 'share-text', rows: 12 });
  const update = () => {
    text.value = feedbackMessage(scan, { task: select.value, needs: needBoxes.filter((b) => b.checked).map((b) => b.value) });
  };
  update();
  select.addEventListener('change', update);
  needBoxes.forEach((b) => b.addEventListener('change', update));
  box.replaceChildren(h('div', { className: 'notice' },
    h('h4', { id: 'share-heading' }, 'Message to the clinic'),
    h('label', { htmlFor: 'share-task' }, 'What were you trying to do?'),
    select,
    h('fieldset', {},
      h('legend', {}, 'What would help you until it is fixed? (optional)'),
      needBoxes.map((b) => h('label', { className: 'choice', htmlFor: b.id }, b, h('span', {}, NEED_LABELS[b.value])))),
    h('label', { htmlFor: 'share-text' }, 'Your message (you can change it)'),
    text,
    sendToTip(),
    h('div', { className: 'row' },
      h('button', { type: 'button', className: 'primary', onclick: () => copy(text.value) }, 'Copy the message'))));
  focusOn(box.querySelector('#share-heading'));
}

async function copy(value) {
  try {
    await navigator.clipboard.writeText(value);
    announce('Message copied. Paste it into an email or the clinic’s contact form.');
  } catch {
    announce('Copying didn’t work. Select the message and copy it yourself.');
  }
}

function saveReport(scan, summary) {
  const blob = new Blob([reportHtml(scan, summary)], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const link = h('a', { href: url, download: `healthbridge-report-${date}.html` });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  announce('The report was saved to your Downloads folder.');
}

export const lastScan = () => last;
