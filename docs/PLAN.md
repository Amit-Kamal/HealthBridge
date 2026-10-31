# HealthBridge: hackathon plan (v2)

This plan comes with a working reference build in this repo, along with its tests. The facts in sections 1 and 5 were checked against primary sources on 31 October 2026; sources are at the end.

**First, check the rules.** Many hackathons require that code is written during the event. If yours does, follow track B in section 4: rebuild at the event and use this repo as a design reference. If prior work is allowed, disclose it in the submission and follow track A. Either way, tell the organizers before you start.

---

## 1. Executive summary and value proposition

### The problem

More than 1 in 4 U.S. adults (28.7%) report a disability, according to CDC data from 2022. The most common type is cognitive disability (13.9%). Patients book visits, read results, pay bills and message clinicians through portals, and the portals keep failing them in the same ways:

- forms with unlabeled fields, errors shown only as red text, and session timeouts with no way to get more time;
- insurance and lab language far above the 6th-grade reading level that the AMA advises for patient materials;
- lab and billing tables built as visual grids, icon-only buttons, and low-contrast text;
- custom widgets that trap the keyboard, and tiny targets packed close together.

Real cases show the cost. In 2024 the Justice Department required Springfield Clinic in Illinois to make its website, patient portal and apps meet WCAG 2.1 AA. A patient with a visual impairment couldn't read their records or pay a bill online, and had to have their medical information read to them over the phone.

**Why now.** The rules that would force portals to fix this keep slipping:
- HHS's Section 504 rule requires hospitals and clinics that receive HHS funding to make their websites and portals meet WCAG 2.1 AA. In May 2026, HHS delayed the deadline to May 2027 for larger providers and May 2028 for smaller ones.
- DOJ's ADA Title II rule for public hospitals and clinics was delayed to April 2027 and April 2028.
- The National Federation of the Blind is suing over both delays.
- On 28 October 2026, ONC finalized a rule that removes the only WCAG requirement from federal certification of patient portals' view-download-transmit feature.

Patients can't wait for any of this.

### The value proposition

HealthBridge is a tool the patient installs and controls. On any portal, as it is today, it lets them:
- **read** the page in plain form, with hard words explained;
- **fill in** forms one question at a time, with honest guesses where the site left out labels;
- **check** the site and get an honest grade, with a ready-to-send request for a fix;
- **change** how the page looks, just for them.

Everything runs on the patient's computer. It never claims to make a site compliant.

### Why this is not an overlay

An overlay is a script a website buys, usually sold as compliance. In April 2025 the FTC finalized an order requiring accessiBe to pay $1 million and barring it from claiming its automated product can make websites WCAG-compliant without evidence. HealthBridge is the opposite:

- the patient installs it, and it is never sold to sites;
- it works on every portal the patient uses (59% of people have more than one);
- it changes only that patient's view and writes nothing into the site;
- it labels its guesses as guesses;
- it gives broken sites the grade they earn.

### Personas

These are composites for the pitch, not real people. Don't put invented quotes on slides.

| Persona | What breaks for them | What HealthBridge does |
|---|---|---|
| **Dev**, brain injury and dyslexia (cognitive disability is the most common type, 13.9% of adults) | Jargon, long forms, timeouts, too many choices at once | Easy read with explained words and a reading level, one question at a time, answers put back after a timeout |
| **Maya**, low vision, uses a magnifier and sometimes a screen reader | Low contrast, small text, icon-only buttons, invisible focus | High contrast that beats site CSS, page zoom even where the site blocks it, a strong focus outline, buttons with guessed names, read aloud |
| **Sam**, tremor, often uses one hand | Tiny targets close together, hover menus, keyboard traps | Bigger targets, big panel buttons that press the real link or button, Enter for "next", no precise clicking |
| **Rosa**, helps her father with his portal (caregiver access more than doubled between 2020 and 2024, per ONC) | Doesn't know his plan's terms or what the lab flags mean | Glossary, lab cards that repeat the portal's flags without interpreting them, a message asking the clinic for caregiver access |

### How you win

