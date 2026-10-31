// sidepanel/main.js — starts the panel: tabs, first-run message, page access, and the four
// views. Each view module exports init(container, app) and reset(reason).

import { h, announce } from './ui.js';
import { currentTab, originOf, sendToTab, watchPage } from './api.js';
import * as speech from './speech.js';
import * as readView from './views/read.js';
import * as fillView from './views/fill.js';
import * as checkView from './views/check.js';
import * as displayView from './views/display.js';

const VIEWS = { read: readView, fill: fillView, check: checkView, display: displayView };
const tabs = [...document.querySelectorAll('[role="tab"]')];
const nameOf = (tab) => tab.id.replace('tab-', '');

// ---------- Shared app object passed to every view ----------

const app = {
  page: { tabId: null, origin: null, title: '', alwaysAllowed: false },

  selectTab(name, { focus = true } = {}) {
    const tab = document.getElementById(`tab-${name}`);
    for (const t of tabs) {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
    }
    if (focus) tab.focus();
    chrome.storage.local.set({ lastTab: name });
  },

  // Turn a PageError into something a person can act on.
  explainError(err) {
    if (err?.code === 'needs-permission') {
      return h('div', { className: 'notice notice-warn', role: 'alert' },
        h('p', {}, h('strong', {}, 'HealthBridge needs your OK to read this page.')),
        h('p', {}, 'Press the HealthBridge button in the Chrome toolbar, or press Alt+Shift+H. Then try again.'));
    }
    if (err?.code === 'restricted' || err?.code === 'no-tab') {
      return h('div', { className: 'notice notice-warn', role: 'alert' }, h('p', {}, err.message));
    }
    return h('div', { className: 'notice notice-error', role: 'alert' },
      h('p', {}, err?.message || 'Something went wrong.'),
      h('p', {}, 'Reloading the page often helps.'));
  },

  startFill() {
    app.selectTab('fill');
    fillView.start();
  },

  turnOnDisplay(key) {
    return displayView.turnOn(key);
  },

  zoomPage(factor) {
    return displayView.zoom(factor);
  },

  showActions() {
    app.selectTab('read');
    readView.showActions();
  },

  refreshPage,
};

// ---------- Tabs: arrow keys, Home and End (WAI-ARIA tabs pattern) ----------

tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => app.selectTab(nameOf(tab)));
  tab.addEventListener('keydown', (event) => {
    const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tabs.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    app.selectTab(nameOf(tabs[(next + tabs.length) % tabs.length]));
  });
});

// ---------- Page access bar ----------

async function refreshPage() {
  const tab = await currentTab();
  const origin = originOf(tab);
  const alwaysAllowed = origin ? await chrome.permissions.contains({ origins: [`${origin}/*`] }).catch(() => false) : false;
  app.page = { tabId: tab?.id ?? null, origin, title: tab?.title ?? '', alwaysAllowed };

  const bar = document.getElementById('page-bar');
  if (!tab) {
    bar.replaceChildren(h('p', {}, 'Open a website to use HealthBridge.'));
    return;
  }
  if (!origin) {
    bar.replaceChildren(
      h('p', {}, h('strong', {}, 'HealthBridge can’t read this page yet.')),
      h('p', { className: 'muted' }, 'Press the HealthBridge button in the toolbar (or Alt+Shift+H) to let it read this page.'));
    return;
  }
  const host = new URL(origin).host;
  bar.replaceChildren(
    h('p', {}, h('strong', {}, 'Page: '), tab.title || host),
    alwaysAllowed
      ? h('p', { className: 'muted' }, `HealthBridge can always help on ${host}.`)
      : h('div', { className: 'row' },
          h('p', { className: 'muted' }, 'HealthBridge can read this page until you leave it.'),
          // permissions.request needs the click's user gesture, so it runs straight away.
          h('button', {
            type: 'button',
            onclick: () => {
              chrome.permissions.request({ origins: [`${origin}/*`] }).then((granted) => {
                announce(granted ? `HealthBridge will always help on ${host}.` : 'Nothing changed.');
                refreshPage();
              });
            },
          }, `Always allow on ${host}`)));
}

// ---------- First run ----------

async function showIntroOnce() {
  const { introDone } = await chrome.storage.local.get('introDone');
  const intro = document.getElementById('intro');
  if (introDone) return;
  intro.hidden = false;
  document.getElementById('intro-done').addEventListener('click', () => {
    intro.hidden = true;
    chrome.storage.local.set({ introDone: true });
    document.querySelector('[role="tab"][aria-selected="true"]').focus();
  });
}

// ---------- Panel's own look follows the user's settings ----------

function applyPanelLook({ display = {}, panelScale = 1 }) {
  document.documentElement.classList.toggle('hb-contrast', Boolean(display.contrast));
  document.documentElement.style.setProperty('--scale', String(panelScale));
}

// ---------- Right-click "Read aloud" / "Explain" ----------

async function takePending() {
  const tab = await currentTab();
  if (!tab) return;
  const key = `pending:${tab.id}`;
  const { [key]: pending } = await chrome.storage.session.get(key);
  if (!pending) return;
  await chrome.storage.session.remove(key);
  app.selectTab('read');
  readView.handleSelection(pending);
}

// ---------- Start ----------

for (const [name, view] of Object.entries(VIEWS)) view.init(document.getElementById(`panel-${name}`), app);

const stored = await chrome.storage.local.get(['lastTab', 'display', 'panelScale']);
applyPanelLook(stored);
if (VIEWS[stored.lastTab]) app.selectTab(stored.lastTab, { focus: false });
showIntroOnce();
refreshPage();
takePending();

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'local' && (changes.display || changes.panelScale)) applyPanelLook(await chrome.storage.local.get(['display', 'panelScale']));
  if (area === 'session' && Object.keys(changes).some((k) => k.startsWith('pending:') && changes[k].newValue)) takePending();
});

// Each tab has its own panel, which is hidden when you switch tabs. Pause reading then.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') speech.pause();
});
chrome.permissions.onAdded.addListener(refreshPage);
chrome.permissions.onRemoved.addListener(refreshPage);

watchPage((reason) => {
  if (reason === 'form') {
    fillView.formChanged();
    return;
  }
  if (reason !== 'loaded') for (const view of Object.values(VIEWS)) view.reset(reason);
  refreshPage();
});

// Escape removes the outline HealthBridge drew on the page.
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !event.target.closest('input, select, textarea')) sendToTab('CLEAR_HIGHLIGHT').catch(() => {});
});
