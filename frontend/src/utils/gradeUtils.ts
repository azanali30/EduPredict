/**
 * EduPredict - Grading Scale Normalization Utilities (Phase 7B)
 *
 * Requirements:
 * - Percentage (0–100%) as the standardized primary display scale.
 * - For Portuguese secondary benchmark data (raw 0–20 marks: G1, G2, G3),
 *   provide mathematically correct dual notation, e.g. "63.5% (12.7 / 20.0)".
 * - Clearly label scales and thresholds:
 *     - High Risk:   < 50.0%  (< 10.0 / 20.0) - Failing
 *     - Medium Risk: 50.0% – 69.9% (10.0 – 13.9 / 20.0) - Vulnerable
 *     - Low Risk:    ≥ 70.0%  (≥ 14.0 / 20.0) - Good/Passing
 * - Never apply 0–20 conversion to metrics whose original scale is not 0–20.
 */

export interface GradeFormatOptions {
  /** Include Portuguese benchmark equivalent (0–20 scale) */
  showDual?: boolean;
  /** Decimal places (defaults to 1) */
  precision?: number;
  /** Include '%' sign in output string (defaults to true) */
  includePercent?: boolean;
}

/**
 * Format a grade on the 0–100 percentage scale.
 * Example:
 *   formatPercentageGrade(63.5, { showDual: true }) => "63.5% (12.7 / 20.0)"
 *   formatPercentageGrade(63.5) => "63.5%"
 */
export function formatPercentageGrade(
  score: number | null | undefined,
  options: GradeFormatOptions = {}
): string {
  if (score === null || score === undefined || isNaN(score)) {
    return '—';
  }
  const precision = options.precision ?? 1;
  const includePercent = options.includePercent ?? true;
  const clamped = Math.max(0, Math.min(100, score));
  const pctStr = clamped.toFixed(precision) + (includePercent ? '%' : '');

  if (options.showDual) {
    const scale20 = (clamped / 5).toFixed(precision);
    return `${pctStr} (${scale20} / 20.0)`;
  }
  return pctStr;
}

/**
 * Format a raw historical mark originating from the Portuguese 0–20 scale (e.g. G1, G2, G3).
 * Converts to percentage equivalent: raw * 5 = percentage.
 * Example:
 *   formatRaw20Grade(12.7) => "63.5% (12.7 / 20.0)"
 *   formatRaw20Grade(14.0) => "70.0% (14.0 / 20.0)"
 */
export function formatRaw20Grade(
  rawScore: number | null | undefined,
  options: GradeFormatOptions = {}
): string {
  if (rawScore === null || rawScore === undefined || isNaN(rawScore)) {
    return '—';
  }
  const precision = options.precision ?? 1;
  const clampedRaw = Math.max(0, Math.min(20, rawScore));
  const pctEquivalent = clampedRaw * 5;
  const pctStr = pctEquivalent.toFixed(precision) + '%';
  const rawStr = clampedRaw.toFixed(precision);
  return `${pctStr} (${rawStr} / 20.0)`;
}

export type RiskTier = 'High Risk' | 'Medium Risk' | 'Low Risk';

/**
 * Determine risk tier from 0–100 percentage score.
 * Passing threshold: 50.0% (10.0 / 20.0)
 * Low Risk threshold: 70.0% (14.0 / 20.0)
 */
export function getGradeRiskTier(score: number | null | undefined): RiskTier {
  if (score === null || score === undefined || isNaN(score)) return 'High Risk';
  if (score < 50) return 'High Risk';
  if (score < 70) return 'Medium Risk';
  return 'Low Risk';
}

/**
 * Normalized scale labels for consistent UI usage across portals
 */
export const GRADE_SCALE_LABELS = {
  PERCENTAGE_PRIMARY: 'Standardized Percentage (0.0% – 100.0%)',
  PORTUGUESE_DUAL: 'Standardized Percentage (0–100%) with Portuguese Benchmark (0–20)',
  PASSING_BENCHMARK: 'Passing Benchmark: ≥ 50.0% (≥ 10.0 / 20.0)',
  HIGH_RISK_THRESHOLD: '< 50.0% (< 10.0 / 20.0)',
  MEDIUM_RISK_THRESHOLD: '50.0% – 69.9% (10.0 – 13.9 / 20.0)',
  LOW_RISK_THRESHOLD: '≥ 70.0% (≥ 14.0 / 20.0)',
};
