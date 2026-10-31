// shared/scoring.js — a simple, published grade for automated checks.
// Show this formula to anyone who asks; a grade nobody can explain is not trustworthy.
//
//   Each failed axe rule costs its impact weight once, plus up to the same again if it
//   repeats on many elements:  weight × (1 + min(log2(elements), 3) / 3).
//   Score = 100 − total cost (never below 0).  A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, else F.
//   Any critical problem ("blocker") caps the grade at C.
//
// Only WCAG 2.1 A/AA problems are graded, because that is the version US health rules
// (HHS Section 504, ADA Title II) cite. WCAG 2.2 findings and HealthBridge's own checks
// are listed separately and never change the grade.

import { principleOf, wcagVersionOf } from './wcag.js';

// { graded: WCAG 2.1 problems, newer: problems only WCAG 2.2 adds }
export function splitByVersion(violations) {
  return {
    graded: violations.filter((v) => wcagVersionOf(v.tags) === '2.1'),
    newer: violations.filter((v) => wcagVersionOf(v.tags) === '2.2'),
  };
}

export const IMPACT_ORDER = ['critical', 'serious', 'moderate', 'minor'];
export const WEIGHTS = { critical: 10, serious: 6, moderate: 3, minor: 1 };

export function ruleCost({ impact, nodeCount }) {
  const weight = WEIGHTS[impact] ?? WEIGHTS.minor;
  const spread = Math.min(Math.log2(Math.max(nodeCount, 1)), 3) / 3;
  return weight * (1 + spread);
}

export function gradeFor(score, blockers) {
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
  return blockers > 0 && (grade === 'A' || grade === 'B') ? 'C' : grade;
}

export function scoreScan(violations) {
  const byImpact = Object.fromEntries(IMPACT_ORDER.map((k) => [k, 0]));
  const byPrinciple = {};
  let cost = 0;
  for (const v of violations) {
    const impact = WEIGHTS[v.impact] ? v.impact : 'minor';
    byImpact[impact] += 1;
    const principle = principleOf(v.tags);
    byPrinciple[principle] = (byPrinciple[principle] ?? 0) + 1;
    cost += ruleCost({ impact, nodeCount: v.nodeCount });
  }
  const score = Math.max(0, Math.round(100 - cost));
  const blockers = byImpact.critical;
  return { score, grade: gradeFor(score, blockers), blockers, byImpact, byPrinciple };
}

export function sortByImpact(results) {
  return [...results].sort(
    (a, b) => IMPACT_ORDER.indexOf(a.impact) - IMPACT_ORDER.indexOf(b.impact) || b.nodeCount - a.nodeCount
  );
}
