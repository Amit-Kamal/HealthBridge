// shared/checkHelp.js — plain-language text for HealthBridge's own checks
// (problems axe-core can't test). Same shape as ruleHelp.js, plus the WCAG criterion.

export const CHECK_HELP = {
  'focus-hidden': {
    title: 'You can’t see where you are when using the keyboard',
    forYou: 'The site hides the outline that shows which button or box is selected. Turn on a strong focus outline to bring it back.',
    who: ['keyboard', 'lowVision', 'motor'],
    criterion: '2.4.7',
    action: 'focus',
  },
  'placeholder-label': {
    title: 'Some boxes only have hint text that disappears',
    forYou: 'The grey hint inside the box goes away when you start typing, so it is easy to forget what the box is for.',
    who: ['cognitive', 'lowVision'],
    criterion: '3.3.2',
    action: 'helper',
  },
  'autocomplete-missing': {
    title: 'The browser can’t fill in your details for you',
    forYou: 'Boxes for things like your name or phone number are not marked, so autofill can’t help and you must type more.',
    who: ['motor', 'cognitive'],
    criterion: '1.3.5',
    action: 'helper',
  },
  'no-headings': {
    title: 'The page has no headings',
    forYou: 'Screen reader users can’t jump between sections. Easy read finds text that looks like headings and lists them.',
    who: ['sr', 'cognitive'],
    criterion: '1.3.1',
    action: 'reader',
  },
  'table-no-headers': {
    title: 'Some tables have no column names',
    forYou: 'A screen reader reads the numbers without saying which column they belong to. Easy read shows each row as a card with the names.',
    who: ['sr', 'cognitive'],
    criterion: '1.3.1',
    action: 'reader',
  },
  'time-limit': {
    title: 'The page may sign you out after a time limit',
    forYou: 'We couldn’t find a way to get more time. The Form helper saves your answers in this browser so you can put them back if you are signed out.',
    who: ['cognitive', 'motor', 'sr'],
    criterion: '2.2.1',
    action: 'helper',
  },
  'endless-motion': {
    title: 'Something on the page keeps moving',
    forYou: 'Moving things can make it hard to focus or read, and can make some people feel unwell. You can stop them.',
    who: ['cognitive', 'lowVision'],
    criterion: '2.2.2',
    action: 'motion',
  },
  'pdf-only': {
    title: 'Some documents are PDF files',
    forYou: 'PDFs are often hard to use with screen readers and zoom. You can ask the clinic for the same information in another format.',
    who: ['sr', 'lowVision'],
    criterion: '1.3.1',
  },
  captcha: {
    title: 'The page has a CAPTCHA puzzle',
    forYou: 'These puzzles block many disabled people. If you get stuck, ask the clinic for another way to sign in or send the form.',
    who: ['sr', 'cognitive', 'lowVision'],
    criterion: '3.3.8',
  },
};

// Things no automated tool can check. Shown as a short "check it yourself" list.
export const MANUAL_CHECKS = [
  { title: 'Can you reach everything with the Tab key?', detail: 'Press Tab to move forward and Shift+Tab to go back. Watch for places you get stuck.', criterion: '2.1.1' },
  { title: 'Do error messages say how to fix the problem?', detail: 'Try sending the form with a box left empty.', criterion: '3.3.1' },
  { title: 'Do videos have captions?', detail: 'Turn the sound off and see if you can follow along.', criterion: '1.2.2' },
  { title: 'Does the page still work at 200% size?', detail: 'Use the page size buttons. Nothing should be cut off.', criterion: '1.4.4' },
];
