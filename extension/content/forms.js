// content/forms.js — reads a form as a list of questions, writes answers into the real
// fields, and reports the site's error messages after the user sends the form.
// Never reads or fills password or file fields.

(() => {
  const HB = globalThis.__hb;
  if (!HB || HB.handlers.READ_FORM) return;

  const { clean, isVisible } = HB;
  const NATIVE =
    'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]):not([type=password]):not([type=file]), select, textarea';
  const ARIA_WIDGETS = '[role=radiogroup], [role=checkbox], [role=switch], [role=combobox]:not(input):not(select), [role=listbox], [contenteditable=true][role=textbox]';
  const ERROR_CLASS = /\b(error|errors|invalid|err|danger|warning)\b|error|invalid/i;
  const ERROR_WORDS = /\b(required|invalid|must|please (enter|select|choose|provide)|not valid|is missing|can't be blank|cannot be blank|incorrect)\b/i;
  const DONE_WORDS = /\b(confirmation|confirmed|thank you|success(fully)?|submitted|requested|booked|scheduled|received)\b/i;

  /** id -> { kind, elId, optionIds?, label } for the form read most recently. */
  let fields = new Map();
  let scopeId = null;
  let observer = null;
  let confirmationBefore = '';

  const textOfIds = (ids) =>
    clean((ids ?? '').split(/\s+/).map((id) => (id ? document.getElementById(id)?.textContent : '')).join(' '));

  const humanize = (s) => clean((s ?? '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-.[\]]+/g, ' '));

  // ---------- Labels, hints, errors ----------

  // A label the site really provides (source 'label' or 'aria'), or our best guess (source 'guess').
  function labelFor(el) {
    const real = [
      ['aria', textOfIds(el.getAttribute('aria-labelledby'))],
      ['aria', clean(el.getAttribute('aria-label'))],
      ['label', clean([...(el.labels ?? [])].map((l) => l.textContent).join(' '))],
      ['aria', clean(el.title)],
    ];
    for (const [source, text] of real) if (text) return { label: text.slice(0, 200), labelSource: source };

    const prev = el.previousElementSibling;
    const guesses = [
      clean(el.placeholder),
      prev && !prev.matches('input, select, textarea, button') ? clean(prev.textContent).slice(0, 80) : '',
      clean([...(el.parentElement?.childNodes ?? [])].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.data).join(' ')),
      humanize(el.name || el.id),
    ];
    const guess = guesses.find(Boolean);
    return guess ? { label: guess, labelSource: 'guess' } : { label: 'Question with no name', labelSource: 'none' };
  }

  function hintFor(el) {
    const described = textOfIds(
      (el.getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .filter((id) => id && !ERROR_CLASS.test(id))
        .join(' ')
    );
    if (described) return described.slice(0, 300);
    const near = el.parentElement?.querySelector('.hint, .help, .help-text, .instructions, .description, small');
    return near && near !== el && isVisible(near) ? clean(near.textContent).slice(0, 300) : '';
  }

  // Returns { message, linked } — linked means a screen reader would announce it.
  function errorFor(el) {
    const invalid = el.getAttribute('aria-invalid') === 'true';
    const viaErrormessage = invalid ? textOfIds(el.getAttribute('aria-errormessage')) : '';
    if (viaErrormessage) return { message: viaErrormessage, linked: true };
    for (const id of (el.getAttribute('aria-describedby') ?? '').split(/\s+/)) {
      const node = id && document.getElementById(id);
      if (node && isVisible(node) && (ERROR_CLASS.test(`${node.id} ${node.className}`) || node.getAttribute('role') === 'alert' || ERROR_WORDS.test(node.textContent))) {
        return { message: clean(node.textContent).slice(0, 300), linked: true };
      }
    }
    // Error text the site shows near the field without connecting it (common on portals).
    // Only search containers that hold this one question, so one field's error is
    // never pinned on its neighbour.
    let container = el.parentElement;
    for (let depth = 0; container && depth < 3; depth++, container = container.parentElement) {
      if (container.matches('form, section, main, body, [role=main]')) break;
      const others = [...container.querySelectorAll(NATIVE)].filter((f) => f !== el && !(el.name && f.name === el.name && f.type === 'radio'));
      if (others.length) break;
      const hit = [...container.querySelectorAll('[role=alert], [class], [id]')].find(
        (n) =>
          n !== el &&
          !n.contains(el) &&
          !n.matches('label, input, select, textarea, button, option') &&
          (ERROR_CLASS.test(`${n.id} ${n.className}`) || n.getAttribute('role') === 'alert') &&
          isVisible(n) &&
          clean(n.textContent)
      );
      if (hit) return { message: clean(hit.textContent).slice(0, 300), linked: false };
    }
    return null;
  }

  function sectionFor(el) {
    const legend = el.closest('fieldset')?.querySelector(':scope > legend');
    if (legend && el.type !== 'radio' && el.type !== 'checkbox') return clean(legend.textContent);
    return '';
  }

  function isRequired(el, label) {
    return el.required || el.getAttribute('aria-required') === 'true' || /\*|\(required\)|\brequired\b/i.test(label);
  }

  // Stable across reloads, so saved answers can be put back after a session timeout.
  const keyFor = (el, label) => `${el.tagName.toLowerCase()}|${el.type ?? el.getAttribute('role') ?? ''}|${el.name || el.id || label}`;

  // ---------- Reading the form ----------

  // The form with the most visible questions, or the main content if the site uses no <form>.
  function pickScope() {
    const forms = [...document.forms].filter(isVisible);
    const count = (f) => [...f.querySelectorAll(`${NATIVE}, ${ARIA_WIDGETS}`)].filter(isVisible).length;
    const best = forms.sort((a, b) => count(b) - count(a))[0];
    return best && count(best) ? best : document.querySelector('main, [role=main]') ?? document.body;
  }

  function optionLabel(el) {
    return clean([...(el.labels ?? [])].map((l) => l.textContent).join(' ')) || clean(el.getAttribute('aria-label')) || clean(el.textContent) || el.value;
  }

  function readForm() {
    const scope = pickScope();
    scopeId = HB.ref(scope);
    fields = new Map();
    const questions = [];
    const seenGroups = new Set();
    const controls = [...scope.querySelectorAll(`${NATIVE}, ${ARIA_WIDGETS}`)].filter(
      (el) => isVisible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true'
    );

    for (const el of controls) {
      // Native radio buttons become one question per group.
      if (el.matches('input[type=radio]')) {
        const groupKey = el.name || HB.ref(el);
        if (seenGroups.has(groupKey)) continue;
        seenGroups.add(groupKey);
        const radios = el.name
          ? controls.filter((r) => r.matches('input[type=radio]') && r.name === el.name)
          : [el];
        const legend = clean(el.closest('fieldset')?.querySelector(':scope > legend')?.textContent);
        const id = HB.ref(el);
        const label = legend || humanize(el.name) || 'Choose one';
        fields.set(id, { kind: 'radio', elId: id, optionIds: radios.map(HB.ref), label });
        questions.push({
          id,
          kind: 'radio',
          label,
          labelSource: legend ? 'label' : 'guess',
          hint: '',
          required: radios.some((r) => r.required),
          value: radios.find((r) => r.checked)?.value ?? '',
          options: radios.map((r) => ({ value: r.value, label: optionLabel(r) })),
          error: errorFor(radios[0]),
          key: keyFor(el, label),
          section: '',
        });
        continue;
      }

      // ARIA radio groups: options are elements with role=radio.
      if (el.matches('[role=radiogroup]')) {
        const options = [...el.querySelectorAll('[role=radio]')].filter(isVisible);
        if (!options.length) continue;
        const id = HB.ref(el);
        const { label, labelSource } = labelFor(el);
        fields.set(id, { kind: 'aria-radio', elId: id, optionIds: options.map(HB.ref), label });
        questions.push({
          id,
          kind: 'radio',
          label,
          labelSource,
          hint: hintFor(el),
          required: isRequired(el, label),
          value: clean(options.find((o) => o.getAttribute('aria-checked') === 'true')?.textContent),
          options: options.map((o) => ({ value: clean(o.textContent), label: clean(o.getAttribute('aria-label')) || clean(o.textContent) })),
          error: errorFor(el),
          key: keyFor(el, label),
          section: sectionFor(el),
        });
        continue;
      }

      const id = HB.ref(el);
      const { label, labelSource } = labelFor(el);
      let kind;
      if (el.matches('[role=checkbox], [role=switch]')) kind = 'aria-checkbox';
      else if (el.matches('[role=combobox], [role=listbox], [contenteditable]')) kind = 'unsupported';
      else if (el.tagName === 'SELECT') kind = el.multiple ? 'unsupported' : 'select';
      else if (el.tagName === 'TEXTAREA') kind = 'textarea';
      else if (el.type === 'checkbox') kind = 'checkbox';
      else kind = 'text';

      fields.set(id, { kind, elId: id, label });
      questions.push({
        id,
        kind: kind === 'aria-checkbox' ? 'checkbox' : kind,
        inputType: kind === 'text' ? el.type : undefined,
        label,
        labelSource,
        hint: hintFor(el),
        required: isRequired(el, label),
        readOnly: el.readOnly || el.getAttribute('aria-readonly') === 'true',
        value:
          kind === 'checkbox' ? el.checked
          : kind === 'aria-checkbox' ? el.getAttribute('aria-checked') === 'true'
          : kind === 'unsupported' ? ''
          : el.value,
        options:
          kind === 'select'
            ? [...el.options].filter((o) => !o.disabled).map((o) => ({ value: o.value, label: clean(o.textContent) }))
            : undefined,
        autocomplete: el.getAttribute('autocomplete') || undefined,
        min: el.min || undefined,
        max: el.max || undefined,
        maxLength: el.maxLength > 0 ? el.maxLength : undefined,
        error: errorFor(el),
        key: keyFor(el, label),
        section: sectionFor(el),
      });
    }

    watchForChanges(scope, questions.length);
    return { questions, isForm: scope instanceof HTMLFormElement };
  }

  // Multi-step forms add and remove questions; tell the panel so it can offer a refresh.
  function watchForChanges(scope, count) {
    observer?.disconnect();
    let timer = 0;
    observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const now = [...scope.querySelectorAll(`${NATIVE}, ${ARIA_WIDGETS}`)].filter(isVisible).length;
        if (now !== count) {
          count = now;
          HB.notify('form');
        }
      }, 800);
    });
    observer.observe(scope.isConnected ? scope : document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
  }

  // ---------- Writing answers ----------

  // Frameworks such as React track input values themselves. The native setter plus
  // input/change events makes them notice; blur lets them run "on leave" validation.
  function setNativeValue(el, value) {
    const proto =
      el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
      : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new FocusEvent('blur'));
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function fill({ id, value }) {
    const field = fields.get(id);
    const el = field && HB.deref(field.elId);
    if (!el) throw new Error('This question is no longer on the page. Press "Start again" to read the form again.');

    if (field.kind === 'radio' || field.kind === 'aria-radio') {
      const options = field.optionIds.map(HB.deref).filter(Boolean);
      const choice = options.find((o) => (field.kind === 'radio' ? o.value : clean(o.textContent)) === value);
      if (choice && !(choice.checked || choice.getAttribute('aria-checked') === 'true')) choice.click();
      HB.highlight(choice ?? el);
    } else if (field.kind === 'checkbox' || field.kind === 'aria-checkbox') {
      const checked = field.kind === 'checkbox' ? el.checked : el.getAttribute('aria-checked') === 'true';
      if (checked !== Boolean(value)) el.click();
      HB.highlight(el);
    } else if (field.kind === 'unsupported') {
      throw new Error('The helper can’t fill this kind of question. Use the page for this one.');
    } else {
      setNativeValue(el, String(value ?? ''));
      HB.highlight(el);
    }

    // Some sites reformat or reject a value. Check it stuck instead of assuming.
    await wait(60);
    const now =
      field.kind === 'checkbox' ? el.checked
      : field.kind === 'aria-checkbox' ? el.getAttribute('aria-checked') === 'true'
      : field.kind === 'radio' ? field.optionIds.map(HB.deref).find((o) => o?.checked)?.value ?? ''
      : field.kind === 'aria-radio' ? clean(field.optionIds.map(HB.deref).find((o) => o?.getAttribute('aria-checked') === 'true')?.textContent)
      : el.value;
    return { value: now, stuck: field.kind === 'checkbox' || field.kind === 'aria-checkbox' ? now === Boolean(value) : now === String(value ?? '') };
  }

  // ---------- Sending and checking for errors ----------

  function submit() {
    const scope = HB.deref(scopeId);
    const form = scope instanceof HTMLFormElement ? scope : [...fields.values()].map((f) => HB.deref(f.elId)?.form).find(Boolean);
    if (!form) throw new Error('HealthBridge can’t find this form’s Send button. Please use the button on the page.');

    // If the browser would block the send, report the problems here instead of
    // showing its small pop-up bubbles on the page.
    if (!form.noValidate && !form.checkValidity()) return { submitted: false, ...findErrors() };

    confirmationBefore = findConfirmation();
    const submitter = [...form.querySelectorAll('button[type=submit], button:not([type]), input[type=submit]')].find(isVisible);
    try {
      form.requestSubmit(submitter);
    } catch {
      form.requestSubmit();
    }
    return { submitted: true };
  }

  function findConfirmation() {
    const root = document.querySelector('main, [role=main]') ?? document.body;
    const candidates = [...root.querySelectorAll('[role=status], [role=alert], [aria-live], p, h1, h2, h3, div')]
      .filter((el) => isVisible(el) && !el.querySelector('p, div, form, table') && DONE_WORDS.test(el.textContent));
    return candidates.length ? clean(candidates[0].textContent).slice(0, 300) : '';
  }

  function findErrors() {
    const errors = [];
    for (const [id, field] of fields) {
      const el = HB.deref(field.elId);
      if (!el) continue;
      const target = field.optionIds ? HB.deref(field.optionIds[0]) ?? el : el;
      const found = errorFor(target);
      const invalidNative = target.matches?.(':invalid') && target.validationMessage;
      if (found || invalidNative || target.getAttribute('aria-invalid') === 'true') {
        errors.push({
          id,
          label: field.label,
          message: found?.message || target.validationMessage || 'The site says this answer has a problem.',
          linked: found ? found.linked : Boolean(invalidNative),
        });
      }
    }
    const alerts = [...document.querySelectorAll('[role=alert], [aria-live=assertive]')]
      .filter(isVisible)
      .map((el) => clean(el.textContent))
      .filter(Boolean)
      .slice(0, 5);
    // Only report a confirmation that appeared after sending, not text that was always there.
    const confirmation = findConfirmation();
    return { errors, alerts, confirmation: confirmation !== confirmationBefore ? confirmation : '' };
  }

  Object.assign(HB.handlers, {
    READ_FORM: readForm,
    FILL_FIELD: fill,
    SUBMIT_FORM: submit,
    CHECK_FORM: findErrors,
    SHOW_FIELD: ({ id }) => {
      const field = fields.get(id);
      const el = field && HB.deref(field.elId);
      if (!el) throw new Error('This question is no longer on the page.');
      HB.highlight(el, field.label);
      return true;
    },
  });
})();
