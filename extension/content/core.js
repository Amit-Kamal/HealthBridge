// content/core.js — shared state, helpers and the message router for HealthBridge's
// content scripts. Runs in the page's isolated world: page scripts can't see these
// variables. Injected on demand by background.js, before the other content files.

(() => {
  if (globalThis.__hb) return; // already injected into this page
  const HB = (globalThis.__hb = { handlers: {} });

  // ---------- Text and visibility ----------

  HB.clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

  // Opacity is deliberately not checked: many portals hide the real radio button or
  // checkbox with opacity: 0 and draw a custom one, and those are still real questions.
  // Inert content (behind an open dialog) can't be used, so it doesn't count.
  HB.isVisible = (el) =>
    !el.closest('[inert]') &&
    (el.checkVisibility?.({ visibilityProperty: true, checkVisibilityCSS: true }) ??
      !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length));

  HB.reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Element registry ----------
  // The panel refers to page elements by opaque ids. The ids live only in this
  // script's memory, so nothing is written into the page's DOM for analytics or
  // other scripts to notice.

  const byId = new Map();
  const idOf = new WeakMap();
  let nextId = 1;

  HB.ref = (el) => {
    let id = idOf.get(el);
    if (!id) {
      id = `e${nextId++}`;
      idOf.set(el, id);
      byId.set(id, new WeakRef(el));
    }
    return id;
  };

  HB.deref = (id) => {
    const el = byId.get(id)?.deref();
    return el?.isConnected ? el : null;
  };

  // axe gives each node a selector path. Nested arrays step into open shadow roots.
  // Paths with more than one entry point into iframes, which the MVP doesn't scan.
  HB.resolveAxeTarget = (target) => {
    if (!Array.isArray(target) || target.length !== 1) return null;
    const path = Array.isArray(target[0]) ? target[0] : [target[0]];
    let root = document;
    let el = null;
    for (const selector of path) {
      try {
        el = root.querySelector(selector);
      } catch {
        return null;
      }
      if (!el) return null;
      root = el.shadowRoot ?? el;
    }
    return el;
  };

  // ---------- Highlight overlay ----------
  // Drawn in a closed shadow root on top of the page, so the site's own elements and
  // styles are untouched. aria-hidden keeps it out of the screen reader's way.

  let overlay = null;

  function clearHighlight() {
    overlay?.cleanup();
    overlay = null;
  }

  function highlight(el, label) {
    clearHighlight();
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: HB.reduceMotion() ? 'auto' : 'smooth' });

    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      .box { position: absolute; pointer-events: none; z-index: 2147483647; box-sizing: border-box;
             border: 4px dashed #d4351c; outline: 3px solid #fff; border-radius: 4px; }
      .tag { position: absolute; left: -4px; bottom: 100%; margin-bottom: 4px; max-width: 320px;
             padding: 4px 8px; background: #d4351c; color: #fff; font: 700 15px/1.3 system-ui, sans-serif;
             border-radius: 4px; white-space: normal; }`;
    const box = document.createElement('div');
    box.className = 'box';
    if (label) {
      const tag = document.createElement('div');
      tag.className = 'tag';
      tag.textContent = label;
      box.append(tag);
    }
    shadow.append(style, box);
    document.documentElement.append(host);

    const place = () => {
      const r = el.getBoundingClientRect();
      const pad = 4;
      Object.assign(box.style, {
        left: `${r.left + scrollX - pad}px`,
        top: `${r.top + scrollY - pad}px`,
        width: `${Math.max(r.width, 8) + pad * 2}px`,
        height: `${Math.max(r.height, 8) + pad * 2}px`,
      });
    };
    let frame = 0;
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(place); };
    place();
    addEventListener('scroll', schedule, true);
    addEventListener('resize', schedule);
    const onKey = (e) => { if (e.key === 'Escape') clearHighlight(); };
    addEventListener('keydown', onKey, true);
    const timer = setTimeout(clearHighlight, 15000);

    overlay = {
      cleanup() {
        clearTimeout(timer);
        cancelAnimationFrame(frame);
        removeEventListener('scroll', schedule, true);
        removeEventListener('resize', schedule);
        removeEventListener('keydown', onKey, true);
        host.remove();
      },
    };
  }

  HB.highlight = highlight;

  // ---------- Page change detection ----------
  // Single-page apps change the URL without a reload. The Navigation API reports those
  // changes to content scripts too; older browsers fall back to a cheap poll.

  // Jumping to an anchor on the same page (#pay) is not a new page.
  const pageUrl = () => location.href.split('#')[0];
  let lastUrl = pageUrl();
  const urlChanged = () => {
    if (pageUrl() === lastUrl) return;
    lastUrl = pageUrl();
    HB.notify('url');
  };
  if (window.navigation) window.navigation.addEventListener('navigatesuccess', urlChanged);
  else setInterval(urlChanged, 1000);

  HB.notify = (reason) => {
    chrome.runtime.sendMessage({ type: 'PAGE_CHANGED', reason }).catch(() => {
      // Panel closed or extension reloaded: nothing is listening, which is fine.
    });
  };

  // ---------- Messages ----------

  Object.assign(HB.handlers, {
    PING: () => true,
    HIGHLIGHT: ({ id, label }) => {
      const el = HB.deref(id);
      if (!el) throw new Error('That part of the page has changed. Run the check again.');
      highlight(el, label);
      return true;
    },
    CLEAR_HIGHLIGHT: () => {
      clearHighlight();
      return true;
    },
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return false;
    const handler = HB.handlers[msg?.type];
    if (!handler) return false;
    Promise.resolve()
      .then(() => handler(msg))
      .then(
        (data) => sendResponse({ ok: true, data }),
        (err) => sendResponse({ ok: false, error: err?.message ?? String(err) })
      );
    return true; // respond asynchronously
  });
})();
