// shared/glossary.js — plain-language definitions for words patients meet on portals.
// General information, not medical advice. Keep each definition to one or two short
// sentences, and have someone with clinical or billing knowledge review changes.
// learnMore points lab terms at MedlinePlus (U.S. National Library of Medicine) pages,
// opened only when the user chooses, instead of writing our own medical content.

export const GLOSSARY = [
  // Insurance and billing
  { term: 'deductible', aliases: ['deductibles', 'annual deductible'], definition: 'The amount you pay for covered care each year before your insurance starts to pay.' },
  { term: 'copay', aliases: ['co-pay', 'copays', 'copayment', 'co-payment'], definition: 'A set amount you pay for a visit or a medicine, like $30.' },
  { term: 'coinsurance', aliases: ['co-insurance'], definition: 'Your share of a bill after you meet your deductible, as a percent. For example, you pay 20% and your plan pays 80%.' },
  { term: 'out-of-pocket maximum', aliases: ['out-of-pocket max', 'out-of-pocket limit', 'out of pocket maximum'], definition: 'The most you pay for covered care in one year. After you reach it, your plan pays for covered care.' },
  { term: 'premium', aliases: ['premiums'], definition: 'The amount you pay to have your health plan, usually every month.' },
  { term: 'in-network', aliases: ['in network'], definition: 'Doctors, clinics and hospitals that have a deal with your plan. They usually cost you less.' },
  { term: 'out-of-network', aliases: ['out of network'], definition: 'Doctors, clinics and hospitals that do not have a deal with your plan. They usually cost you more.' },
  { term: 'prior authorization', aliases: ['prior authorizations', 'pre-authorization', 'preauthorization', 'prior auth'], definition: 'Approval your plan must give before it will pay for some care or medicines.' },
  { term: 'referral', aliases: ['referrals'], definition: 'A note from your doctor that sends you to a specialist. Some plans need one before they will pay.' },
  { term: 'balance billing', aliases: [], definition: 'When a provider bills you for the difference between their price and what your plan paid.' },
  { term: 'explanation of benefits', aliases: ['EOB'], definition: 'A statement from your plan that shows what it paid for your care. It is not a bill.' },
  { term: 'claim', aliases: ['claims'], definition: 'A request to your plan to pay for care you got.' },
  { term: 'covered services', aliases: ['covered service', 'covered care'], definition: 'Care your plan agrees to help pay for.' },
  { term: 'formulary', aliases: ['drug list'], definition: 'The list of medicines your plan helps pay for.' },
  { term: 'generic', aliases: ['generic drug', 'generic medicine'], definition: 'A medicine that works the same as a brand-name medicine but usually costs less.' },
  { term: 'specialty pharmaceuticals', aliases: ['specialty drugs', 'specialty medicines', 'specialty medication'], definition: 'Medicines for complex conditions. They often cost a lot and may need approval first.' },
  { term: 'advanced imaging', aliases: [], definition: 'Detailed scans of the inside of your body, such as MRI, CT and PET scans.' },
  { term: 'HSA', aliases: ['health savings account'], definition: 'Health savings account: money you set aside before taxes to pay for health care.' },
  { term: 'FSA', aliases: ['flexible spending account'], definition: 'Flexible spending account: money from your paycheck, set aside before taxes, for health costs.' },
  { term: 'patient responsibility', aliases: ['patient balance', 'balance due', 'amount due'], definition: 'The part of the bill you need to pay.' },

  // Visits and scheduling
  { term: 'telehealth', aliases: ['telemedicine', 'video visit', 'virtual visit'], definition: 'A visit with your care team by video or phone instead of in person.' },
  { term: 'primary care provider', aliases: ['PCP', 'primary care physician', 'primary care doctor'], definition: 'Your main doctor or nurse for checkups and everyday health needs.' },
  { term: 'specialist', aliases: ['specialists'], definition: 'A doctor who focuses on one area of health, like the heart or the skin.' },
  { term: 'urgent care', aliases: [], definition: 'A walk-in clinic for problems that need care today but are not emergencies.' },
  { term: 'follow-up', aliases: ['follow-up visit', 'follow up'], definition: 'A visit to check on a problem or treatment you already had.' },
  { term: 'intake form', aliases: ['intake forms', 'intake'], definition: 'Questions the clinic asks before your visit, about your health and how to reach you.' },
  { term: 'refill', aliases: ['refills', 'prescription refill'], definition: 'Getting more of a medicine you already take.' },
  { term: 'dosage', aliases: ['dose', 'doses'], definition: 'How much of a medicine to take, and how often.' },

  // Lab tests and results
  { term: 'reference range', aliases: ['normal range', 'usual range'], definition: 'The results that are usual for most healthy people. A result outside it is not always a problem. Ask your care team what yours means.' , learnMore: 'https://medlineplus.gov/lab-tests/how-to-understand-your-lab-results/' },
  { term: 'fasting', aliases: [], definition: 'Not eating or drinking anything except water for a set time before a test, often 8 to 12 hours.' },
  { term: 'glucose', aliases: ['blood sugar', 'blood glucose'], definition: 'Sugar in your blood. Your body uses it for energy.' , learnMore: 'https://medlineplus.gov/lab-tests/blood-glucose-test/' },
  { term: 'hemoglobin A1c', aliases: ['A1c', 'HbA1c'], definition: 'A blood test that shows your average blood sugar over the past 2 to 3 months.' , learnMore: 'https://medlineplus.gov/lab-tests/hemoglobin-a1c-hba1c-test/' },
  { term: 'LDL cholesterol', aliases: ['LDL'], definition: 'A type of cholesterol often called "bad" cholesterol. High levels can raise the risk of heart disease.' , learnMore: 'https://medlineplus.gov/ldlthebadcholesterol.html' },
  { term: 'HDL cholesterol', aliases: ['HDL'], definition: 'A type of cholesterol often called "good" cholesterol.' , learnMore: 'https://medlineplus.gov/hdlthegoodcholesterol.html' },
  { term: 'potassium', aliases: [], definition: 'A mineral that helps your nerves and muscles, including your heart, work well.' , learnMore: 'https://medlineplus.gov/lab-tests/potassium-blood-test/' },
  { term: 'TSH', aliases: ['thyroid stimulating hormone', 'thyroid-stimulating hormone'], definition: 'Thyroid-stimulating hormone. This test checks how well your thyroid gland is working.' , learnMore: 'https://medlineplus.gov/lab-tests/tsh-thyroid-stimulating-hormone-test/' },
  { term: 'CBC', aliases: ['complete blood count'], definition: 'Complete blood count: a common test that counts the different kinds of cells in your blood.' , learnMore: 'https://medlineplus.gov/lab-tests/complete-blood-count-cbc/' },
  { term: 'mg/dL', aliases: [], definition: 'Milligrams per deciliter: how much of something is in a set amount of blood.' },
  { term: 'mmol/L', aliases: [], definition: 'Millimoles per liter: another way to measure how much of something is in your blood.' },
  { term: 'mIU/L', aliases: [], definition: 'Milli-international units per liter: a unit used for some hormone tests.' },
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Every spelling -> its entry. Lower-case keys; short all-caps terms like "PCP" match any case.
const LOOKUP = new Map();
for (const entry of GLOSSARY) {
  for (const form of [entry.term, ...entry.aliases]) LOOKUP.set(form.toLowerCase(), entry);
}

// Longest forms first so "LDL cholesterol" wins over "LDL". Lookarounds instead of \b
// because terms like "mg/dL" contain punctuation.
const PATTERN = new RegExp(
  `(?<![\\w-])(${[...LOOKUP.keys()].sort((a, b) => b.length - a.length).map(escapeRe).join('|')})(?![\\w-])`,
  'gi'
);

export function lookupTerm(text) {
  return LOOKUP.get(text.toLowerCase()) ?? null;
}

// Split text into plain strings and { term, entry } matches, in order.
export function splitTerms(text) {
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(PATTERN)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push({ term: match[0], entry: LOOKUP.get(match[0].toLowerCase()) });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
