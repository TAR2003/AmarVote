import { describe, expect, it } from 'vitest';
import {
  buildElectionResult,
  chooseVerdictMode,
  deriveLayoutParams,
  getDonutSliceColors,
  getDonutSliceColorsByWinnerPriority,
  groupByRank,
  parseDescription,
  truncate,
  violetRamp,
} from '../certifiedLedger';
import { VIOLET_FAINT, tokens } from '../certifiedLedger/tokens';

describe('truncate', () => {
  it('leaves short strings alone', () => {
    expect(truncate('Ada', 10)).toBe('Ada');
  });

  it('truncates with ellipsis', () => {
    expect(truncate('A Very Long Candidate Name', 10).endsWith('…')).toBe(true);
    expect(truncate('A Very Long Candidate Name', 10).length).toBeLessThanOrEqual(10);
  });
});

describe('parseDescription', () => {
  it('uses single paragraph as platform quote', () => {
    expect(parseDescription('One line manifesto')).toEqual({
      platform: 'One line manifesto',
      priorities: '',
      slogan: '',
      policies: [],
    });
  });

  it('splits quote, priorities, and short slogan', () => {
    const parsed = parseDescription('Pull quote\nPolicy body here.\nShort slogan');
    expect(parsed.platform).toBe('Pull quote');
    expect(parsed.priorities).toBe('Policy body here.');
    expect(parsed.slogan).toBe('Short slogan');
    expect(parsed.policies[0]).toEqual({ label: 'Platform', text: 'Policy body here.' });
  });
});

describe('chooseVerdictMode / deriveLayoutParams', () => {
  it('stays hero for few short-named winners', () => {
    expect(chooseVerdictMode([{ name: 'Ada' }, { name: 'Bob' }])).toBe('hero');
  });

  it('switches to compact for long names among multiple winners', () => {
    const long = 'x'.repeat(40);
    expect(chooseVerdictMode([{ name: long }, { name: 'Bob' }])).toBe('compact');
  });

  it('switches to compact when more than 3 winners', () => {
    const many = [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }];
    expect(chooseVerdictMode(many)).toBe('compact');
  });

  it('computes maxLabelChars that shrinks with candidate count', () => {
    const few = {
      candidates: [
        { name: 'Ada', votes: 5, sharePct: 50, rank: 1, isWinner: true },
        { name: 'Bob', votes: 5, sharePct: 50, rank: 1, isWinner: true },
      ],
      guardians: [],
    };
    const many = {
      candidates: Array.from({ length: 10 }, (_, i) => ({
        name: `C${i}`,
        votes: 1,
        sharePct: 10,
        rank: i + 1,
        isWinner: i === 0,
      })),
      guardians: [],
    };
    expect(deriveLayoutParams(few).maxLabelChars).toBeGreaterThan(
      deriveLayoutParams(many).maxLabelChars,
    );
  });

  it('balances donut legend into 2 columns past 6 candidates', () => {
    const result = {
      candidates: Array.from({ length: 7 }, (_, i) => ({
        name: `C${i}`,
        votes: 1,
        sharePct: 10,
        rank: i + 1,
        isWinner: false,
      })),
      guardians: [],
    };
    const layout = deriveLayoutParams(result);
    expect(layout.legendColumns).toBe(2);
    expect(layout.legendCols).toHaveLength(2);
    expect(Math.abs(layout.legendCols[0].length - layout.legendCols[1].length)).toBeLessThanOrEqual(1);
  });

  it('splits guardians to 2 columns past 8', () => {
    const result = {
      candidates: [{ name: 'Ada', votes: 1, sharePct: 100, rank: 1, isWinner: true }],
      guardians: Array.from({ length: 12 }, (_, i) => ({
        email: `g${i}@x.com`,
        sequence: i + 1,
      })),
    };
    const layout = deriveLayoutParams(result);
    expect(layout.guardianColumns).toBe(2);
    expect(layout.guardianWrap).toBe(false);
  });

  it('allows config wrap past 24 guardians', () => {
    const result = {
      candidates: [{ name: 'Ada', votes: 1, sharePct: 100, rank: 1, isWinner: true }],
      guardians: Array.from({ length: 25 }, (_, i) => ({
        email: `g${i}@x.com`,
        sequence: i + 1,
      })),
    };
    expect(deriveLayoutParams(result).guardianWrap).toBe(true);
  });
});

