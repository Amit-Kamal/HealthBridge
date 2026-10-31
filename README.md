# HealthBridge

HealthBridge is a Chrome extension that helps disabled patients get things done on patient portals as they are today: book a visit, read lab results, understand a bill. It opens in Chrome's side panel when the patient presses its button. It changes only what that patient sees, and it never sends page content anywhere.

It has four tools:

- **Read this page.** The page as simple text. Hard words such as "deductible" or "A1c" are explained in place, lab tables become one card per result, and the page can be read aloud with each word highlighted. Pages with no real headings get headings, icon-only buttons and links get a guessed name (marked as a guess), and dense paragraphs are flagged. On computers with Chrome's built-in AI it can rewrite a paragraph in plain words on the device, and it warns if the rewrite drops a number or a "not".
- **Fill in a form.** One question at a time, keyboard friendly, with each answer typed into the real form. It says when the site didn't label a field and HealthBridge is guessing, and checks that each answer stuck. You review before sending, and afterwards it finds the site's error messages and takes you back to the question. If the site signs you out, it can put your answers back.
- **Check this site.** axe-core's automated WCAG checks plus HealthBridge's own checks for problems axe can't test, such as hidden focus outlines, placeholder-only labels, time limits, endless animation and tables with no headers. Results come as a graded report card in plain language, with "Show on page" and a one-tap workaround where there is one. It can write an editable message to the clinic and save a full report for the site's developers.
- **Display.** High contrast, text spacing, a strong focus outline, bigger buttons, stop motion, a reading guide and page zoom. These are injected as user stylesheets, so they win over the site's own CSS.

It is not an overlay. The patient installs and controls it, it is never sold to websites, it makes no compliance claims, and it gives a broken site the grade it earns.

> **Hackathon rules:** many hackathons require that code is written during the event. If yours does, use this repo as a reference design and rebuild it at the event, or disclose it as prior work. See [docs/PLAN.md](docs/PLAN.md).

## Quick start

Needs Chrome 116 or later and Node 20 or later (Node is only for the demo server and tests).

