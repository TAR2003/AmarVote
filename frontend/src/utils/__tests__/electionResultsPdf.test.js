import { describe, expect, it } from 'vitest';
import { candidateInitials, truncateChartLabel } from '../electionResultsPdf';

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
