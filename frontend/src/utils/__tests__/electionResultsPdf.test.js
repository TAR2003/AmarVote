import { describe, expect, it } from 'vitest';
import {
  candidateInitials,
  truncateChartLabel,
  truncateCandidateDescription,
  generateAxisTicks,
} from '../electionResultsPdf';

describe('candidateInitials', () => {
  it('uses first + last name letters', () => {
    expect(candidateInitials('Ada Lovelace')).toBe('AL');
    expect(candidateInitials('George Washington')).toBe('GW');
  });

  it('strips leading punctuation that used to produce ",G"', () => {
    expect(candidateInitials(', George')).toBe('GE');
    expect(candidateInitials(',George')).toBe('GE');
    expect(candidateInitials('  ,  George  ')).toBe('GE');
  });

  it('handles Last, First ordering', () => {
    expect(candidateInitials('Lovelace, Ada')).toBe('AL');
    expect(candidateInitials('Washington, George')).toBe('GW');
  });

  it('ignores title punctuation like Dr.', () => {
    expect(candidateInitials('Dr. Ada Lovelace')).toBe('DL');
  });

  it('handles single-token names', () => {
    expect(candidateInitials('Cher')).toBe('CH');
    expect(candidateInitials('X')).toBe('X');
  });

  it('returns ? for empty or non-letter input', () => {
    expect(candidateInitials('')).toBe('?');
    expect(candidateInitials('   ')).toBe('?');
    expect(candidateInitials(',,,')).toBe('?');
    expect(candidateInitials(null)).toBe('?');
  });
});

describe('truncateChartLabel', () => {
  it('truncates long labels consistently', () => {
    expect(truncateChartLabel('Short', 16)).toBe('Short');
    expect(truncateChartLabel('A Very Long Candidate Name Here', 12).endsWith('…')).toBe(true);
  });
});

describe('truncateCandidateDescription', () => {
  it('cuts at the first newline and appends ........', () => {
    expect(truncateCandidateDescription('First line\nSecond line with more')).toBe(
      'First line........',
    );
    expect(truncateCandidateDescription('Slogan only\r\nPolicy platform…')).toBe(
      'Slogan only........',
    );
  });

  it('keeps short single-line text as-is', () => {
    expect(truncateCandidateDescription('Short bio')).toBe('Short bio');
  });

  it('truncates long single-line text at 80 chars', () => {
    const long = 'A'.repeat(100);
    expect(truncateCandidateDescription(long)).toBe(`${'A'.repeat(80)}........`);
  });

  it('returns empty for blank input', () => {
    expect(truncateCandidateDescription('')).toBe('');
    expect(truncateCandidateDescription('   ')).toBe('');
    expect(truncateCandidateDescription(null)).toBe('');
  });
});

describe('generateAxisTicks', () => {
  it('never produces duplicate ticks for small integer ranges', () => {
    expect(generateAxisTicks(3)).toEqual([0, 1, 2, 3]);
    expect(generateAxisTicks(2)).toEqual([0, 1, 2]);
    expect(generateAxisTicks(5)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('uses clean human-friendly steps for larger ranges', () => {
    const ticks = generateAxisTicks(17);
    expect(new Set(ticks).size).toBe(ticks.length);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(17);
    ticks.forEach((t) => expect(Number.isInteger(t)).toBe(true));
  });

  it('handles zero', () => {
    expect(generateAxisTicks(0)).toEqual([0]);
  });
});