The scanner gives a deliberately broken portal an **F**, and the panel books a visit on that same portal anyway. Then the fixed version of the same portal gets an **A**, which shows the grade is fair.

---

## 2. Technical architecture (Manifest V3)

### Manifest

`extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "HealthBridge",
  "version": "2.0.0",
  "minimum_chrome_version": "116",
  "action": { "default_title": "Open HealthBridge (Alt+Shift+H)" },
  "background": { "service_worker": "background.js" },
  "side_panel": { "default_path": "sidepanel/sidepanel.html" },
  "permissions": ["sidePanel", "activeTab", "scripting", "storage", "contextMenus"],
  "host_permissions": ["http://localhost/*", "http://127.0.0.1/*"],
  "optional_host_permissions": ["https://*/*", "http://*/*"],
  "commands": { "_execute_action": { "suggested_key": { "default": "Alt+Shift+H" } } }
}
```

| Permission | Why it's there | Install warning |
|---|---|---|
| `activeTab` | Access to the page only after the user presses the button, until they leave the site | None |
| `scripting` | Inject the content scripts and display stylesheets on demand | None (needs a host grant to do anything) |
| `sidePanel`, `storage`, `contextMenus` | Panel, settings and temporary answers, right-click "Read aloud" and "Explain" | None |
| `optional_host_permissions` | "Always allow on this site", requested per site from the panel | Only when asked |
| `host_permissions` for localhost | The demo portal. **Remove it in a store build.** | — |

Leave out `tabs`, `webNavigation`, `downloads`, `clipboardWrite` and `<all_urls>`. Nothing needs them, and they would add frightening install warnings.

### Tech stack

| Part | Choice | Why |
|---|---|---|
| Language | Vanilla JavaScript, ES modules in the panel, no build step | Load unpacked and edit live; there's no bundler to debug at 3 a.m. |
| UI | Plain DOM through a tiny `h()` helper that only creates text nodes | Page text is untrusted and the panel is privileged; there's no framework to make that mistake easy |
| Checks | axe-core 4.14 (MPL-2.0), bundled, plus HealthBridge's own checks | Zero-false-positive design, and the industry engine. Our checks cover what it can't see |
| Read aloud | Web Speech API, sentence-sized chunks, CSS Custom Highlight API for the current word | Works in the panel, and highlighting doesn't change the DOM |
| AI (optional) | Chrome's built-in Prompt API (Gemini Nano, on device), stable for extensions since Chrome 138 | No server, no key, and no text leaves the device. Hidden when the device doesn't support it |
| Tests | `node:test` for pure logic; Puppeteer driving the real extension in Chrome | It proves the demo works, including the permission model and the panel's own accessibility |

Use no cloud LLM. If you add one later, make it opt-in every time, show exactly what will be sent, and never send portal pages automatically.

### How the parts talk

```
Toolbar button / Alt+Shift+H ── grants activeTab ──► background.js opens sidepanel.html?tabId=N (one panel per tab)
Side panel ──runtime.sendMessage({target:'tab', tabId, payload})──► background.js
background.js ──executeScript / insertCSS (USER) / tabs.sendMessage(frameId 0)──► content scripts
content scripts ──{ok, data} or {ok:false, code, error}──► back to the panel
content scripts ──PAGE_CHANGED (URL change in a single-page app, form grew)──► panel
chrome.storage.local {display} ──onChanged──► background.js applies stylesheets to every tab it may read
```

Key decisions:

1. **One panel per tab.** `sidePanel.setOptions({tabId, path: 'sidepanel.html?tabId=N'})` then `sidePanel.open({tabId})`, both called synchronously inside the click. Results stay with their page, and the same `?tabId=` URL is the test hook.
2. **Access only when asked.** `activeTab` lasts while the user stays on the site and ends when the tab goes to another site. The panel then says "HealthBridge needs your OK" and how to give it. Sites the user always allows get a tiny script at `document_start`, so display settings apply before the first paint.
3. **Display settings as USER stylesheets** (`scripting.insertCSS({origin: 'USER'})`). Under CSS cascade rules a user's `!important` beats the site's `!important`. Inserting the same stylesheet twice needs two removals, so the worker tracks what is applied per `documentId` and runs updates for a tab one at a time.
4. **Nothing written into the page.** Elements are referred to by ids kept in the content script's memory (`WeakRef`), not `data-` attributes, and highlights are drawn in closed shadow roots. The portal's analytics can't see that someone uses assistive tools.
5. **Only text crosses into the panel**, rendered with `textContent`. The scan returns element ids, never HTML, because markup can contain a patient's typed name.

