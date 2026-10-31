// shared/report.js — turn a scan into (1) a message a patient can send to the portal and
// (2) a self-contained HTML report for the portal's developers. Pure functions, no DOM.
// Everything that came from the page (title, URL) is untrusted and escaped.

import { helpFor } from './ruleHelp.js';
import { CHECK_HELP, MANUAL_CHECKS } from './checkHelp.js';
import { criteriaFromTags, describeCriterion } from './wcag.js';
import { sortByImpact, splitByVersion } from './scoring.js';

export const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const dateOf = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const criteriaText = (tags) =>
  criteriaFromTags(tags).map((c) => `WCAG ${c.number}${c.name ? ` ${c.name}` : ''}`).join(', ');

// Things a patient can ask for while the site is broken (reasonable modifications and
// accessible formats). Plain requests, not legal claims.
export const NEEDS = {
  phone: 'Let me book visits and get help by phone or with a staff member.',
  time: 'Give me more time before the portal signs me out.',
  formats: 'Send my bills, results and letters in large print or another format I can use.',
  caregiver: 'Set up access for a family member or caregiver who helps me.',
};

// Plain text the user can paste into an email or the portal's contact form, then edit.
export function feedbackMessage(scan, { task = 'use the portal', needs = [] } = {}) {
  const violations = sortByImpact(scan.violations);
  const lines = [
    'Hello,',
    '',
    `I had trouble using your patient portal (${scan.url}) because of accessibility problems.`,
    `An automated check (HealthBridge with axe-core ${scan.engine}, WCAG 2.1 and 2.2 Level A and AA rules) on ${dateOf(scan.ranAt)} found:`,
    ...violations.slice(0, 8).map((v) => `- ${helpFor(v).title} (${v.nodeCount} ${v.nodeCount === 1 ? 'place' : 'places'}; ${criteriaText(v.tags) || v.id})`),
    ...(violations.length > 8 ? [`- and ${violations.length - 8} more`] : []),
    ...scan.checks
      .filter((c) => c.confidence === 'likely')
      .map((c) => `- ${CHECK_HELP[c.id]?.title ?? c.id} (WCAG ${CHECK_HELP[c.id]?.criterion ?? ''})`),
    '',
    'Automated checks find only some problems, so there may be more.',
    `Please fix these problems. Until they are fixed, please tell me another way to ${task}.`,
    ...(needs.length ? ['', 'It would also help if you could:', ...needs.filter((n) => NEEDS[n]).map((n) => `- ${NEEDS[n]}`)] : []),
    '',
    'Thank you.',
  ];
  return lines.join('\n');
}

const list = (items) => (items.length ? `<ul>${items.join('')}</ul>` : '<p>None found.</p>');

export function reportHtml(scan, summary) {
  const { graded, newer } = splitByVersion(sortByImpact(scan.violations));
  const site = escapeHtml(scan.title || scan.url);
  const row = (v) => {
    const help = helpFor(v);
    const crit = criteriaFromTags(v.tags).map((c) => `${c.number} ${c.name} (${c.level})`).join('; ');
    const details = v.nodes.map((n) => n.summary).filter(Boolean).slice(0, 3);
    return `<li>
      <h3>${escapeHtml(help.title)}</h3>
      <p><strong>Impact:</strong> ${escapeHtml(v.impact)} · <strong>Places on the page:</strong> ${v.nodeCount}${crit ? ` · <strong>WCAG:</strong> ${escapeHtml(crit)}` : ''}</p>
      <p>${escapeHtml(help.forYou)}</p>
      <details><summary>Technical details for the site's developers</summary>
        <p>axe-core rule <code>${escapeHtml(v.id)}</code>: ${escapeHtml(v.help)}. <a href="${escapeHtml(v.helpUrl)}">How to fix it</a></p>
        ${details.length ? `<ul>${details.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul>` : ''}
      </details>
    </li>`;
  };
  const check = (c) => {
    const help = CHECK_HELP[c.id] ?? { title: c.id, forYou: '' };
    const crit = help.criterion ? describeCriterion(help.criterion) : null;
    return `<li><h3>${escapeHtml(help.title)}</h3>
      <p>${escapeHtml(help.forYou)}</p>
      <p><strong>How sure:</strong> ${c.confidence === 'likely' ? 'likely a problem' : 'possible problem, please check'}${crit ? ` · <strong>WCAG:</strong> ${escapeHtml(`${crit.number} ${crit.name}`)}` : ''}</p>
      ${c.examples?.length ? `<details><summary>Examples</summary><ul>${c.examples.map((e) => `<li><code>${escapeHtml(e)}</code></li>`).join('')}</ul></details>` : ''}
    </li>`;
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Accessibility report: ${site}</title>
<style>
  body { font: 18px/1.5 system-ui, sans-serif; max-width: 46rem; margin: 2rem auto; padding: 0 1rem; color: #1f2933; }
  h1 { line-height: 1.2; } li { margin-bottom: 1rem; } code { background: #f1f3f5; padding: 0 .2em; }
  .note { border-left: 6px solid #b58100; padding: .5rem 1rem; background: #fff8e1; }
  a { color: #0b5cad; }
</style>
</head>
<body>
<main>
<h1>Accessibility report: ${site}</h1>
<p><strong>Page:</strong> ${escapeHtml(scan.url)}<br>
<strong>Checked:</strong> ${escapeHtml(dateOf(scan.ranAt))} with HealthBridge and axe-core ${escapeHtml(scan.engine)} (WCAG 2.1 and 2.2, Level A and AA rules)</p>
<p class="note">Automated checks find only some accessibility problems. This report is not a statement that the site meets WCAG or any law. A person, ideally a disabled user, should test the site too.</p>

<h2>Summary</h2>
<p><strong>Grade ${escapeHtml(summary.grade)}</strong> (${summary.score} out of 100). ${summary.blockers} ${summary.blockers === 1 ? 'problem' : 'problems'} can stop someone finishing a task.</p>
<p>How the grade works: only WCAG 2.1 Level A and AA problems count, because that is the version US health regulations cite. Each failed rule costs points by impact (critical 10, serious 6, moderate 3, minor 1), up to double if it repeats on many elements. Any critical problem limits the grade to C.</p>

<h2>Problems found by automated checks, WCAG 2.1 (${graded.length})</h2>
${list(graded.map(row))}

<h2>Problems from WCAG 2.2 (${newer.length})</h2>
<p>WCAG 2.2 is the newest version. These problems are not part of the grade.</p>
${list(newer.map(row))}

<h2>More problems HealthBridge found (${scan.checks.length})</h2>
<p>These checks look for barriers axe-core can't test. They are not part of the grade.</p>
${list(scan.checks.map(check))}

<h2>Needs a person to check (${scan.incomplete.length})</h2>
${list(scan.incomplete.map((v) => `<li>${escapeHtml(helpFor(v).title)} (${v.nodeCount} ${v.nodeCount === 1 ? 'place' : 'places'}; axe-core rule <code>${escapeHtml(v.id)}</code>)</li>`))}

<h2>Things to test by hand</h2>
${list(MANUAL_CHECKS.map((m) => `<li><strong>${escapeHtml(m.title)}</strong> ${escapeHtml(m.detail)}</li>`))}
</main>
</body>
</html>`;
}
