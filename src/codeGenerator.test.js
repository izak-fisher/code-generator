const { describe, it, expect } = require('bun:test');
const { generateCode } = require('./codeGenerator');

const segments = [
  {
    name: 'purpose',
    type: 'single',
    fieldApiName: 'field-purpose-code',
    delimiter: '-',
    extractIndex: 0,
  },
  {
    name: 'project',
    type: 'single',
    fieldApiName: 'field-project-code',
    delimiter: '-',
    extractIndex: 0,
  },
  {
    name: 'productCategory',
    type: 'composite',
    entries: [
      { codeFieldApiName: 'field-product-cat-1', percentFieldApiName: 'field-product-pct-1' },
      { codeFieldApiName: 'field-product-cat-2', percentFieldApiName: 'field-product-pct-2' },
      { codeFieldApiName: 'field-product-cat-3', percentFieldApiName: 'field-product-pct-3' },
    ],
    delimiter: '-',
    extractIndex: 0,
  },
  {
    name: 'advertisingCode',
    type: 'composite',
    entries: [
      { codeFieldApiName: 'field-ad-code-1', percentFieldApiName: 'field-ad-pct-1' },
      { codeFieldApiName: 'field-ad-code-2', percentFieldApiName: 'field-ad-pct-2' },
    ],
    delimiter: '-',
    extractIndex: 0,
  },
];

describe('generateCode', () => {
  it('produces the expected code from sample parameters', () => {
    const fieldValues = {
      'field-purpose-code': 'CC-Content creation',
      'field-project-code': 'PC004-750-Advertising',
      'field-product-cat-1': 'UP-Upright Piano',
      'field-product-pct-1': '25',
      'field-product-cat-2': 'SY-SY&DE',
      'field-product-pct-2': '25',
      'field-product-cat-3': 'GP-Grand Piano',
      'field-product-pct-3': '50',
      'field-ad-code-1': 'NPD',
      'field-ad-pct-1': '75',
      'field-ad-code-2': 'PD',
      'field-ad-pct-2': '25',
    };

    const code = generateCode(segments, fieldValues);
    expect(code).toBe('CC-PC004-UP25SY25GP50-NPD75PD25');
  });

  it('skips composite entries with zero percent', () => {
    const fieldValues = {
      'field-purpose-code': 'CC-Content creation',
      'field-project-code': 'PC004-750-Advertising',
      'field-product-cat-1': 'GP-Grand Piano',
      'field-product-pct-1': '100',
      'field-product-cat-2': 'UP-Upright Piano',
      'field-product-pct-2': '0',
      'field-product-cat-3': null,
      'field-product-pct-3': null,
      'field-ad-code-1': 'NPD',
      'field-ad-pct-1': '100',
      'field-ad-code-2': null,
      'field-ad-pct-2': null,
    };

    const code = generateCode(segments, fieldValues);
    expect(code).toBe('CC-PC004-GP100-NPD100');
  });

  it('throws when a required segment has no data', () => {
    expect(() => generateCode(segments, {})).toThrow(/produced no value/);
  });
});
