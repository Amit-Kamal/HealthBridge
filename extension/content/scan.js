// content/scan.js — runs axe-core plus HealthBridge's own checks for problems axe
// can't test. Returns element references (opaque ids), never page HTML: markup can
// contain patient details such as names typed into fields.

(() => {
  const HB = globalThis.__hb;
  if (!HB || HB.handlers.SCAN) return;

  // WCAG 2.1 A/AA is what US health regulations cite; 2.2 adds target size and more.
  const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];
  const MAX_NODES = 20;

  const trim = (result) => ({
    id: result.id,
    impact: result.impact ?? 'minor',
    help: result.help,
    helpUrl: result.helpUrl,
    tags: result.tags,
    nodeCount: result.nodes.length,
    nodes: result.nodes.slice(0, MAX_NODES).map((node) => {
      const el = HB.resolveAxeTarget(node.target);
      return { id: el ? HB.ref(el) : null, summary: (node.failureSummary ?? '').slice(0, 400) };
    }),
  });

  async function runAxe() {
    const results = await window.axe.run(document, {
      runOnly: { type: 'tag', values: TAGS },
      resultTypes: ['violations', 'incomplete'],
      // Frames don't have axe injected, and waiting for them can stall the scan.
      iframes: false,
    });
    return {
      engine: results.testEngine.version,
      ranAt: results.timestamp,
      violations: results.violations.map(trim),
      incomplete: results.incomplete.map(trim),
      passCount: results.passes.length,
    };
  }

  let running = null;

  async function scan() {
    const [axeResult, checks] = [await runAxe(), HB.runChecks()];
    const reader = HB.handlers.READ_PAGE?.() ?? { blocks: [] };
    return {
      // Origin and path only: query strings can hold patient or visit ids.
      url: location.origin + location.pathname,
      title: HB.clean(document.title),
      frameCount: document.querySelectorAll('iframe, frame').length,
      ...axeResult,
      checks,
      textBlocks: reader.blocks.filter((b) => b.kind === 'text').map((b) => b.text),
    };
  }

  // A second Scan press while one is running reuses it (axe refuses to run twice at once).
  HB.handlers.SCAN = () => {
    running ??= scan().finally(() => { running = null; });
    return running;
  };
})();
