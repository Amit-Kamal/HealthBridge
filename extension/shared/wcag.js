// shared/wcag.js — WCAG success criteria that axe-core and HealthBridge checks map to.

export const PRINCIPLES = { 1: 'Perceivable', 2: 'Operable', 3: 'Understandable', 4: 'Robust' };

// Number -> [name, level]. Covers the criteria the rules in this extension can report.
const CRITERIA = {
  '1.1.1': ['Non-text Content', 'A'],
  '1.2.2': ['Captions (Prerecorded)', 'A'],
  '1.3.1': ['Info and Relationships', 'A'],
  '1.3.5': ['Identify Input Purpose', 'AA'],
  '1.4.1': ['Use of Color', 'A'],
  '1.4.2': ['Audio Control', 'A'],
  '1.4.3': ['Contrast (Minimum)', 'AA'],
  '1.4.4': ['Resize Text', 'AA'],
  '1.4.10': ['Reflow', 'AA'],
  '1.4.11': ['Non-text Contrast', 'AA'],
  '1.4.12': ['Text Spacing', 'AA'],
  '2.1.1': ['Keyboard', 'A'],
  '2.1.2': ['No Keyboard Trap', 'A'],
  '2.2.1': ['Timing Adjustable', 'A'],
  '2.2.2': ['Pause, Stop, Hide', 'A'],
  '2.4.1': ['Bypass Blocks', 'A'],
  '2.4.2': ['Page Titled', 'A'],
  '2.4.3': ['Focus Order', 'A'],
  '2.4.4': ['Link Purpose (In Context)', 'A'],
  '2.4.6': ['Headings and Labels', 'AA'],
  '2.4.7': ['Focus Visible', 'AA'],
  '2.4.11': ['Focus Not Obscured (Minimum)', 'AA'],
  '2.5.3': ['Label in Name', 'A'],
  '2.5.8': ['Target Size (Minimum)', 'AA'],
  '3.1.1': ['Language of Page', 'A'],
  '3.1.2': ['Language of Parts', 'AA'],
  '3.2.2': ['On Input', 'A'],
  '3.3.1': ['Error Identification', 'A'],
  '3.3.2': ['Labels or Instructions', 'A'],
  '3.3.8': ['Accessible Authentication (Minimum)', 'AA'],
  '4.1.2': ['Name, Role, Value', 'A'],
  '4.1.3': ['Status Messages', 'AA'],
};

// axe tags criteria like "wcag143" or "wcag1410": principle, guideline, criterion.
export function criteriaFromTags(tags = []) {
  return tags
    .map((tag) => /^wcag(\d)(\d)(\d{1,2})$/.exec(tag))
    .filter(Boolean)
    .map(([, p, g, c]) => describeCriterion(`${p}.${g}.${c}`));
}

export function describeCriterion(number) {
  const [name, level] = CRITERIA[number] ?? ['', ''];
  return { number, name, level, principle: PRINCIPLES[number[0]] ?? 'Other' };
}

export function principleOf(tags) {
  return criteriaFromTags(tags)[0]?.principle ?? 'Other';
}

export function wcagVersionOf(tags = []) {
  return tags.some((t) => t === 'wcag22a' || t === 'wcag22aa') ? '2.2' : '2.1';
}
