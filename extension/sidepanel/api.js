// sidepanel/api.js — how the panel talks to the page (through background.js).

const params = new URLSearchParams(location.search);
// background.js opens one panel per tab with ?tabId=<that tab> in its URL, so each panel
// always talks to its own page. End-to-end tests open the same URL in a normal tab.
// Websites can't open it: the panel page is not web-accessible.
const PINNED_TAB = Number(params.get('tabId')) || null;
export const boundTabId = PINNED_TAB;

export class PageError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export async function currentTab() {
  if (PINNED_TAB) return chrome.tabs.get(PINNED_TAB).catch(() => null);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

// tab.url is only visible on sites HealthBridge may read, so null means "no access yet".
export function originOf(tab) {
  try {
    const url = new URL(tab?.url ?? '');
    return /^https?:$/.test(url.protocol) ? url.origin : null;
  } catch {
    return null;
  }
}

export async function sendToTab(type, data = {}) {
  const tab = await currentTab();
  if (!tab) throw new PageError('no-tab', 'Open a web page first.');
  const res = await chrome.runtime.sendMessage({ target: 'tab', tabId: tab.id, payload: { type, ...data } });
  if (!res?.ok) {
    throw new PageError(res?.code ?? 'no-response', res?.error ?? 'The page did not answer. Try reloading the page.');
  }
  return res.data;
}

// Calls back when results on screen no longer match the page:
// the user switched tabs, the tab loaded a new page, or a single-page app changed its URL.
export async function watchPage(onChange) {
  const panelWindowId = PINNED_TAB ? null : (await chrome.windows.getCurrent()).id;
  const isOurs = (tab) => (PINNED_TAB ? tab.id === PINNED_TAB : tab.active && tab.windowId === panelWindowId);

  chrome.tabs.onActivated.addListener(({ windowId }) => {
    if (!PINNED_TAB && windowId === panelWindowId) onChange('switched');
  });
  chrome.tabs.onUpdated.addListener((_id, info, tab) => {
    if (!isOurs(tab)) return;
    if (info.status === 'loading') onChange('loading');
    else if (info.status === 'complete') onChange('loaded');
  });
  // The content script reports in-page changes (new URL without a reload, a form that grew).
  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (sender.id !== chrome.runtime.id || !sender.tab || !isOurs(sender.tab)) return;
    if (msg?.type === 'PAGE_CHANGED') onChange(msg.reason ?? 'changed');
  });
}
