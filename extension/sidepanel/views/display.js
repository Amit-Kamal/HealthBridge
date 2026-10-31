// sidepanel/views/display.js — "Display": settings that change how websites look for this
// user only, page size, the panel's own text size, and which sites HealthBridge may read.
// Settings are saved in chrome.storage.local; background.js applies them to pages.

import { h, replace, announce } from '../ui.js';
import { currentTab } from '../api.js';

const SETTINGS = [
  { key: 'contrast', label: 'High contrast', hint: 'White and yellow on black, on the page and in HealthBridge.' },
  { key: 'spacing', label: 'More space between lines and letters', hint: 'Can make text easier to read with dyslexia or low vision.' },
  { key: 'focus', label: 'Strong focus outline', hint: 'A thick outline shows where you are when you use the keyboard.' },
  { key: 'targets', label: 'Bigger buttons and links', hint: 'Easier to press with a shaky hand or a touch screen.' },
  { key: 'motion', label: 'Stop moving things', hint: 'Stops animations and videos that play by themselves.' },
  { key: 'guide', label: 'Reading guide', hint: 'A band that follows your pointer to help you keep your place.' },
];
const NAMES = Object.fromEntries(SETTINGS.map((s) => [s.key, s.label]));
const ZOOMS = [1, 1.25, 1.5, 2];
const PANEL_SIZES = [{ value: 1, label: 'Normal' }, { value: 1.2, label: 'Large' }, { value: 1.4, label: 'Largest' }];
const BUILT_IN = new Set(chrome.runtime.getManifest().host_permissions ?? []);

let root;
let app;
let display = {};
let panelScale = 1;
let saving = 0; // saves in flight; their change events must not overwrite newer toggles

export function init(container, appRef) {
  root = container;
  app = appRef;
  chrome.storage.local.get(['display', 'panelScale']).then((stored) => {
    display = stored.display ?? {};
    panelScale = Number(stored.panelScale) || 1;
    render();
  });
  // Changes made elsewhere (another window, "turn all off" in tests) update the switches.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.display && saving === 0) {
      display = changes.display.newValue ?? {};
      syncSwitches();
    }
  });
  chrome.permissions.onAdded.addListener(() => renderSites());
  chrome.permissions.onRemoved.addListener(() => renderSites());
}

export function reset() {
  renderZoom();
}

async function save(next) {
  display = next;
  saving++;
  try {
    await chrome.storage.local.set({ display });
  } finally {
    // Let this save's own change event pass before listening again.
    setTimeout(() => { saving--; }, 0);
  }
}

// Called from problem cards on the Check tab ("Turn on high contrast").
export async function turnOn(key) {
  if (display[key]) {
    announce(`${NAMES[key]} is already on.`);
    return;
  }
  await save({ ...display, [key]: true });
  syncSwitches();
  announce(`${NAMES[key]} is on.${app.page.origin ? '' : ' Press the HealthBridge toolbar button so it can change this page.'}`);
}

export async function zoom(factor) {
  const tab = await currentTab();
  if (!tab) return;
  try {
    await chrome.tabs.setZoom(tab.id, factor);
    announce(`Page size ${Math.round(factor * 100)}%.`);
  } catch (err) {
    announce('Chrome didn’t let HealthBridge change the size of this page.');
  }
  renderZoom();
}

