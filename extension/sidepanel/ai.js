// sidepanel/ai.js — "Say it more simply" using Chrome's built-in, on-device AI (Gemini Nano).
// The text never leaves this computer. When the model isn't available the feature stays
// hidden, and the rewrite is always shown under the original, labelled as AI.

const LANG = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };

const INSTRUCTIONS = `You rewrite health and insurance text so that a 12-year-old can understand it.
Rules:
- Use short sentences and everyday words.
- Keep every number, dollar amount, percent, date, name and medical term exactly as written.
- When you keep a hard term, add its plain meaning in brackets after it.
- Do not add advice, opinions or facts that are not in the text. Do not leave anything out.
- Reply with only the rewritten text.`;

const REWRITER_OPTIONS = { tone: 'more-casual', length: 'as-is', format: 'plain-text', sharedContext: INSTRUCTIONS };

// 'available' | 'downloadable' | 'downloading' | 'unavailable'
export async function aiStatus() {
  try {
    if (typeof self.LanguageModel?.availability === 'function') return { api: 'prompt', state: await self.LanguageModel.availability(LANG) };
    if (typeof self.Rewriter?.availability === 'function') return { api: 'rewriter', state: await self.Rewriter.availability(REWRITER_OPTIONS) };
  } catch {
    // Older Chrome or unsupported hardware.
  }
  return { api: null, state: 'unavailable' };
}

// Must be called from a click: creating the model may start a download, which needs user activation.
export async function simplify(text, { onProgress } = {}) {
  const { api, state } = await aiStatus();
  if (state === 'unavailable') throw new Error('On-device AI isn’t available on this computer.');
  const monitor = (m) => m.addEventListener('downloadprogress', (e) => onProgress?.(Math.round((e.loaded ?? 0) * 100)));

  if (api === 'prompt') {
    const session = await self.LanguageModel.create({ ...LANG, initialPrompts: [{ role: 'system', content: INSTRUCTIONS }], monitor });
    try {
      return (await session.prompt(`Rewrite this text:\n\n${text}`)).trim();
    } finally {
      session.destroy();
    }
  }
  const rewriter = await self.Rewriter.create({ ...REWRITER_OPTIONS, monitor });
  try {
    return (await rewriter.rewrite(text)).trim();
  } finally {
    rewriter.destroy();
  }
}
