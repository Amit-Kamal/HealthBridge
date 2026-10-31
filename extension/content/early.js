// content/early.js — runs at document_start, only on sites the user chose to always allow.
// It asks for the user's display settings right away, so high contrast is on before the
// page first paints instead of flashing the site's own colors. It reads nothing.

chrome.runtime.sendMessage({ type: 'PAGE_STARTED' }).catch(() => {});
