/**
 * Generates a project code from workflow field values based on configured segments.
 *
 * Example output: CC-PC004-UP25SY25GP50-NPD75PD25
 *
 * Segment types:
 *   "single"    — extracts a code from one field value (e.g. "CC-Content creation" → "CC")
 *   "composite" — concatenates code+percent pairs (e.g. UP25SY25GP50)
 */

function extractCode(value, delimiter = '-', extractIndex = 0) {
  if (!value) return null;
  const parts = String(value).split(delimiter);
  return (parts[extractIndex] || '').trim();
}

function buildSegment(segment, fieldValues) {
  if (segment.type === 'single') {
    const raw = fieldValues[segment.fieldApiName];
    if (raw == null) return null;
    return extractCode(raw, segment.delimiter, segment.extractIndex);
  }

  if (segment.type === 'composite') {
    const parts = [];
    for (const entry of segment.entries) {
      const codeRaw = fieldValues[entry.codeFieldApiName];
      const pctRaw = fieldValues[entry.percentFieldApiName];

      if (codeRaw == null || pctRaw == null) continue;

      const code = extractCode(codeRaw, segment.delimiter, segment.extractIndex);
      const pct = Math.round(Number(pctRaw));

      if (!code || isNaN(pct) || pct <= 0) continue;

      parts.push(`${code}${pct}`);
    }
    return parts.length > 0 ? parts.join('') : null;
  }

  throw new Error(`Unknown segment type: ${segment.type}`);
}

function generateCode(segments, fieldValues) {
  const codeParts = [];

  for (const segment of segments) {
    const value = buildSegment(segment, fieldValues);
    if (value == null) {
      throw new Error(`Segment "${segment.name}" produced no value — check field mappings and input data`);
    }
    codeParts.push(value);
  }

  return codeParts.join('-');
}

module.exports = { generateCode, buildSegment, extractCode };
