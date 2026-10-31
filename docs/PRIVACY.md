# HealthBridge privacy policy (draft)

*Draft for a hackathon prototype. Have it reviewed before publishing in the Chrome Web Store.*

HealthBridge is a browser extension that you install and control. It helps you read, fill in and check pages on health websites. It is not a health care provider, a health plan or a service run for one, and it has no servers.

## The short version

- HealthBridge reads a page only after you press its button on that page, or on sites you chose to always allow.
- What it reads stays on your computer. HealthBridge never sends page content, your answers or your settings to us or anyone else. It has no analytics, ads or tracking.
- It never sends a form unless you press **Send the form**.

## What HealthBridge reads

When you use it on a page, HealthBridge reads that page's text, headings, tables, form questions, buttons and links, and runs accessibility checks on the page's code. This happens inside your browser. It reads only the top part of the page, not embedded frames such as payment boxes.

## What HealthBridge keeps, and where

| What | Where | How long |
|---|---|---|
| Your display settings, reading speed, panel text size, the last tab you used, whether you have seen the welcome message, and whether online voices are allowed | `chrome.storage.local` on your computer | Until you change them or remove HealthBridge |
| Answers you typed into the form helper, kept so they can be put back if a site signs you out | `chrome.storage.session`, in memory only | Up to 60 minutes. Deleted when the form is sent successfully, when you delete them, or when Chrome closes |
| Text you chose with the right-click menu | `chrome.storage.session`, in memory only | Until the panel opens, or when the tab or Chrome closes |
| Which display stylesheets are on each tab | `chrome.storage.session`, in memory only | Until the tab or Chrome closes |

Settings are not synced to your Google account.

## When information can leave your computer

Only because of something you choose:

- **Online voices.** Some read-aloud voices (Chrome's "Google" voices) are online services. They send the text being read to Google. HealthBridge uses voices on your computer and doesn't use online voices unless you allow it. You can change this on the Display tab.
- **Links you open.** "Learn more" links open MedlinePlus (U.S. National Library of Medicine), and "How to fix it" links open Deque's rule pages. Opening a link visits that website like any other link.
- **Messages and reports.** "Write a message to the clinic" and "Save the full report" create text on your computer. They include the page address and the problems found, never your answers. You decide whether to send them to anyone.
- **The website itself.** When you press Send, the website receives your form, just as if you had pressed its own button.

The optional "Say it more simply" feature uses Chrome's built-in AI model, which runs on your computer. Google states that no data is sent to Google or any third party when using it.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Lets HealthBridge read the page you are on, only after you press its button, and only until you leave that site |
| `scripting` | Runs HealthBridge's reading, checking and form code on that page, and adds display stylesheets |
| `sidePanel` | Shows HealthBridge beside the page |
| `storage` | Saves the settings and temporary answers listed above |
| `contextMenus` | Adds "Read aloud" and "Explain" to the right-click menu for selected text |
| Optional: access to sites you choose | Only if you press "Always allow on this site". You can remove it on the Display tab |
| `localhost` access (demo build only) | For the demo portal. Remove it in a published build |

## Limited Use

HealthBridge's use of information received from Chrome APIs complies with the Chrome Web Store User Data Policy, including the Limited Use requirements. It uses page content only to provide the features you see, never transfers or sells it, never uses it for advertising, and no person reads it.

## Contact

[Add a contact address before publishing.]
