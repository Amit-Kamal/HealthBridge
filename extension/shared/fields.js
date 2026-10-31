// shared/fields.js — helpers for the form helper's own inputs.

// Give the helper's input the autocomplete token the site forgot (WCAG 1.3.5), so the
// browser can offer the user's saved details.
const TOKENS = [
  [/\b(first|given) ?name\b/i, 'given-name'],
  [/\b(last|family|sur) ?name\b/i, 'family-name'],
  [/\b(full |legal |patient |your )?name\b/i, 'name'],
  [/\b(date of birth|birth ?date|birthday|dob|bday)\b/i, 'bday'],
  [/\b(phone|mobile|cell|telephone)\b/i, 'tel'],
  [/\be ?mail\b/i, 'email'],
  [/\b(zip|postal) ?(code)?\b/i, 'postal-code'],
  [/\b(street|address)\b/i, 'street-address'],
  [/\bcity\b/i, 'address-level2'],
];
const NOT_ABOUT_USER = /\b(medication|medicine|drug|pharmacy|doctor|provider|physician|clinic|insurance|insurer|plan|company|employer|emergency|referring)\b/i;

export function guessAutocomplete(label = '', inputType = 'text') {
  if (inputType === 'email') return 'email';
  if (inputType === 'tel') return 'tel';
  const text = label.replace(/[_\-.]+/g, ' ');
  if (NOT_ABOUT_USER.test(text)) return 'off';
  return TOKENS.find(([re]) => re.test(text))?.[1] ?? 'off';
}

// Native input types the helper can show as-is; anything else becomes a text box.
export const SAFE_INPUT_TYPES = new Set(['text', 'email', 'tel', 'date', 'time', 'number', 'url', 'search', 'month', 'week', 'datetime-local']);

export const isEmpty = (value) => value === '' || value == null || value === false;

// How an answer reads on the review screen.
export function displayValue(question, value) {
  if (question.kind === 'checkbox') return value ? 'Yes' : 'No';
  if (isEmpty(value)) return 'Not answered';
  const option = question.options?.find((o) => o.value === value);
  if (option) return option.label || option.value;
  if (question.inputType === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  return String(value);
}
