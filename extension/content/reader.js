// content/reader.js — turns the page into simple blocks for the panel's Easy read view:
// headings, text, tables as row cards, a summary of any form, and the page's links and
// buttons ("things you can do here"). Text only; the panel renders it with textContent.

(() => {
  const HB = globalThis.__hb;
  if (!HB || HB.handlers.READ_PAGE) return;

  const { clean, isVisible } = HB;
  const MAX_BLOCKS = 400;
  const MAX_TEXT = 2000;
  const MAX_ACTIONS = 40;
  const SKIP = 'script, style, noscript, template, svg, [aria-hidden=true], nav, aside, [role=navigation], [role=complementary], [role=search]';
  const TEXT_TAGS = new Set(['P', 'LI', 'DT', 'DD', 'BLOCKQUOTE', 'FIGCAPTION', 'PRE', 'ADDRESS']);
  const BLOCK_DISPLAY = /^(block|flex|grid|table|list-item|flow-root)/;

  const rootFontSize = () => parseFloat(getComputedStyle(document.body).fontSize) || 16;

  // Like textContent, but adjacent links, buttons and labels don't run together
  // ("Visits Results Billing", not "VisitsResultsBilling").
  const SEPARATE = new Set(['A', 'BUTTON', 'LABEL', 'IMG', 'BR', 'TD', 'TH', 'LI', 'OPTION']);
  function textOf(el) {
    const parts = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let lastParent = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (parent?.closest('script, style, [aria-hidden=true]') && parent !== el) continue;
      const boundary = parent !== lastParent && (SEPARATE.has(parent?.tagName) || SEPARATE.has(lastParent?.tagName));
      parts.push(boundary ? ` ${node.data}` : node.data);
      lastParent = parent;
    }
    return clean(parts.join(''));
  }

  function isHeading(el) {
    return /^H[1-6]$/.test(el.tagName) || el.getAttribute('role') === 'heading';
  }

  function headingLevel(el) {
    return /^H[1-6]$/.test(el.tagName) ? Number(el.tagName[1]) : Number(el.getAttribute('aria-level')) || 2;
  }

  function hasBlockChildren(el) {
    return [...el.children].some((c) => isVisible(c) && BLOCK_DISPLAY.test(getComputedStyle(c).display));
  }

  // Many portals style a <div> to look like a heading. Treat short, bold or large,
  // unpunctuated lines as headings so the panel can give them real structure.
  function looksLikeHeading(el, text, baseSize) {
    if (text.length > 80 || /[.?!:,;]$/.test(text) || el.closest('li, td, th, label, button, a, form')) return false;
    const style = getComputedStyle(el);
    return Number(style.fontWeight) >= 600 || parseFloat(style.fontSize) >= baseSize * 1.2;
  }

  function extractTable(table) {
    const rows = [...table.rows].filter(isVisible);
    const thRow = table.tHead?.rows[0] ?? rows.find((r) => r.cells.length && [...r.cells].every((c) => c.tagName === 'TH'));
    // No real headers: many portals bold the first row instead. Use it, and say so.
    const headerRow = thRow ?? rows[0];
    const headers = [...(headerRow?.cells ?? [])].map((c) => clean(c.textContent));
    const bodyRows = rows.filter((r) => r !== headerRow && r.parentElement?.tagName !== 'THEAD');
    return {
      kind: 'table',
      id: HB.ref(table),
      caption: clean(table.caption?.textContent),
      guessedHeaders: !thRow,
      headers,
      rows: bodyRows.slice(0, 200).map((r) =>
        [...r.cells].map((cell, i) => ({ header: headers[i] || `Column ${i + 1}`, value: clean(cell.textContent).slice(0, 300) }))
      ),
    };
  }

  // A rough accessible name for links and buttons, with a guess when the site gave none.
  function actionName(el) {
    const labelledBy = (el.getAttribute('aria-labelledby') ?? '')
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent)
      .join(' ');
    const real =
      clean(el.getAttribute('aria-label')) ||
      clean(labelledBy) ||
      clean(el.textContent) ||
      clean(el.value) ||
      clean(el.title) ||
      clean([...el.querySelectorAll('img[alt]')].map((img) => img.alt).join(' ')) ||
      clean(el.querySelector('svg title')?.textContent);
    if (real) return { name: real.slice(0, 120), guessed: false };
    const href = el.getAttribute('href') ?? '';
    const fromHref = clean(decodeURIComponent(href.split(/[?#]/)[0].split('/').filter(Boolean).pop() ?? '').replace(/\.\w+$/, '').replace(/[-_]+/g, ' '));
    const fromHash = clean((href.split('#')[1] ?? '').replace(/[-_]+/g, ' '));
    const fromClass = clean((el.className?.toString?.() ?? '').replace(/[-_]+/g, ' '));
    const guess = fromHash || fromHref || fromClass;
    return { name: guess ? guess.slice(0, 60) : '', guessed: true };
  }

  function extractActions(root) {
    const els = [...root.querySelectorAll('a[href], button, [role=button], [role=link], input[type=submit], input[type=button]')]
      .filter((el) => isVisible(el) && !el.closest('form') && !el.closest('[aria-hidden=true]'));
    return els.slice(0, MAX_ACTIONS).map((el) => ({
      id: HB.ref(el),
      kind: el.matches('a[href], [role=link]') ? 'link' : 'button',
      ...actionName(el),
    }));
  }

  function readPage() {
    const root = document.querySelector('main, [role=main]') ?? document.body;
    const baseSize = rootFontSize();
    const blocks = [];
    const push = (block) => {
      if (blocks.length < MAX_BLOCKS) blocks.push(block);
    };

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode(el) {
        if (el.matches(SKIP) || !isVisible(el)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    for (let el = walker.currentNode; el; ) {
      let skipChildren = false;
      const text = () => textOf(el).slice(0, MAX_TEXT);

      if (el === root) {
        // keep walking into the root
      } else if (isHeading(el)) {
        if (text()) push({ kind: 'heading', level: headingLevel(el), text: text(), id: HB.ref(el) });
        skipChildren = true;
      } else if (el.tagName === 'TABLE' && !/^(presentation|none)$/.test(el.getAttribute('role') ?? '')) {
        const table = extractTable(el);
        if (table.rows.length) push(table);
        skipChildren = true;
      } else if (el.tagName === 'FORM') {
        const fieldCount = el.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea').length;
        if (fieldCount) push({ kind: 'form', fieldCount, id: HB.ref(el) });
        skipChildren = true;
      } else if (TEXT_TAGS.has(el.tagName) || !hasBlockChildren(el)) {
        const t = text();
        if (t) {
          if (looksLikeHeading(el, t, baseSize)) push({ kind: 'heading', level: 2, text: t, inferred: true, id: HB.ref(el) });
          else push({ kind: 'text', text: t, listItem: el.tagName === 'LI', id: HB.ref(el) });
        }
        skipChildren = true;
      }

      el = skipChildren ? nextSkippingChildren(walker) : walker.nextNode();
    }

    return {
      title: clean(document.title),
      lang: document.documentElement.lang || null,
      blocks,
      actions: extractActions(root),
    };
  }

  // Move to the next element after the current one's subtree.
  function nextSkippingChildren(walker) {
    for (;;) {
      if (walker.currentNode === walker.root) return null;
      const sibling = walker.nextSibling();
      if (sibling) return sibling;
      if (!walker.parentNode()) return null;
    }
  }

  HB.handlers.READ_PAGE = readPage;

  // Press a link or button on the page for users who can't hit small targets.
  HB.handlers.ACTIVATE = ({ id }) => {
    const el = HB.deref(id);
    if (!el || !HB.isVisible(el)) throw new Error('That link or button is no longer on the page.');
    el.click();
    return true;
  };
})();