describe('groupByRank', () => {
  it('groups tied candidates under one rank bracket', () => {
    const groups = groupByRank([
      { name: 'A', rank: 1, votes: 5 },
      { name: 'B', rank: 1, votes: 5 },
      { name: 'C', rank: 3, votes: 1 },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].isTied).toBe(true);
    expect(groups[0].members).toHaveLength(2);
    expect(groups[1].isTied).toBe(false);
  });
});

describe('donut color ramp', () => {
  it('interpolates unique tones from violet to faint lavender', () => {
    const colors = getDonutSliceColors(5);
    expect(colors).toHaveLength(5);
    expect(new Set(colors).size).toBe(5);
    expect(colors[0].toUpperCase()).toBe(tokens.violet.toUpperCase());
    expect(colors[4].toUpperCase()).toBe(VIOLET_FAINT.toUpperCase());
  });

  it('gives winners the strongest tones regardless of rank order', () => {
    const candidates = [
      { name: 'Low', votes: 1, isWinner: false },
      { name: 'Win', votes: 10, isWinner: true },
      { name: 'Mid', votes: 5, isWinner: false },
    ];
    const colors = getDonutSliceColorsByWinnerPriority(candidates);
    expect(colors[1].toUpperCase()).toBe(tokens.violet.toUpperCase());
    expect(new Set(colors).size).toBe(3);
  });

  it('keeps violetRamp as an alias of getDonutSliceColors', () => {
    expect(violetRamp(3)).toEqual(getDonutSliceColors(3));
  });

  it('shares the same colors array between chart layout and legend', () => {
    const result = {
      candidates: [
        { name: 'A', votes: 3, sharePct: 30, rank: 2, isWinner: false },
        { name: 'B', votes: 7, sharePct: 70, rank: 1, isWinner: true },
      ],
      guardians: [],
    };
    const layout = deriveLayoutParams(result);
    expect(layout.colors).toHaveLength(2);
    expect(layout.legendCols[0][0].color).toBe(layout.colors[0]);
    expect(layout.legendCols[0][1].color).toBe(layout.colors[1]);
    expect(layout.colors[1].toUpperCase()).toBe(tokens.violet.toUpperCase());
  });
});

describe('buildElectionResult', () => {
  it('maps election + ranked candidates with winners and share', () => {
    const result = buildElectionResult({
      electionData: {
        electionTitle: 'Test Election',
        electionDescription: 'Desc',
        maxChoices: 1,
        numberOfGuardians: 3,
        quorum: 2,
        adminEmail: 'a@b.c',
        electionChoices: [
          { optionTitle: 'Ada', optionDescription: 'Quote\nPolicy', partyName: 'Indep' },
          { optionTitle: 'Bob', optionDescription: '', partyName: '1' },
        ],
        guardians: [
          { sequenceOrder: 1, userEmail: 'g1@x.com' },
          { sequenceOrder: 2, userEmail: 'g2@x.com' },
        ],
      },
      electionId: 42,
      processedResults: { totalVotedUsers: 10 },
      ranked: [
        { name: 'Ada', votes: 7, percentage: 70 },
        { name: 'Bob', votes: 3, percentage: 30 },
      ],
      winnerCount: 1,
      formatGeneratedAt: 'now',
      formatStartTime: 'start',
      formatEndTime: 'end',
      statusLabel: 'Completed',
    });

    expect(result.electionId).toBe('42');
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0].isWinner).toBe(true);
    expect(result.candidates[0].party).toBe('Indep');
    expect(result.candidates[0].platform).toBe('Quote');
    expect(result.candidates[1].party).toBe('');
    expect(result.guardians).toHaveLength(2);
    expect(result.ballotsCast).toBe(10);
  });
});
