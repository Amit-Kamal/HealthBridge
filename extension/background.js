// background.js — MV3 service worker.
// Opens a side panel for the tab the user chose, injects content scripts only when asked,
// relays the panel's requests to the page, and applies display settings. Chrome stops
// this worker when it is idle, so lasting state lives in chrome.storage.

const CONTENT_FILES = [
  'content/core.js',
  'content/checks.js',
  'content/scan.js',
  'content/reader.js',
  'content/forms.js',
  'content/display.js',
];
const AXE_FILE = 'lib/axe.min.js';
const EARLY_SCRIPT_ID = 'hb-early';

// Display settings that are pure CSS. They are injected as USER stylesheets: in the CSS
// cascade a user's !important rules beat the site's !important rules, which is exactly
// what an accessibility preference should do.
const DISPLAY_CSS = {
  contrast: 'content/css/contrast.css',
  spacing: 'content/css/spacing.css',
  focus: 'content/css/focus.css',
  targets: 'content/css/targets.css',
  motion: 'content/css/motion.css',
};

const PANEL_URL = chrome.runtime.getURL('sidepanel/');

// ---------- Opening the panel ----------

// Each tab gets its own panel, bound to that tab by ?tabId= in its URL, so results always
// describe the page they came from. There is no shared panel that follows you around.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
chrome.sidePanel.setOptions({ enabled: false }).catch(() => {});

function openPanel(tab) {
  // Both calls must run synchronously inside the user's click: no await before open().
  chrome.sidePanel.setOptions({ tabId: tab.id, path: `sidepanel/sidepanel.html?tabId=${tab.id}`, enabled: true });
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
}

// Toolbar button or Alt+Shift+H. Chrome grants activeTab for the page before this runs.
chrome.action.onClicked.addListener(openPanel);

// Right-click on selected text works even on sites HealthBridge can't read yet,
// because Chrome hands over the selection itself.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'hb-read', title: 'Read aloud with HealthBridge', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'hb-explain', title: 'Explain with HealthBridge', contexts: ['selection'] });
  });
  syncEarlyScript();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id || !info.selectionText) return;
  openPanel(tab);
  // The tab's panel picks this up when it opens. Session storage is memory-only.
  chrome.storage.session.set({
    [`pending:${tab.id}`]: { action: info.menuItemId === 'hb-read' ? 'read' : 'explain', text: info.selectionText.slice(0, 5000) },
  });
});

// ---------- Relaying panel requests ----------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;

  // A page on an always-allowed site just started loading: apply display settings now,
  // before it first paints, instead of flashing the original colors.
  if (msg?.type === 'PAGE_STARTED' && sender.tab && sender.frameId === 0) {
    applyDisplay(sender.tab.id, sender.documentId, { fresh: true });
    return false;
  }

  // Only the panel may drive tabs. Content scripts (sender.url = a web page) can't.
  if (msg?.target !== 'tab' || !sender.url?.startsWith(PANEL_URL)) return false;
  relayToTab(msg.tabId, msg.payload).then(sendResponse);
  return true; // respond asynchronously
});

async function relayToTab(tabId, payload) {
  try {
    await ensureInjected(tabId);
    if (payload?.type === 'SCAN') await ensureAxe(tabId);
    const res = await chrome.tabs.sendMessage(tabId, payload, { frameId: 0 });
    return res ?? { ok: false, code: 'no-response', error: 'The page did not answer. Try reloading it.' };
  } catch (err) {
    return describeError(err);
  }
}

async function ensureInjected(tabId) {
  try {
    const pong = await chrome.tabs.sendMessage(tabId, { type: 'PING' }, { frameId: 0 });
    if (pong?.ok) return;
  } catch {
    // No content script yet; inject below.
  }
  await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_FILES });
}

// axe is about 650 KB, so it's only loaded when the user runs a check.
async function ensureAxe(tabId) {
  const [{ result: loaded } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => typeof window.axe?.run === 'function',
  });
  if (!loaded) await chrome.scripting.executeScript({ target: { tabId }, files: [AXE_FILE] });
}

