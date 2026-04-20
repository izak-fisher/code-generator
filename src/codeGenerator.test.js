const { describe, it, expect } = require('bun:test');
const { generateCode } = require('./codeGenerator');

const segments = [
  {
    name: 'purpose',
    type: 'single',
    fieldName: 'Purpose Code',
    delimiter: '-',
    extractIndex: 0,
  },
  {
    name: 'project',
    type: 'single',
    fieldName: 'Project Code and Name',
    delimiter: '-',
    extractIndex: 0,
  },
  {
    name: 'productCategory',
    type: 'composite',
    entries: [
      { codeFieldName: 'Product Category 1', percentFieldName: 'Product Category 1 %' },
      { codeFieldName: 'Product Category 2', percentFieldName: 'Product Category 2 %' },
      { codeFieldName: 'Product Category 3', percentFieldName: 'Product Category 3 %' },
      { codeFieldName: 'Product Category 4', percentFieldName: 'Product Category 4 %' },
    ],
    delimiter: '-',
    extractIndex: 0,
  },
  {
    name: 'mediaType',
    type: 'composite',
    entries: [
      { fixedCode: 'NPD', percentFieldName: 'Non Production Digital %' },
      { fixedCode: 'PD', percentFieldName: 'Production Digital %' },
      { fixedCode: 'NPND', percentFieldName: 'Non-Production Non-Digital %' },
      { fixedCode: 'PND', percentFieldName: 'Production Non-Digital %' },
    ],
    delimiter: '-',
    extractIndex: 0,
  },
];

describe('generateCode', () => {
  it('produces the expected code from sample parameters', () => {
    const fieldValues = {
      'Purpose Code': 'CC-Content creation',
      'Project Code and Name': '750-Advertising',
      'Product Category 1': 'UP-Upright Piano',
      'Product Category 1 %': '25',
      'Product Category 2': 'SY-SY&DE',
      'Product Category 2 %': '25',
      'Product Category 3': 'GP-Grand Piano',
      'Product Category 3 %': '50',
      'Product Category 4': null,
      'Product Category 4 %': null,
      'Non Production Digital %': '75',
      'Production Digital %': '25',
      'Non-Production Non-Digital %': null,
      'Production Non-Digital %': null,
    };

    const code = generateCode(segments, fieldValues);
    expect(code).toBe('CC-750-UP25SY25GP50-NPD75PD25');
  });

  it('skips composite entries with zero percent', () => {
    const fieldValues = {
      'Purpose Code': 'CC-Content creation',
      'Project Code and Name': '750-Advertising',
      'Product Category 1': 'GP-Grand Piano',
      'Product Category 1 %': '100',
      'Product Category 2': 'UP-Upright Piano',
      'Product Category 2 %': '0',
      'Non Production Digital %': '100',
    };

    const code = generateCode(segments, fieldValues);
    expect(code).toBe('CC-750-GP100-NPD100');
  });

  it('includes all four product categories when provided', () => {
    const fieldValues = {
      'Purpose Code': 'SH-Show',
      'Project Code and Name': '868-Sponsorships',
      'Product Category 1': 'UP-Upright Piano',
      'Product Category 1 %': '25',
      'Product Category 2': 'GP-Grand Piano',
      'Product Category 2 %': '25',
      'Product Category 3': 'DP-Digital Piano',
      'Product Category 3 %': '25',
      'Product Category 4': 'AG-Acoustic Guitar',
      'Product Category 4 %': '25',
      'Non Production Digital %': '50',
      'Production Digital %': '50',
    };

    const code = generateCode(segments, fieldValues);
    expect(code).toBe('SH-868-UP25GP25DP25AG25-NPD50PD50');
  });

  it('includes all four media types when provided', () => {
    const fieldValues = {
      'Purpose Code': 'AD-Ad',
      'Project Code and Name': '750-Advertising',
      'Product Category 1': 'HA-Home Audio',
      'Product Category 1 %': '100',
      'Non Production Digital %': '25',
      'Production Digital %': '25',
      'Non-Production Non-Digital %': '25',
      'Production Non-Digital %': '25',
    };

    const code = generateCode(segments, fieldValues);
    expect(code).toBe('AD-750-HA100-NPD25PD25NPND25PND25');
  });

  it('silently skips segments with no input data (e.g. template lacks media type fields)', () => {
    const fieldValues = {
      'Purpose Code': 'CC-Content creation',
      'Project Code and Name': '750-Advertising',
      'Product Category 1': 'UP-Upright Piano',
      'Product Category 1 %': '100',
    };

    const code = generateCode(segments, fieldValues);
    expect(code).toBe('CC-750-UP100');
  });

  it('returns an empty string when no segments produce values', () => {
    expect(generateCode(segments, {})).toBe('');
  });
});