---

## 3. MVP feature spec and repository structure

### Features and how each is verified

| Feature | Done when (each line is an automated test) |
|---|---|
| Check this site | Broken portal: grade F, "3 problems can stop people finishing a task", 8 WCAG 2.1 problem types, 1 WCAG 2.2 problem, 8 HealthBridge findings. Fixed portal: grade A, nothing reported |
| Show on page | Outlines the element in an overlay on the page and steps through each place it occurs |
| Workaround buttons | "Turn on high contrast" on a problem card turns the page black and white |
| Message to the clinic | An editable message with the task, the problems and WCAG numbers, optional accommodation requests, and who to send it to |
| Easy read | Fake headings become headings, the lab grid becomes 5 cards with "The portal marked this result High", a glossary word expands with a MedlinePlus link, and the icon-only pay link is offered as "pay (name guessed)" and works |
| Read aloud | Word highlighting with local voices, an online-voice consent step, and a clear message when there is no voice |
| Form helper | Books the visit with the keyboard only, and the values land in the real fields. The guessed label is announced. The site's hidden "Required" error is found and linked back to its question. Answers come back after a reload. React state updates |
| Display | Each of 6 settings beats the site's CSS (including `*:focus{outline:none}`) and turns off completely. On always-allowed sites, high contrast arrives more than a second before a slow page finishes loading. Page zoom works on a page that blocks zooming |
| Permissions | Before the button is pressed the extension can't see the portal at all. After it, the panel works. Access is kept on the same site and lost on another |
| The panel's own accessibility | axe finds 0 WCAG 2.2 A/AA or best-practice violations in 14 panel states, including high contrast, and no state shows stray "null" text |

### Repository

```
extension/                     ← load this folder unpacked
  manifest.json, background.js
  content/  core.js checks.js scan.js reader.js forms.js display.js early.js  css/*.css
  sidepanel/ sidepanel.html sidepanel.css main.js api.js ui.js speech.js ai.js
             views/read.js fill.js check.js display.js
  shared/   scoring.js wcag.js ruleHelp.js checkHelp.js glossary.js readability.js
            labs.js textSafety.js fields.js report.js
  lib/      axe.min.js + license
demo-portal/  broken/ fixed/ react/
test/unit/  test/e2e/   scripts/   docs/
```

### Patterns worth copying

Open the panel without losing the user gesture (`background.js`):

```js
function openPanel(tab) {
  // Both calls must run synchronously inside the user's click: no await before open().
  chrome.sidePanel.setOptions({ tabId: tab.id, path: `sidepanel/sidepanel.html?tabId=${tab.id}`, enabled: true });
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
}
chrome.action.onClicked.addListener(openPanel);
```

Make display settings win over the site (`background.js`):

```js
await chrome.scripting.insertCSS({ target: { tabId, documentIds: [documentId] }, files: ['content/css/contrast.css'], origin: 'USER' });
```

Write into framework-controlled inputs (`content/forms.js`), then read the value back to check it stuck:

```js
Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
el.dispatchEvent(new Event('input', { bubbles: true }));
el.dispatchEvent(new Event('change', { bubbles: true }));
```

### axe-core integration

`content/scan.js` runs:

```js
axe.run(document, {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'] },
  resultTypes: ['violations', 'incomplete'],
  iframes: false, // frames don't have axe injected; waiting on them stalls the scan
});
```