function render() {
  replace(root,
    h('h2', {}, 'Display'),
    h('p', {}, 'These change how websites look for you only. They work on pages HealthBridge is allowed to read.'),
    h('fieldset', { className: 'switches' },
      h('legend', {}, h('strong', {}, 'Page settings')),
      SETTINGS.map((s) => {
        const id = `set-${s.key}`;
        const input = h('input', { type: 'checkbox', id, checked: Boolean(display[s.key]), 'aria-describedby': `${id}-hint` });
        input.addEventListener('change', async () => {
          await save({ ...display, [s.key]: input.checked });
          announce(`${s.label} ${input.checked ? 'on' : 'off'}.`);
        });
        return h('div', {},
          h('label', { className: 'choice', htmlFor: id }, input, h('span', {}, s.label)),
          h('p', { className: 'muted', id: `${id}-hint` }, s.hint));
      })),
    h('button', {
      type: 'button',
      onclick: async () => {
        await save({});
        syncSwitches();
        announce('All page settings are off.');
      },
    }, 'Turn all page settings off'),

    h('h3', { id: 'zoom-heading' }, 'Page size'),
    h('p', { className: 'muted' }, 'Makes everything on the page bigger, even on sites that block zooming.'),
    h('div', { id: 'zoom-buttons', className: 'zoom-buttons', role: 'group', 'aria-labelledby': 'zoom-heading' }),

    h('h3', { id: 'panel-size-heading' }, 'HealthBridge text size'),
    h('div', { className: 'zoom-buttons', role: 'group', 'aria-labelledby': 'panel-size-heading' },
      PANEL_SIZES.map((size) => h('button', {
        type: 'button',
        'aria-pressed': String(panelScale === size.value),
        onclick: async (event) => {
          panelScale = size.value;
          await chrome.storage.local.set({ panelScale });
          event.currentTarget.parentElement.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(PANEL_SIZES[i].value === panelScale)));
          announce(`HealthBridge text size: ${size.label}.`);
        },
      }, size.label))),

    h('h3', {}, 'Read aloud'),
    onlineVoicesSwitch(),

    h('h3', {}, 'Sites HealthBridge can always read'),
    h('div', { id: 'site-list' }));
  renderZoom();
  renderSites();
}

// Online ("Google") voices send the text to Google; they stay off unless the user agrees.
function onlineVoicesSwitch() {
  const input = h('input', { type: 'checkbox', id: 'set-online-voices', 'aria-describedby': 'set-online-voices-hint' });
  chrome.storage.local.get('allowOnlineVoices').then(({ allowOnlineVoices }) => { input.checked = Boolean(allowOnlineVoices); });
  input.addEventListener('change', async () => {
    await chrome.storage.local.set({ allowOnlineVoices: input.checked });
    announce(input.checked ? 'Online voices allowed.' : 'Online voices off. HealthBridge will only use voices on this computer.');
  });
  return h('div', {},
    h('label', { className: 'choice', htmlFor: 'set-online-voices' }, input, h('span', {}, 'Allow online voices')),
    h('p', { className: 'muted', id: 'set-online-voices-hint' }, 'Online voices can sound better, but they send the text being read to Google. HealthBridge uses voices on this computer when it can.'));
}

function syncSwitches() {
  for (const s of SETTINGS) {
    const input = root.querySelector(`#set-${s.key}`);
    if (input) input.checked = Boolean(display[s.key]);
  }
}

async function renderZoom() {
  const box = root.querySelector('#zoom-buttons');
  if (!box) return;
  const tab = await currentTab();
  const current = tab ? await chrome.tabs.getZoom(tab.id).catch(() => 1) : 1;
  box.replaceChildren(...ZOOMS.map((z) => h('button', {
    type: 'button',
    'aria-pressed': String(Math.abs(current - z) < 0.01),
    onclick: () => zoom(z),
  }, `${Math.round(z * 100)}%`)));
}

async function renderSites() {
  const box = root.querySelector('#site-list');
  if (!box) return;
  const { origins = [] } = await chrome.permissions.getAll();
  const allowed = origins.filter((o) => !BUILT_IN.has(o));
  if (!allowed.length) {
    box.replaceChildren(h('p', { className: 'muted' }, 'None yet. On other sites, HealthBridge asks first and only reads the page you are on.'));
    return;
  }
  box.replaceChildren(h('ul', { className: 'actions-list' }, allowed.map((pattern) => {
    const host = pattern.replace(/^\w+:\/\/|\/\*$/g, '');
    return h('li', {},
      h('span', {}, host),
      h('button', {
        type: 'button',
        'aria-label': `Stop allowing ${host}`,
        onclick: async () => {
          const removed = await chrome.permissions.remove({ origins: [pattern] });
          announce(removed ? `HealthBridge can no longer read ${host} without asking.` : 'Nothing changed.');
          app.refreshPage();
        },
      }, 'Stop allowing'));
  })));
}
