# Demo portals

Run `npm run demo`, then open <http://localhost:8000/>. All data is synthetic. Never demo on a real patient account.

## Planted failures in `broken/`

| # | Failure | Who it blocks | Caught by |
|---|---|---|---|
| 1 | No `lang` on `<html>` | Screen reader and read-aloud pronunciation | axe `html-has-lang` |
| 2 | Empty `<title>` | Screen reader users switching tabs | axe `document-title` |
| 3 | `user-scalable=no, maximum-scale=1` | Low-vision users on phones | axe `meta-viewport` |
| 4 | Gray text (#999 and lighter) on white | Low vision, older adults, glare | axe `color-contrast` |
| 5 | `*:focus { outline: none }` | Keyboard and switch users can't see where they are | HealthBridge check `focus-hidden` (axe can't test this) |
| 6 | Name field labelled only by placeholder | Everyone once they start typing; memory and attention difficulties | HealthBridge check `placeholder-label` |
| 7 | Date of birth, reason and notes fields with no label | Screen reader and voice-control users | axe `label`, `select-name` |
| 8 | Phone and email without `autocomplete` | Motor and cognitive disabilities (no autofill) | HealthBridge check `autocomplete-missing` (WCAG 1.3.5) |
| 9 | Phone error shown as red text, not linked to the field | Screen reader users never hear it; color-only cue | Form helper's after-submit check |
| 10 | Icon-only submit button and pay link with no name | Screen reader and voice-control users | axe `button-name`, `link-name` |
| 11 | 16 px pay link | Tremor, one-handed use | axe `target-size` (WCAG 2.2) |
| 12 | Section titles are styled `<div>`s, no `<main>` | Screen reader users can't jump between sections | HealthBridge check `no-headings` |
| 13 | Lab table header row uses `<td>`, no caption | Screen reader users lose column names | HealthBridge reader (rebuilds rows as cards) |
| 14 | Billing paragraph at a college reading level | Cognitive and learning disabilities, low health literacy | Reading level on the report card; glossary |
| 15 | Pulsing "new message" badge that never stops | Attention, vestibular and migraine triggers | HealthBridge check `endless-motion` (WCAG 2.2.2) |
| 16 | Session countdown with no way to extend | Anyone who needs more time | HealthBridge check `time-limit` (WCAG 2.2.1) |
| 17 | Statement offered only as a PDF | Screen reader and magnifier users | HealthBridge check `pdf-only` |

Automated tools can't see some of these at all (5, 9, 16). Say so in the pitch: it's why the report card says "automated checks only".

## `fixed/`

The same content with every failure fixed. It should get an A with zero axe violations and no HealthBridge warnings, which shows the grade isn't rigged.

## `react/`

A React 18 form with controlled inputs, used by the end-to-end tests to prove that the form helper updates React state, not just the visible text.

## `slow/`

A test page whose load event comes 1.5 s late (it waits for a slow image from the demo server). The end-to-end tests use it to prove display settings arrive before a slow portal finishes loading.
