// sidepanel/ui.js — small DOM helpers shared by every view.

// Build DOM with text nodes only. Page text is untrusted and this panel has
// extension privileges, so page content must never reach innerHTML.
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key in node && !key.includes('-')) node[key] = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  node.append(...children.flat(Infinity).filter((c) => c != null && c !== false && c !== ''));
  return node;
}

// Replace a node's children, skipping null/false like h() does. The DOM's own
// replaceChildren() would turn a null into the text "null".
export function replace(node, ...children) {
  node.replaceChildren(...children.flat(Infinity).filter((c) => c != null && c !== false && c !== ''));
}

// Links from axe results point at dequeuniversity.com; anything else is dropped,
// so a page can never smuggle a javascript: URL into the panel.
export function safeHref(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

// One polite live region for status messages (WCAG 4.1.3). Clearing first makes
// screen readers repeat a message even if the text is the same as last time.
export function announce(text) {
  const region = document.getElementById('announcer');
  if (!region) return;
  region.textContent = '';
  setTimeout(() => { region.textContent = text; }, 60);
}

// aria-disabled (not disabled) keeps keyboard focus on the button while work runs.
export async function busy(button, work) {
  if (button.getAttribute('aria-disabled') === 'true') return undefined;
  button.setAttribute('aria-disabled', 'true');
  button.setAttribute('aria-busy', 'true');
  try {
    return await work();
  } finally {
    button.removeAttribute('aria-disabled');
    button.removeAttribute('aria-busy');
  }
}

// Move focus to a heading or container after a view changes, so screen reader
// and keyboard users land on the new content instead of the top of the panel.
export function focusOn(node) {
  if (!node) return;
  if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');
  node.focus({ preventScroll: false });
}

export function errorBox(message, { action } = {}) {
  return h('div', { className: 'notice notice-error', role: 'alert' },
    h('p', {}, message),
    action && h('button', { type: 'button', onclick: action.run }, action.label));
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
