import { describe, it, expect } from 'vitest';
import {
  escapeCsvField,
  buildElectionResultsCsv,
  prepareElectionResultsCsvContent,
} from '../electionResultsCsv';

describe('escapeCsvField', () => {
  it('quotes plain text', () => {
    expect(escapeCsvField('Alice')).toBe('"Alice"');
  });

  it('escapes embedded double quotes', () => {
    expect(escapeCsvField('Say "hello"')).toBe('"Say ""hello"""');
  });

  it('handles commas without breaking structure', () => {
    expect(escapeCsvField('Smith, John')).toBe('"Smith, John"');
  });

  it('handles newlines inside candidate names', () => {
    expect(escapeCsvField('Line1\nLine2')).toBe('"Line1\nLine2"');
  });

  it('handles very long candidate names', () => {
    const longName = 'A'.repeat(5000);
    expect(escapeCsvField(longName)).toBe(`"${longName}"`);
  });

  it('handles null and undefined', () => {
    expect(escapeCsvField(null)).toBe('""');
    expect(escapeCsvField(undefined)).toBe('""');
  });
});

describe('buildElectionResultsCsv', () => {
  const baseArgs = {
    electionData: {
      electionTitle: 'Student Council, 2026 — "Leadership" Edition',
      electionChoices: [
        {
          optionTitle: 'Dr. Maria O\'Connor, Ph.D.',
          optionDescription: 'Focus on "transparency" and growth.',
          partyName: 'Progressive Alliance, Inc.',
          candidatePic: 'https://example.com/maria.jpg',
        },
        {
          optionTitle: 'Candidate B',
          optionDescription: '',
          partyName: '',
          candidatePic: '',
        },
      ],
    },
    ranked: [
      { name: 'Dr. Maria O\'Connor, Ph.D.', votes: 500, percentage: 55.6, rank: 1 },
      { name: 'Candidate B', votes: 400, percentage: 44.4, rank: 2 },
    ],
    winnerCount: 1,
  };

  it('starts with UTF-8 BOM for Excel', () => {
    const csv = buildElectionResultsCsv(baseArgs);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('includes only the standings header and rows', () => {
    const csv = buildElectionResultsCsv(baseArgs);
    expect(csv).toContain('"Rank","Position","Candidate Name","Description","Party","Candidate Photo URL","Votes","Vote Share (%)","Status"');
    expect(csv).not.toContain('"Report Metadata"');
    expect(csv).not.toContain('"Election Summary"');
    expect(csv).not.toContain('AmarVote Official Election Results');
  });

  it('preserves long and special-character candidate names', () => {
    const csv = buildElectionResultsCsv(baseArgs);
    expect(csv).toContain('"Dr. Maria O\'Connor, Ph.D."');
    expect(csv).toContain('"Focus on ""transparency"" and growth."');
    expect(csv).toContain('"Progressive Alliance, Inc."');
    expect(csv).toContain('"https://example.com/maria.jpg"');
  });

  it('marks winners in the standings', () => {
    const csv = buildElectionResultsCsv(baseArgs);
    expect(csv).toContain('"Winner"');
  });

  it('prepare helper returns filename and content', () => {
    const { content, filename } = prepareElectionResultsCsvContent({
      electionData: baseArgs.electionData,
      electionId: 42,
      processedResults: {
        chartData: [
          { name: 'Dr. Maria O\'Connor, Ph.D.', votes: 500, percentage: 55.6 },
          { name: 'Candidate B', votes: 400, percentage: 44.4 },
        ],
      },
      winnerCount: 1,
    });
    expect(filename).toBe('election-results-Student_Council_2026_Leadership_Edition-42.csv');
    expect(content.charCodeAt(0)).toBe(0xfeff);
    expect(content).toContain('"Candidate Name"');
  });
});
