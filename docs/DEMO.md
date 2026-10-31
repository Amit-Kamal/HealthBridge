# Demo runbook

The live demo is about 60 seconds inside a 3-minute pitch. It shows both halves of the win condition on the same portal: the site gets an F, and the patient books the visit anyway. Rehearse it with a timer at least three times. Record a backup video once it runs cleanly.

## Before judging (15 minutes before)

- [ ] Chrome is up to date. Chrome 157 is due to reach stable on 3 November 2026, so re-run the demo after any update.
- [ ] `npm run demo` is running and <http://localhost:8000/broken/> loads.
- [ ] The extension is loaded from the `extension/` folder at `chrome://extensions`, with no errors shown.
- [ ] HealthBridge is pinned to the toolbar (puzzle icon, then pin) so judges can see the button.
- [ ] Display tab: press **Turn all page settings off**. Page size is 100%.
- [ ] Fill in a form: no saved answers. If "You have answers saved" appears, press **Delete them**.
- [ ] Read aloud: press **Read aloud** once on the fixed portal and check that a local voice speaks with word highlighting. Windows and macOS voices usually work. If none does, skip read aloud rather than allowing online voices on stage.
- [ ] Two tabs ready: `/broken/` (front) and `/fixed/`.
- [ ] Projector zoom: browser at 125% or more so the panel is readable from the back. Check that the panel still fits.
- [ ] Backup video on the laptop desktop, not only in the cloud.
- [ ] Wi-Fi off, or at least not needed: nothing in the demo uses the network.

## The 60 seconds

| Time | Do | Say |
|---|---|---|
| 0:00 | On the broken portal, press **Tab** a few times. No focus outline appears. | "This is a patient portal. If you use a keyboard, you can't see where you are." |
| 0:06 | Press **Alt+Shift+H** (or the toolbar button). The panel opens. Choose **Check this site**, then **Check this page**. | "HealthBridge only works on a page when the patient asks it to." |
| 0:12 | Show the report card: **Grade F**, "3 problems can stop people finishing a task", "These are the site's problems, not yours." | "Automated checks give this portal an F. And we tell the patient the truth: it's the site, not them." |
| 0:20 | Scroll to **More problems HealthBridge found**. On "You can't see where you are when using the keyboard", press **Turn on a strong focus outline**. Press Tab on the page again. | "Automated tools can't see this one. HealthBridge can, and it fixes it for this patient right now." |
| 0:30 | **Read this page**, then **Make this page easy to read**. Show a lab card ("The portal marked this result High"), then open **deductible**. | "The lab grid becomes cards that say what the portal says, without guessing at medical meaning. Insurance words are explained in place." |
| 0:40 | Press **Fill it in one question at a time**. Show "The site didn't name this question. HealthBridge thinks it asks for: Full legal name". Type a name, press **Enter**. Type the date of birth, Enter. Phone, Enter. Then press Enter through the rest (in the notes box, **Ctrl+Enter**). | "One question at a time, keyboard only. When the site gave no label, we say we're guessing." |
| 0:52 | **Check my answers**, then **Send the form**. "The form was sent. The site says: Visit requested… Confirmation SYN-1042." | "The visit is booked on a portal that failed." |
| 0:57 | Switch to the fixed tab, **Check this page**: **Grade A**. | "Same checker, fixed page: an A. The grade is fair, and the report tells the clinic exactly what to fix." |

If you have extra seconds, end on **Write a message to the clinic**: the editable message, the "What would help you" options, and who to send it to.

## If something goes wrong

| Problem | Fix |
|---|---|
| The panel doesn't open | Press the toolbar button again. Keyboard shortcuts can be taken by other apps; check `chrome://extensions/shortcuts`. |
| "HealthBridge needs your OK to read this page" | Press the HealthBridge button again on that tab (it grants access to the page). |
| Check is slow | The first check loads axe (about 650 KB) into the page and takes a second. Press once and wait. |
| A setting doesn't seem to apply | Reload the portal. Settings are re-applied on load. |
| No voice | Skip read aloud. Say "it reads aloud with word highlighting on computers with a local voice". |
| Anything else | Play the backup video, and keep talking over it. |

## After the demo, reset

Display: **Turn all page settings off**. Reload both portals. Fill in a form: **Delete them** if saved answers are shown.
