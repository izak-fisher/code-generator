const { describe, it, expect } = require('bun:test');
const { generateCode } = require('./codeGenerator');

const segments = [
  {
    name: 'purpose',
    type: 'single',
    fieldApiName: 'field-e4dae9',
    delimiter: '-',
    extractIndex: 0,
  },
  {
    name: 'project',
    type: 'single',
    fieldApiName: 'field-31fb02',
    delimiter: '-',
    extractIndex: 0,
  },
  {
    name: 'productCategory',
    type: 'composite',
    entries: [
      { codeFieldApiName: 'field-4ccb17', percentFieldApiName: 'field-d50954' },
      { codeFieldApiName: 'field-9fa8e9', percentFieldApiName: 'field-b80b1d' },
      { codeFieldApiName: 'field-177ac0', percentFieldApiName: 'field-9838bd' },
      { codeFieldApiName: 'field-e9abc0', percentFieldApiName: 'field-fe1801' },
    ],
    delimiter: '-',
    extractIndex: 0,
  },
  {
    name: 'mediaType',
    type: 'composite',
    entries: [
      { fixedCode: 'NPD', percentFieldApiName: 'field-6cdbcf' },
      { fixedCode: 'PD', percentFieldApiName: 'field-e35aa5' },
      { fixedCode: 'NPND', percentFieldApiName: 'field-3b5990' },
      { fixedCode: 'PND', percentFieldApiName: 'field-29a837' },
    ],
    delimiter: '-',
    extractIndex: 0,
  },
];

describe('generateCode', () => {
  it('produces the expected code from sample parameters', () => {
    const fieldValues = {
      'field-e4dae9': 'CC-Content creation',
      'field-31fb02': '750-Advertising',
      'field-4ccb17': 'UP-Upright Piano',
      'field-d50954': '25',
      'field-9fa8e9': 'SY-SY&DE',
      'field-b80b1d': '25',
      'field-177ac0': 'GP-Grand Piano',
      'field-9838bd': '50',
      'field-e9abc0': null,
      'field-fe1801': null,
      'field-6cdbcf': '75',
      'field-e35aa5': '25',
      'field-3b5990': null,
      'field-29a837': null,
    };

    const code = generateCode(segments, fieldValues);
    expect(code).toBe('CC-750-UP25SY25GP50-NPD75PD25');
  });

  it('skips composite entries with zero percent', () => {
    const fieldValues = {
      'field-e4dae9': 'CC-Content creation',
      'field-31fb02': '750-Advertising',
      'field-4ccb17': 'GP-Grand Piano',
      'field-d50954': '100',
      'field-9fa8e9': 'UP-Upright Piano',
      'field-b80b1d': '0',
      'field-177ac0': null,
      'field-9838bd': null,
      'field-e9abc0': null,
      'field-fe1801': null,
      'field-6cdbcf': '100',
      'field-e35aa5': null,
      'field-3b5990': null,
      'field-29a837': null,
    };

    const code = generateCode(segments, fieldValues);
    expect(code).toBe('CC-750-GP100-NPD100');
  });

  it('includes all four product categories when provided', () => {
    const fieldValues = {
      'field-e4dae9': 'SH-Show',
      'field-31fb02': '868-Sponsorships',
      'field-4ccb17': 'UP-Upright Piano',
      'field-d50954': '25',
      'field-9fa8e9': 'GP-Grand Piano',
      'field-b80b1d': '25',
      'field-177ac0': 'DP-Digital Piano',
      'field-9838bd': '25',
      'field-e9abc0': 'AG-Acoustic Guitar',
      'field-fe1801': '25',
      'field-6cdbcf': '50',
      'field-e35aa5': '50',
      'field-3b5990': null,
      'field-29a837': null,
    };

    const code = generateCode(segments, fieldValues);
    expect(code).toBe('SH-868-UP25GP25DP25AG25-NPD50PD50');
  });

  it('includes all four media types when provided', () => {
    const fieldValues = {
      'field-e4dae9': 'AD-Ad',
      'field-31fb02': '750-Advertising',
      'field-4ccb17': 'HA-Home Audio',
      'field-d50954': '100',
      'field-9fa8e9': null,
      'field-b80b1d': null,
      'field-177ac0': null,
      'field-9838bd': null,
      'field-e9abc0': null,
      'field-fe1801': null,
      'field-6cdbcf': '25',
      'field-e35aa5': '25',
      'field-3b5990': '25',
      'field-29a837': '25',
    };

    const code = generateCode(segments, fieldValues);
    expect(code).toBe('AD-750-HA100-NPD25PD25NPND25PND25');
  });

  it('throws when a required segment has no data', () => {
    expect(() => generateCode(segments, {})).toThrow(/produced no value/);
  });
});