- axe is injected only when the user runs a check (it's about 650 KB), into the isolated world, top frame only. Embedded frames are counted and reported as "not checked".
- The grade uses only WCAG 2.1 results, because that is the version US health rules cite. WCAG 2.2 results (such as target size) are listed separately.
- `incomplete` results are shown as "Needs a person to check".
- axe can't see several barriers by design, so `content/checks.js` adds HealthBridge checks:
  - focus outline removed (read from the site's CSS, so there are no side effects);
  - placeholder-only labels (axe accepts a placeholder as a name);
  - missing `autocomplete` on personal fields (WCAG 1.3.5);
  - no headings;
  - tables with no headers (axe's rule is experimental and off by default);
  - session time limits with no way to extend;
  - endless animation;
  - PDF-only documents;
  - CAPTCHAs.

  None of these touch the page, so a check can't trigger the site's validation or open its menus.

---

## 4. 24-hour roadmap

### Track A: reference build allowed (disclosed)

The product works on day zero, so spend the event on things judges reward: evidence from real users, a portal-specific adapter, and the pitch.

| Hours | Extension engineer | UI / accessibility | Design, research and pitch | Checkpoint |
|---|---|---|---|---|
| 0–1 | Clone, `npm install`, load `extension/`, run `npm run test:all` | Walk through every panel state with the keyboard and a screen reader (NVDA, VoiceOver) | Agree the demo flow and the cut list; book 2–3 testers, ideally disabled people, paid if possible | Everyone has seen the demo work |
| 1–4 | Try 3 real public health pages (a hospital "pay my bill" page, an insurer's glossary page, a public clinic booking form). Log what breaks | Fix anything the screen reader pass found | Slide skeleton; write the problem slide from the facts in section 1 | Bug list ranked |
| 4–8 | Fix the top 3 real-site failures (likely candidates: custom date pickers, comboboxes, iframes) | Usability test 1 with a tester; note where they hesitate | Run the test; write down quotes (with permission) and what changed | Something changed because of a tester |
| 8–12 | Stretch: on-device Translator for Easy read (Spanish), or MedlinePlus links for every lab name | Polish copy to grade 6 or below; test at 400% zoom | Record the backup demo video, first take | Video exists |
| 12–16 | Feature freeze at 16. `npm run test:all` must be green | Usability test 2; fix only what it finds | Rehearsal 1 with a timer | Freeze |
| 16–20 | Package (`npm run pack`); clean install from the zip on another laptop | Final accessibility pass: `test/e2e/panel-a11y.test.mjs` plus a manual screen reader run | README, Devpost text, sources slide; rehearsal 2 | Clean install works |
| 20–24 | Blockers only | Blockers only | Final video; submit with an hour to spare; rehearsal 3 | Submitted |

### Track B: code must be written at the event

Rebuild in the order the demo needs it. Use the repo as a design reference. Copying it would break the rule.

| Hours | Extension engineer | UI / accessibility | Design and pitch | Checkpoint |
|---|---|---|---|---|
| 0–1 | Manifest, worker with `openPanel()`, an empty panel | Panel shell: tabs, headings, live region, focus styles | Build the broken demo portal (copy the list of 17 planted failures, not the file) | The panel opens on the button |
| 1–4 | Inject on demand, axe scan, the relay with error codes | Report card: grade, counts, cards | Write plain-language text for the 10 most common axe rules | The broken portal gets an F |
| 4–8 | The element registry, highlight overlay, HealthBridge checks (focus, placeholder, time limit) | Show on page, workaround buttons | Glossary (20 terms), pitch outline | The check works end to end |
| 8–12 | Form reading and filling, React check | One question at a time, review screen | Fixed portal (A grade), slides | A visit gets booked through the panel |
| 12–16 | Display settings as USER CSS; errors after Send | Easy read with row cards and glossary | Test with 1–2 people | Freeze at 16 |
| 16–24 | As track A, hours 16–24 |  |  |  |

**Team of two:** one person builds the extension and panel, the other owns the demo portal, content, testing and pitch, and joins UI work from hour 8.
**Team of four:** add a QA and research person from hour 4 for user testing, the keyboard and screen reader passes, and real-site trials.
**Sleep:** stagger 3-hour sleeps between hours 12 and 20 so two people are always awake.

**Cut in this order if you fall behind:** AI rewrite → reading guide → read-aloud word highlight (keep block highlight) → putting answers back after a timeout → errors after Send. **Never cut** the check, the form helper, the broken and fixed demo portals, or the panel's own accessibility.

---

## 5. Pitch and demo

### Three minutes

| Time | Beat | What to say and show |
|---|---|---|
| 0:00–0:20 | Hook | "In 2024 the Justice Department had to step in because a patient with a visual impairment couldn't read their own records or pay a bill online. Three days ago, the federal government removed the only accessibility requirement from patient-portal certification." |
| 0:20–0:50 | Problem | "More than 1 in 4 U.S. adults has a disability, and the most common kind is cognitive. Portals hide labels, time you out, and write at a college level. The deadlines that would force fixes slipped to 2027 and 2028. Patients can't wait, and when portals fail, patients blame themselves." |
| 0:50–1:10 | Solution | "HealthBridge is a side panel the patient controls. It reads the page in plain words, fills in forms one question at a time, checks the site honestly, and changes how it looks. All on the patient's own computer." |
| 1:10–2:10 | Live demo | Follow [DEMO.md](DEMO.md): Tab with no focus, F grade, fix the focus outline, easy read, book the visit with the keyboard, the fixed portal gets an A |
| 2:10–2:30 | Not an overlay | "Overlays are sold to websites as compliance. The FTC made one vendor pay a million dollars for that claim. We're installed by the patient, we never claim compliance, we give a broken portal an F, and the patient books anyway." |
| 2:30–3:00 | Proof and ask | "Our own panel passes the same checks with zero violations, and every step you saw is an automated test. Next: real-portal adapters, Spanish on the device, a phone version. We're asking for disabled testers and one clinic willing to receive our reports." |

### Questions judges will ask

**Isn't this just an overlay?**
No. An overlay is bought by the site, runs for every visitor and is sold as compliance. In April 2025 the FTC finalized an order requiring accessiBe to pay $1 million and barring claims that its automated product makes sites WCAG-compliant without evidence. More than 1,000 accessibility practitioners have signed the Overlay Fact Sheet against overlays. HealthBridge is installed by the patient, sold to no one, writes nothing into the site, labels its guesses, and grades the site honestly.

**Can the grade be trusted?**
For what it claims. It comes from axe-core rules, which are designed to report no false positives, using a published formula anyone can recompute. Automated checks catch only part of what matters: Deque found about 57% of issues by volume, and in a UK government test the best tool found 40% of planted barriers. So the card says "automated checks only", lists HealthBridge's extra checks separately, and includes a check-it-yourself list. The fixed portal gets an A, so the grade isn't rigged.

**How is this different from Chrome's Reading mode?**
Reading mode is a good article reader, and it already reads aloud with word highlighting. But Google's help page says it may not work on forms, payment pages and login screens, which is where portal tasks happen. HealthBridge works on the live page: it fills the form, rebuilds the lab table, explains insurance terms, applies settings to the real page and checks the site.

**Why not just use a screen reader?**
Most disabled patients don't use one: cognitive (13.9%) and mobility (12.2%) disabilities are far more common than vision (5.5%). And a screen reader can't supply a label the page left out or explain "coinsurance". HealthBridge works alongside screen readers, and its panel is tested to pass axe with zero violations.

**What about privacy and HIPAA?**
Nothing leaves the device. There are no servers, accounts or analytics, and the extension makes no network requests. Online voices, which send text to Google, are off unless the patient allows them. HIPAA covers providers, health plans and their contractors, not a tool a patient installs, so don't say "HIPAA compliant". Say "we never see your data". If the tool ever stored or sent health data, the FTC's Health Breach Notification Rule could apply, which is one more reason not to.

**What happens when the portal changes its HTML?**
We read semantics (labels, ARIA, legends, table headers) rather than portal-specific selectors, and when we have to guess, we say so. There's an end-to-end test against a React form. Anything we can't fill, we say so and show on the page.

**Why would portal vendors not fix it themselves?**
They should, and the report gives them exactly what to fix, with WCAG numbers. The message goes to the clinic's Section 1557 coordinator, the person many clinics must name to handle these requests. But deadlines slipped to 2027 and 2028, so HealthBridge is the bridge in the meantime.

**Can Epic or a portal block you?**
Websites can't turn off a patient's extensions; only the browser's owner or an IT admin can. We have no server, scraper or stored password. A portal that refused service because a patient used an assistive tool would be inviting a disability discrimination complaint.

**Why a browser extension and not a phone app?**
Many patients use portal apps on phones, but Chrome for Android doesn't run extensions. We started on desktop, where long forms and bills get done and where magnifiers, keyboards and switches are used. The content scripts are standard WebExtension code, so a phone version for Safari on iOS and Firefox for Android is the next step.

**Why not let an AI agent just book it?**
Agents send the page to the cloud and act on their own, and their makers treat health as high-risk. Page text can hijack them through prompt injection. HealthBridge has no agent loop: it acts only when the patient presses a button, one field at a time, with a review screen.

**Did disabled people help design it?**
Answer with what actually happened: who tested, how many, and what changed. If it was not enough, say so, and name a paid advisory group as the next step.

**Business model?**
Free and open source for patients: no data sales, no telemetry, and no site licenses, because selling to sites would make it an overlay. Sustainability through accessibility grants and organizations that benefit when patients finish tasks, such as health plans' member services and patient-experience teams. That's a hypothesis to test.

### Things not to say

- That the Section 504 or Title II deadlines "passed". Both were extended and are being challenged in court.
- "WCAG 2.1 AA is the law for every healthcare website." Private practices fall under ADA Title III, which has no codified technical standard.
- "CDC recommends a 6th-grade level." That recommendation is the AMA's; AHRQ suggests 4th to 6th grade.
- "axe catches 57% of the issues on this page." The 57% is an average across audits.
- "Disabled people use portals less." The evidence is about barriers and difficulty, not usage.
- "The FTC fined or banned overlays." It ordered one vendor to pay $1 million and barred unsupported claims.
- "HIPAA compliant." Also never "HealthBridge makes the portal compliant", and never "certified" or "ADA-ready".

### Sources

- CDC, Disability and Health Data System, 2022: <https://www.cdc.gov/disability-and-health/about/index.html>
- HHS Section 504 rule (89 FR 40066) and its 2026 extension (91 FR 25496): <https://www.federalregister.gov/documents/2024/05/09/2024-09237> · <https://www.federalregister.gov/documents/2026/05/11/2026-09266>
- DOJ ADA Title II rule (89 FR 31320) and its 2026 extension (91 FR 20902): <https://www.federalregister.gov/documents/2024/04/24/2024-07758> · <https://www.federalregister.gov/documents/2026/04/20/2026-07663>
- ONC rule removing WCAG from portal certification (91 FR 67916, 28 Oct 2026): <https://www.federalregister.gov/documents/2026/10/28/2026-21943>
- Section 1557 (45 CFR 92.204 accessibility; 92.7 coordinator): <https://www.ecfr.gov/current/title-45/section-92.204>
- DOJ and Springfield Clinic (2024): <https://www.justice.gov/usao-cdil/pr/justice-department-secures-agreement-springfield-clinic-make-its-online-services>
- FTC and accessiBe (Jan and Apr 2025): <https://www.ftc.gov/news-events/news/press-releases/2025/04/ftc-approves-final-order-requiring-accessibe-pay-1-million>
- Overlay Fact Sheet: <https://overlayfactsheet.com/en/>
- AMA Foundation health literacy manual; AHRQ toolkit, Tool 11: <https://www.ahrq.gov/health-literacy/improve/precautions/tool11.html>
- Deque automated coverage study (2021): <https://www.deque.com/automated-accessibility-coverage-report/>
- ONC Data Brief 77 (portals and apps, 2024): <https://healthit.gov/data/data-briefs/individuals-access-and-use-patient-portals-and-smartphone-health-apps-2024/>
- Chrome Reading mode help: <https://support.google.com/chrome/answer/14218344>
