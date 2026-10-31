// shared/ruleHelp.js — what each problem means for a patient, and what HealthBridge
// can do about it right now. Written at about a 6th-grade reading level.
//
// action: a HealthBridge tool that works around the problem for this user:
//   'contrast' | 'spacing' | 'focus' | 'targets' | 'motion' | 'zoom'  -> Display settings
//   'helper'  -> Form helper     'actions' -> Easy read "Buttons and links"     'reader' -> Easy read
// who: groups most affected, shown as short tags.

export const WHO = {
  sr: 'Screen reader users',
  lowVision: 'Low vision',
  keyboard: 'Keyboard users',
  voice: 'Voice control users',
  motor: 'Shaky or limited hand movement',
  cognitive: 'Memory, focus or reading difficulties',
  deaf: 'Deaf or hard of hearing',
};

export const RULE_HELP = {
  // Names and labels
  label: { title: 'Some boxes in a form have no name', forYou: 'A screen reader can’t tell you what to type. The Form helper shows each question with our best guess at its name.', who: ['sr', 'voice', 'cognitive'], action: 'helper' },
  'select-name': { title: 'Some drop-down lists have no name', forYou: 'You may not know what a list is asking. The Form helper shows our best guess.', who: ['sr', 'voice'], action: 'helper' },
  'aria-input-field-name': { title: 'Some custom form boxes have no name', forYou: 'A screen reader can’t tell you what these boxes are for.', who: ['sr', 'voice'], action: 'helper' },
  'aria-toggle-field-name': { title: 'Some on/off switches have no name', forYou: 'You may not know what a switch turns on or off.', who: ['sr', 'voice'], action: 'helper' },
  'button-name': { title: 'Some buttons have no name', forYou: 'A screen reader may only say “button”, and voice control can’t find it. HealthBridge can press it for you.', who: ['sr', 'voice'], action: 'actions' },
  'input-button-name': { title: 'Some buttons have no name', forYou: 'A screen reader may only say “button”. HealthBridge can press it for you.', who: ['sr', 'voice'], action: 'actions' },
  'aria-command-name': { title: 'Some buttons or menu items have no name', forYou: 'A screen reader can’t tell you what they do.', who: ['sr', 'voice'], action: 'actions' },
  'link-name': { title: 'Some links have no name', forYou: 'These links don’t say where they go, often because they are only icons. HealthBridge lists them with a guessed name.', who: ['sr', 'voice'], action: 'actions' },
  'image-alt': { title: 'Some pictures have no description', forYou: 'If a picture has important information, a screen reader can’t tell you about it.', who: ['sr'] },
  'input-image-alt': { title: 'Some picture buttons have no name', forYou: 'A screen reader can’t tell you what these buttons do.', who: ['sr', 'voice'], action: 'actions' },
  'role-img-alt': { title: 'Some images have no description', forYou: 'A screen reader can’t tell you what these images show.', who: ['sr'] },
  'svg-img-alt': { title: 'Some icons have no description', forYou: 'A screen reader can’t tell you what these icons mean.', who: ['sr'] },
  'frame-title': { title: 'Some embedded boxes have no name', forYou: 'Parts of the page, like a payment box, don’t say what they are.', who: ['sr'] },
  'label-content-name-mismatch': { title: 'Some button names don’t match what you see', forYou: 'Saying the visible words with voice control may not work.', who: ['voice'] },

  // Seeing and reading
  'color-contrast': { title: 'Some text is hard to see', forYou: 'The text color is too close to the background color. Turn on high contrast to fix it for you.', who: ['lowVision'], action: 'contrast' },
  'link-in-text-block': { title: 'Some links look like normal text', forYou: 'Links are shown only by color, so they are easy to miss.', who: ['lowVision'], action: 'contrast' },
  'meta-viewport': { title: 'The page blocks zooming on phones', forYou: 'On a phone or tablet you can’t pinch to make things bigger. On a computer, use the page size buttons.', who: ['lowVision'], action: 'zoom' },
  'html-has-lang': { title: 'The page doesn’t say its language', forYou: 'Screen readers and read-aloud may say words wrongly.', who: ['sr', 'cognitive'], action: 'reader' },
  'html-lang-valid': { title: 'The page’s language setting is wrong', forYou: 'Screen readers and read-aloud may say words wrongly.', who: ['sr'], action: 'reader' },
  'valid-lang': { title: 'Some text has a wrong language setting', forYou: 'Parts of the page may be read in the wrong accent.', who: ['sr'] },
  'document-title': { title: 'The page has no title', forYou: 'It is harder to tell this tab apart from others, and a screen reader can’t say where you are.', who: ['sr', 'cognitive'] },
  'video-caption': { title: 'Some videos have no captions', forYou: 'You can’t follow what is said without sound.', who: ['deaf'] },
  blink: { title: 'Some text blinks', forYou: 'Blinking text is hard to read and can be distracting.', who: ['cognitive', 'lowVision'], action: 'motion' },
  marquee: { title: 'Some text scrolls on its own', forYou: 'Moving text is hard to read and can be distracting.', who: ['cognitive', 'lowVision'], action: 'motion' },

  // Using the page
  'target-size': { title: 'Some buttons or links are tiny and close together', forYou: 'They are easy to miss or press by mistake. Turn on bigger buttons, or press them from HealthBridge.', who: ['motor'], action: 'targets' },
  'scrollable-region-focusable': { title: 'Some scrolling areas can’t be reached with the keyboard', forYou: 'You may not be able to read everything in a scrolling box without a mouse.', who: ['keyboard'] },
  'nested-interactive': { title: 'Some controls are inside other controls', forYou: 'A screen reader may skip the inner control, so you can’t use it.', who: ['sr', 'keyboard'] },
  'aria-hidden-focus': { title: 'Some controls are hidden from screen readers', forYou: 'You may Tab onto something a screen reader doesn’t describe.', who: ['sr', 'keyboard'] },
  'meta-refresh': { title: 'The page reloads or moves on by itself', forYou: 'It may change before you finish reading or typing.', who: ['cognitive', 'sr'] },
  'autocomplete-valid': { title: 'Autofill may not work', forYou: 'Some boxes for your details are marked wrongly, so the browser may not fill them in for you.', who: ['motor', 'cognitive'], action: 'helper' },
  'frame-focusable-content': { title: 'Some embedded boxes can’t be reached with the keyboard', forYou: 'You may not be able to use parts of the page without a mouse.', who: ['keyboard'] },

  // Structure the site's code gets wrong
  'aria-required-attr': { title: 'Some controls are missing information', forYou: 'A screen reader may not tell you a control’s state, like whether it is checked.', who: ['sr'] },
  'aria-required-children': { title: 'Some lists or menus are built wrongly', forYou: 'A screen reader may not read their items correctly.', who: ['sr'] },
  'aria-required-parent': { title: 'Some list or menu items are built wrongly', forYou: 'A screen reader may not read them correctly.', who: ['sr'] },
  'aria-valid-attr-value': { title: 'Some controls give screen readers wrong information', forYou: 'A screen reader may tell you the wrong thing about them.', who: ['sr'] },
  'aria-allowed-attr': { title: 'Some controls give screen readers wrong information', forYou: 'A screen reader may tell you the wrong thing about them.', who: ['sr'] },
  'aria-roles': { title: 'Some parts of the page are labelled with the wrong type', forYou: 'A screen reader may describe them wrongly.', who: ['sr'] },
  list: { title: 'Some lists are built wrongly', forYou: 'A screen reader may not say how many items a list has.', who: ['sr'] },
  listitem: { title: 'Some list items are built wrongly', forYou: 'A screen reader may not read them as a list.', who: ['sr'] },
  'td-headers-attr': { title: 'Some tables are built wrongly', forYou: 'A screen reader may read the wrong column names. Easy read shows each row as a card.', who: ['sr'], action: 'reader' },
  'th-has-data-cells': { title: 'Some table headings don’t match their data', forYou: 'A screen reader may read tables confusingly. Easy read shows each row as a card.', who: ['sr'], action: 'reader' },
  'duplicate-id-aria': { title: 'Some names on the page point to the wrong place', forYou: 'A screen reader may read the wrong label for a control.', who: ['sr'] },
};

// Fallback for rules without a plain-language entry: axe's own text, clearly marked.
export function helpFor(result) {
  return RULE_HELP[result.id] ?? { title: result.help, forYou: 'This is a technical problem with how the page is built.', who: [], fallback: true };
}