// Chrome's errors are written for developers. Give the panel a code and a plain message.
function describeError(err) {
  const text = String(err?.message ?? err);
  if (/chrome:\/\/|chrome-extension:\/\/|chrome-search|gallery cannot be scripted|webstore|devtools:/i.test(text)) {
    return { ok: false, code: 'restricted', error: 'Chrome doesn’t let extensions read this kind of page. Try it on a website.' };
  }
  if (/Cannot access|must request permission|permission to access|host permission/i.test(text)) {
    return { ok: false, code: 'needs-permission', error: 'HealthBridge needs your OK to read this page.' };
  }
  if (/No tab with id|tab was closed/i.test(text)) {
    return { ok: false, code: 'no-tab', error: 'That tab is closed.' };
  }
  if (/error page/i.test(text)) {
    return { ok: false, code: 'restricted', error: 'This tab is showing an error page. Reload it and try again.' };
  }
  return { ok: false, code: 'failed', error: text };
}

// ---------- Display settings ----------

async function getDisplay() {
  const { display = {} } = await chrome.storage.local.get('display');
  return display;
}

// Which stylesheets are on a tab's current page. Each page load has its own documentId,
// so a record from an earlier page never counts, and a stylesheet is never added twice
// (two copies would need two removals, and "off" would silently fail).
const appliedKey = (tabId) => `applied:${tabId}`;

async function currentDocumentId(tabId) {
  const [result] = await chrome.scripting.executeScript({ target: { tabId }, func: () => true });
  return result?.documentId ?? null;
}

// Changes for one tab run one at a time, and each run reads the latest settings, so quick
// toggles can't interleave and undo each other.
const queues = new Map();
function applyDisplay(tabId, documentId, options) {
  const run = (queues.get(tabId) ?? Promise.resolve()).then(() => applyDisplayNow(tabId, documentId, options)).catch(() => {});
  queues.set(tabId, run);
  run.finally(() => { if (queues.get(tabId) === run) queues.delete(tabId); });
  return run;
}

// fresh: the page has only just started loading (PAGE_STARTED), so none of our
// stylesheets can be on it yet.
async function applyDisplayNow(tabId, documentId, { fresh = false } = {}) {
  const display = await getDisplay();
  documentId ??= await currentDocumentId(tabId);
  if (!documentId) return;
  const key = appliedKey(tabId);
  const { [key]: record } = await chrome.storage.session.get(key);
  const matches = record?.documentId === documentId;
  if (fresh && !matches && !Object.values(display).some(Boolean)) return; // nothing to add, nothing to remove
  // Without a record for this exact page (the record was lost, for example after an
  // extension update), remove each stylesheet once before adding it, so the page ends
  // with exactly one copy whatever was there before.
  const trusted = matches || fresh;
  const applied = matches ? record.prefs : {};
  const target = { tabId, documentIds: [documentId] };
  try {
    for (const [name, file] of Object.entries(DISPLAY_CSS)) {
      const want = Boolean(display[name]);
      if (trusted && want === Boolean(applied[name])) continue;
      if (!trusted || !want) await chrome.scripting.removeCSS({ target, files: [file], origin: 'USER' }).catch(() => {});
      if (want) await chrome.scripting.insertCSS({ target, files: [file], origin: 'USER' });
      applied[name] = want;
    }
  } finally {
    await chrome.storage.session.set({ [key]: { documentId, prefs: applied } });
  }
  // Pausing videos and the reading guide need script on the page.
  if (display.motion || display.guide) await ensureInjected(tabId);
}

// tab.url is only visible on sites HealthBridge may read, so other tabs are skipped.
const canRead = (tab) => /^https?:/.test(tab.url ?? '');

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local' || !changes.display) return;
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.filter(canRead).map((tab) => applyDisplay(tab.id)));
});

// Pages the user opened HealthBridge on (activeTab) keep their settings after reloads
// and moves within the same site.
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== 'complete' || !canRead(tab)) return;
  const display = await getDisplay();
  if (Object.values(display).some(Boolean)) await applyDisplay(tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove([appliedKey(tabId), `pending:${tabId}`]);
});

// On sites the user always allows, a tiny script runs at document_start and asks for the
// display settings straight away (see PAGE_STARTED above).
async function syncEarlyScript() {
  const { origins = [] } = await chrome.permissions.getAll();
  const matches = origins.filter((o) => /^https?:\/\//.test(o));
  await chrome.scripting.unregisterContentScripts({ ids: [EARLY_SCRIPT_ID] }).catch(() => {});
  if (matches.length) {
    await chrome.scripting.registerContentScripts([
      { id: EARLY_SCRIPT_ID, js: ['content/early.js'], matches, runAt: 'document_start', persistAcrossSessions: true },
    ]);
  }
}

chrome.permissions.onAdded.addListener(syncEarlyScript);
chrome.permissions.onRemoved.addListener(syncEarlyScript);
