import { describe, it, expect } from 'vitest';
import {
  formatPercentageGrade,
  formatRaw20Grade,
  getGradeRiskTier,
  GRADE_SCALE_LABELS,
} from '../utils/gradeUtils';

describe('Grading Scale Normalization Utilities (Phase 7B)', () => {
  describe('formatPercentageGrade', () => {
    it('formats a 0-100 score with percentage symbol', () => {
      expect(formatPercentageGrade(63.5)).toBe('63.5%');
      expect(formatPercentageGrade(100)).toBe('100.0%');
      expect(formatPercentageGrade(0)).toBe('0.0%');
    });

    it('formats dual notation with Portuguese scale equivalent', () => {
      expect(formatPercentageGrade(63.5, { showDual: true })).toBe('63.5% (12.7 / 20.0)');
      expect(formatPercentageGrade(50.0, { showDual: true })).toBe('50.0% (10.0 / 20.0)');
      expect(formatPercentageGrade(70.0, { showDual: true })).toBe('70.0% (14.0 / 20.0)');
      expect(formatPercentageGrade(100.0, { showDual: true })).toBe('100.0% (20.0 / 20.0)');
    });

    it('clamps out-of-range values', () => {
      expect(formatPercentageGrade(120)).toBe('100.0%');
      expect(formatPercentageGrade(-10)).toBe('0.0%');
    });

    it('handles null, undefined and NaN gracefully', () => {
      expect(formatPercentageGrade(null)).toBe('—');
      expect(formatPercentageGrade(undefined)).toBe('—');
      expect(formatPercentageGrade(NaN)).toBe('—');
    });
  });

  describe('formatRaw20Grade', () => {
    it('formats raw 0-20 marks into percentage and dual notation', () => {
      expect(formatRaw20Grade(12.7)).toBe('63.5% (12.7 / 20.0)');
      expect(formatRaw20Grade(14.0)).toBe('70.0% (14.0 / 20.0)');
      expect(formatRaw20Grade(10.0)).toBe('50.0% (10.0 / 20.0)');
      expect(formatRaw20Grade(20.0)).toBe('100.0% (20.0 / 20.0)');
      expect(formatRaw20Grade(0)).toBe('0.0% (0.0 / 20.0)');
    });

    it('handles missing values gracefully', () => {
      expect(formatRaw20Grade(null)).toBe('—');
      expect(formatRaw20Grade(undefined)).toBe('—');
    });
  });

  describe('getGradeRiskTier', () => {
    it('classifies risk tiers correctly based on percentage benchmarks', () => {
      expect(getGradeRiskTier(49.9)).toBe('High Risk');
      expect(getGradeRiskTier(0)).toBe('High Risk');
      expect(getGradeRiskTier(50.0)).toBe('Medium Risk');
      expect(getGradeRiskTier(69.9)).toBe('Medium Risk');
      expect(getGradeRiskTier(70.0)).toBe('Low Risk');
      expect(getGradeRiskTier(95.0)).toBe('Low Risk');
    });
  });

  describe('GRADE_SCALE_LABELS', () => {
    it('contains consistent scale descriptions', () => {
      expect(GRADE_SCALE_LABELS.PASSING_BENCHMARK).toContain('≥ 50.0%');
      expect(GRADE_SCALE_LABELS.PASSING_BENCHMARK).toContain('≥ 10.0 / 20.0');
    });
  });
});
