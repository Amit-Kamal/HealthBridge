// content/checks.js — HealthBridge checks for barriers axe-core can't test automatically.
// Each finding is { id, confidence: 'likely' | 'possible', count, nodes: [elementId], examples: [string] }.
// They are reported separately from the axe results and never change the grade.
// None of them interact with the page (no focusing or clicking), so a scan can't
// trigger the site's validation messages or open menus.

(() => {
  const HB = globalThis.__hb;
  if (!HB || HB.runChecks) return;

  const { clean, isVisible } = HB;
  const FIELDS =
    'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), select, textarea';

  const visible = (selector, root = document) => [...root.querySelectorAll(selector)].filter(isVisible);
  const refs = (els) => els.slice(0, 20).map(HB.ref);

  function hasRealLabel(el) {
    const labelledBy = (el.getAttribute('aria-labelledby') ?? '')
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent)
      .join(' ');
    return Boolean(
      clean([...(el.labels ?? [])].map((l) => l.textContent).join(' ')) ||
        clean(el.getAttribute('aria-label')) ||
        clean(labelledBy) ||
        clean(el.title)
    );
  }

  // WCAG 2.4.7. Reads the site's CSS for :focus rules that remove the outline
  // without adding another visible style. ":focus:not(:focus-visible)" is a good
  // pattern (hides the ring for mouse users only), so it is ignored.
  function focusHidden() {
    const removals = [];
    let replacements = 0;
    const STYLE_PROPS = ['boxShadow', 'borderColor', 'borderBottomColor', 'backgroundColor', 'color', 'textDecorationLine'];
    const isSet = (v) => v && !['none', 'initial', 'inherit', 'unset', 'transparent'].includes(v);
    const visit = (rules) => {
      for (const rule of rules) {
        const sel = rule.selectorText;
        if (sel && rule.style && /:focus(-visible)?(?![\w-])/.test(sel) && !/:not\(\s*:focus-visible\s*\)/.test(sel)) {
          const st = rule.style;
          const removes = st.outlineStyle === 'none' || /^0(px)?$/.test(st.outlineWidth);
          if (removes && !STYLE_PROPS.some((p) => isSet(st[p]))) removals.push(sel.slice(0, 120));
          else if ((isSet(st.outlineStyle) && st.outlineStyle !== 'none') || isSet(st.boxShadow)) replacements++;
        }
        if (rule.cssRules) visit(rule.cssRules); // @media, @supports, @layer, nesting
      }
    };
    for (const sheet of [...document.styleSheets, ...(document.adoptedStyleSheets ?? [])]) {
      try {
        visit(sheet.cssRules);
      } catch {
        // Cross-origin stylesheet: its rules can't be read.
      }
    }
    if (!removals.length) return null;
    return {
      confidence: replacements ? 'possible' : 'likely',
      count: removals.length,
      examples: removals.slice(0, 5),
    };
  }

  // WCAG 3.3.2. axe accepts a placeholder as a name, but it vanishes as soon as you type.
  function placeholderLabel() {
    const els = visible('input[placeholder], textarea[placeholder]').filter(
      (el) => clean(el.placeholder) && !hasRealLabel(el)
    );
    return els.length ? { confidence: 'likely', count: els.length, nodes: refs(els) } : null;
  }

  // WCAG 1.3.5 (AA). axe checks autocomplete values only when they exist; a missing
  // attribute on a "your phone number" field means the browser can't autofill it.
  const PERSONAL = [
    /\b(first|given|last|family|sur|full|legal|patient|your)? ?name\b/i,
    /\b(birth|dob|bday|birthday)\b/i,
    /\b(phone|mobile|cell|telephone)\b/i,
    /\be ?mail\b/i,
    /\b(street|address|zip|postal|city)\b/i,
  ];
  // 1.3.5 covers information about the user, not "medication name" or "doctor's phone".
  const NOT_ABOUT_USER = /\b(medication|medicine|drug|pharmacy|doctor|provider|physician|clinic|insurance|insurer|plan|company|employer|emergency|referring)\b/i;
  function autocompleteMissing() {
    const describe = (el) =>
      [el.name, el.id, el.placeholder, el.getAttribute('aria-label'), ...[...(el.labels ?? [])].map((l) => l.textContent)]
        .join(' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_\-.]+/g, ' ');
    const els = visible('input:not([type]), input[type=text], input[type=email], input[type=tel], input[type=date]').filter(
      (el) => {
        const ac = (el.getAttribute('autocomplete') ?? '').trim().toLowerCase();
        if (ac && ac !== 'off' && ac !== 'on') return false;
        const text = describe(el);
        if (NOT_ABOUT_USER.test(text)) return false;
        return el.type === 'email' || el.type === 'tel' || PERSONAL.some((re) => re.test(text));
      }
    );
    return els.length ? { confidence: 'likely', count: els.length, nodes: refs(els) } : null;
  }

  // WCAG 1.3.1 / 2.4.6. Without headings, screen reader users can't jump between sections.
  function noHeadings() {
    const headings = visible('h1, h2, h3, h4, h5, h6, [role=heading]');
    const textBlocks = visible('p, li, td, label').length;
    return !headings.length && textBlocks >= 5 ? { confidence: 'likely', count: 1 } : null;
  }

  // WCAG 2.2.1. Looks for "your session will expire" wording with no visible way to get more time.
  const TIME_LIMIT =
    /\b(session|you)\b[^.!?]{0,80}?\b(expires?|expired|time[sd]? ?out|timed out|log(ged)? (you )?out|sign(ed)? (you )?out|end)\b|\binactivity\b/i;
  const EXTEND = /\b(extend|stay (signed|logged) in|keep me (signed|logged) in|continue (my )?session|more time|still here)\b/i;
  function timeLimit() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const hits = new Set();
    for (let node = walker.nextNode(); node && hits.size < 10; node = walker.nextNode()) {
      if (!node.data.trim()) continue; // whitespace between tags would match whole page sections
      const el = node.parentElement?.closest('p, div, span, li, section, header, aside') ?? node.parentElement;
      if (el && !hits.has(el) && TIME_LIMIT.test(clean(el.textContent)) && isVisible(el)) hits.add(el);
    }
    // Keep the innermost elements: a message inside a banner is one finding, not two.
    const els = [...hits].filter((el) => ![...hits].some((other) => other !== el && el.contains(other))).slice(0, 3);
    if (!els.length) return null;
    const controls = visible('button, a[href], [role=button], input[type=button], input[type=submit]');
    if (controls.some((c) => EXTEND.test(clean(c.textContent || c.value || c.getAttribute('aria-label'))))) return null;
    return { confidence: 'possible', count: els.length, nodes: refs(els), examples: els.map((el) => clean(el.textContent).slice(0, 160)) };
  }

  // WCAG 2.2.2. Animations that loop forever with no pause control.
  function endlessMotion() {
    const isSpinner = (el) => el.closest('[role=progressbar], [aria-busy=true]') || /spin|load/i.test(el.className?.toString?.() ?? '');
    const animated = (document.getAnimations?.() ?? [])
      .filter((a) => a.playState === 'running' && a.effect?.getComputedTiming?.().iterations === Infinity)
      .map((a) => a.effect.target)
      .filter((el) => el instanceof Element && isVisible(el) && !isSpinner(el));
    const videos = visible('video').filter((v) => v.loop && !v.paused);
    const els = [...new Set([...animated, ...videos])];
    return els.length ? { confidence: 'possible', count: els.length, nodes: refs(els) } : null;
  }

  // WCAG 1.3.1. axe's rule for data tables without headers is experimental and doesn't
  // run by default, yet lab results in a header-less grid are common on portals.
  function tableNoHeaders() {
    const els = visible('table').filter(
      (t) =>
        !/^(presentation|none)$/.test(t.getAttribute('role') ?? '') &&
        t.rows.length >= 2 &&
        Math.max(...[...t.rows].map((r) => r.cells.length)) >= 2 &&
        !t.querySelector('th, [role=columnheader], [role=rowheader]')
    );
    return els.length ? { confidence: 'likely', count: els.length, nodes: refs(els) } : null;
  }

  // Documents only offered as PDFs are often hard to use with screen readers and zoom.
  function pdfOnly() {
    const els = visible('a[href]').filter((a) => /\.pdf($|[?#])/i.test(a.getAttribute('href')) || /\bpdf\b/i.test(a.textContent));
    return els.length ? { confidence: 'possible', count: els.length, nodes: refs(els) } : null;
  }

  // WCAG 2.2 3.3.8. Puzzles can lock people out of their own records.
  function captcha() {
    const els = visible(
      'iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="challenges.cloudflare.com"], .g-recaptcha, .h-captcha, .cf-turnstile'
    );
    return els.length ? { confidence: 'possible', count: els.length, nodes: refs(els) } : null;
  }

  const CHECKS = {
    'focus-hidden': focusHidden,
    'placeholder-label': placeholderLabel,
    'autocomplete-missing': autocompleteMissing,
    'no-headings': noHeadings,
    'table-no-headers': tableNoHeaders,
    'time-limit': timeLimit,
    'endless-motion': endlessMotion,
    'pdf-only': pdfOnly,
    captcha,
  };

  HB.runChecks = () =>
    Object.entries(CHECKS).flatMap(([id, check]) => {
      try {
        const found = check();
        return found ? [{ id, nodes: [], examples: [], ...found }] : [];
      } catch {
        return []; // one broken heuristic must not break the whole scan
      }
    });
})();