```bash
npm install
npm run demo          # serves the demo portals at http://localhost:8000
Open chrome://extensions, turn on Developer mode, choose Load unpacked, and select the extension/ folder (not the repo root).

Open http://localhost:8000/broken/.

Press the HealthBridge toolbar button, or Alt+Shift+H. The side panel opens for that tab.

The demo portals hold synthetic data only. broken/ has 17 planted failures, listed in demo-portal/README.md. fixed/ is the same page with those failures fixed, and it gets an A.

Tests
Bash
npm test              # unit tests (node:test, no browser)
npx puppeteer browsers install chrome   # once, for the end-to-end tests
npm run test:e2e      # loads the real extension into headless Chrome
The end-to-end suite drives the real unpacked extension in Chrome. It covers:

the grades on both demo portals, and HealthBridge-only findings;

booking a visit with the keyboard only, and the values landing in the real form;

site errors after sending, and refilling answers after a reload;

React-controlled inputs, by checking React's own state;

every display setting beating the site's CSS and turning off cleanly, and arriving before a slow page finishes loading on always-allowed sites;

the permission model, using a real toolbar click: no access before it, access after it, kept on the same site and lost on another;

the side panel's own accessibility: axe finds zero WCAG 2.2 A/AA or best-practice violations in 14 panel states.

On Linux, Chrome needs its usual shared libraries. On Amazon Linux or Fedora, run sudo dnf install atk at-spi2-atk cups-libs libxkbcommon alsa-lib mesa-libgbm pango libXcomposite libXdamage libXrandr nss.

How it works
Toolbar button / Alt+Shift+H / right-click menu
        │  (Chrome grants activeTab for this page)
        ▼
┌─ background.js (service worker) ─────────────────────────────────────┐
│ opens a panel bound to this tab: sidepanel.html?tabId=N              │
│ relays panel requests → injects content scripts on demand            │
│ applies display settings as USER stylesheets (beat site !important)  │
└───────┬───────────────────────────────────────────────▲──────────────┘
        │ scripting.executeScript / insertCSS            │ {ok, data | code, error}
        │ tabs.sendMessage(tabId, msg, {frameId: 0})     │
┌───────▼─ content scripts (isolated world, top frame) ──┴──────────────┐
│ core.js     registry of element ids (in memory, nothing written to   │
│             the page), highlight overlay, SPA change notices         │
│ scan.js     axe-core 4.14 (WCAG 2.1 + 2.2 A/AA)    checks.js  own checks │
│ reader.js   blocks, tables, actions                forms.js   questions, │
│ display.js  pause videos, reading guide                       fill, errors │
└───────────────────────────────────────────────────────────────────────┘
┌─ side panel (extension page, ES modules, no framework, no build) ─────┐
│ main.js tabs · api.js messaging · views/{read,fill,check,display}.js │
│ speech.js read aloud · ai.js on-device AI · shared/*.js pure logic   │
└───────────────────────────────────────────────────────────────────────┘
Message (panel → page)	What it does
SCAN	runs axe and HealthBridge checks; returns element ids, never page HTML
READ_PAGE	headings, text, tables as rows, a form summary, buttons and links
READ_FORM / FILL_FIELD / SUBMIT_FORM / CHECK_FORM	the form helper
HIGHLIGHT / SHOW_FIELD / ACTIVATE	outline something on the page, or press it
Design choices worth knowing:

Access only when asked. Nothing is injected until the user presses the button, which grants activeTab for that page. "Always allow on this site" requests a per-site optional permission from the panel, and those sites get display settings at document_start (no flash of the original colors). The localhost host permissions are for the demo only; remove them in a store build.

Nothing written into the page's DOM. The panel refers to elements by opaque ids held in the content script's memory, so the portal's scripts and analytics can't see markers of assistive-technology use. Highlights and the reading guide are drawn in closed shadow roots.

Untrusted text, privileged panel. The panel builds DOM with text nodes only (ui.js h()), and links are limited to https:.

One stylesheet per page. Display settings are tracked per document (documentId), and updates for a tab run one at a time, so quick toggles can't interleave and "off" always removes the stylesheet.

Honest guesses. When the site gives no label or name, HealthBridge guesses and says so. It never writes its guesses into the page.

The grade
Only WCAG 2.1 A/AA results count, because that is the version US health rules (HHS Section 504, ADA Title II) cite. Each failed axe rule costs weight × (1 + min(log2(elements), 3) / 3), with weights critical 10, serious 6, moderate 3 and minor 1. Score = 100 − cost. A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, otherwise F. Any critical problem caps the grade at C. WCAG 2.2 results and HealthBridge's own checks are listed separately and never change the grade. See extension/shared/scoring.js.

Privacy
Page content is processed in the browser and never sent anywhere. HealthBridge has no servers, accounts or analytics. Display settings live in chrome.storage.local. Form answers are kept in memory (chrome.storage.session) for up to an hour so they can be put back after a sign-out, and Chrome deletes them when it closes. Online "Google" voices, which send text to Google, are off unless the user allows them. Details are in docs/PRIVACY.md.

Limitations
Content inside iframes (often payments or chat) is not scanned or read. The report says how many frames were skipped.

Custom comboboxes and other non-native widgets can't be filled. The helper says so and offers "Show on page". Native inputs, selects, radio and checkbox groups, and ARIA radio groups, checkboxes and switches are supported.

Desktop Chrome only. Edge has the same extension APIs but hasn't been tested. Chrome for Android doesn't run extensions.

English only for now (glossary, reading level, plain-language text).

Word-by-word highlighting depends on the voice. Most local Windows and macOS voices support it; elsewhere the whole block is highlighted.

Automated checks find only some problems. The report card says so.

Project layout
extension/          load this folder in chrome://extensions
  manifest.json  background.js
  content/       core, checks, scan, reader, forms, display, early (+ css/)
  sidepanel/     sidepanel.html/css, main.js, api.js, ui.js, speech.js, ai.js, views/
  shared/        scoring, wcag, ruleHelp, checkHelp, glossary, readability, labs,
                 textSafety, fields, report   (pure modules, unit-tested)
  lib/           axe.min.js (MPL-2.0) and its license
demo-portal/        broken/, fixed/ (synthetic data); react/, slow/ (test fixtures)
scripts/            serve.mjs, vendor.mjs (copy axe), pack.mjs (zip), make-icons.mjs
test/unit/          node:test
test/e2e/           Puppeteer + headless Chrome
docs/               PLAN.md (hackathon plan and pitch), DEMO.md, PRIVACY.md
npm run pack writes dist/healthbridge-<version>.zip for submission or a clean-install test.

License
HealthBridge code: MIT (see LICENSE). axe-core is © Deque Systems and licensed under MPL-2.0. Its notice is kept in extension/lib/axe.min.js and extension/lib/axe-core-LICENSE.txt.
