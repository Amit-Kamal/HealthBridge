// content/display.js — the display settings that need script, not just CSS:
// pausing videos and script-driven animations, and the reading guide.
// The CSS settings are injected by background.js as user stylesheets.

(() => {
  const HB = globalThis.__hb;
  if (!HB || HB.display) return;
  HB.display = {};

  let guide = null;

  function stopMotion() {
    for (const video of document.querySelectorAll('video')) {
      if (!video.paused && (video.autoplay || video.loop || video.muted)) video.pause();
    }
    // CSS animations are handled by motion.css; this catches ones started from script.
    for (const animation of document.getAnimations?.() ?? []) {
      if (!(animation instanceof CSSAnimation) && animation.effect?.getComputedTiming().iterations === Infinity) animation.pause();
    }
  }

  // A band that follows the pointer and keyboard focus, to help keep your place in text.
  function setGuide(on) {
    if (!on) {
      guide?.remove();
      guide = null;
      return;
    }
    if (guide) return;
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `<style>
      .band { position: fixed; left: 0; right: 0; top: -200px; height: 2.8em; pointer-events: none;
              z-index: 2147483646; box-sizing: border-box; background: rgba(255, 191, 71, 0.14);
              border-block: 3px solid #ffbf47; }
    </style><div class="band"></div>`;
    const band = shadow.querySelector('.band');
    const moveTo = (y) => { band.style.top = `${y - band.offsetHeight / 2}px`; };
    const onPointer = (event) => moveTo(event.clientY);
    const onFocus = (event) => {
      const rect = event.target?.getBoundingClientRect?.();
      if (rect) moveTo(rect.top + rect.height / 2);
    };
    addEventListener('pointermove', onPointer, { passive: true });
    addEventListener('focusin', onFocus);
    document.documentElement.append(host);
    guide = {
      remove() {
        removeEventListener('pointermove', onPointer);
        removeEventListener('focusin', onFocus);
        host.remove();
      },
    };
  }

  function apply(display = {}) {
    if (display.motion) stopMotion();
    setGuide(Boolean(display.guide));
  }

  chrome.storage.local.get('display').then(({ display }) => apply(display));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.display) apply(changes.display.newValue);
  });
})();
