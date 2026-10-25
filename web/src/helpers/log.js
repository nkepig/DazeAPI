/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

export function getLogOther(otherStr) {
  if (otherStr === undefined || otherStr === null || otherStr === '') {
    return {};
  }
  if (typeof otherStr === 'object') {
    return otherStr;
  }
  try {
    return JSON.parse(otherStr);
  } catch (e) {
    console.error(`Failed to parse record.other: "${otherStr}".`, e);
    return null;
  }
}

const USAGE_VALUE_MAX_LEN = 200;

function clipUsageText(value) {
  const text = String(value);
  if (text.length <= USAGE_VALUE_MAX_LEN) {
    return text;
  }
  return `${text.slice(0, USAGE_VALUE_MAX_LEN)}…`;
}

function clipUsageValue(value, isRoot = false) {
  if (typeof value === 'string') {
    return clipUsageText(value);
  }
  if (Array.isArray(value)) {
    try {
      const encoded = JSON.stringify(value);
      if (encoded.length > USAGE_VALUE_MAX_LEN) {
        return clipUsageText(encoded);
      }
    } catch (e) {
      return value;
    }
    return value.map((item) => clipUsageValue(item, false));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    out[key] = clipUsageValue(child, false);
  }
  if (isRoot) {
    return out;
  }
  try {
    const encoded = JSON.stringify(out);
    if (encoded.length > USAGE_VALUE_MAX_LEN) {
      return clipUsageText(encoded);
    }
  } catch (e) {
    return out;
  }
  return out;
}

function looksLikeGeminiUsage(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return false;
  }
  return [
    'promptTokenCount',
    'candidatesTokenCount',
    'totalTokenCount',
    'candidatesTokensDetails',
  ].some((key) => Object.prototype.hasOwnProperty.call(obj, key));
}

export function sanitizeUsageDict(usage) {
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) {
    return usage;
  }
  let dict = usage;
  const metadata = usage.usageMetadata;
  if (
    metadata &&
    typeof metadata === 'object' &&
    !Array.isArray(metadata) &&
    looksLikeGeminiUsage(metadata) &&
    !looksLikeGeminiUsage(usage)
  ) {
    dict = metadata;
  }
  const nested = usage.usage;
  if (
    dict === usage &&
    nested &&
    typeof nested === 'object' &&
    !Array.isArray(nested) &&
    looksLikeUsageDict(nested) &&
    !looksLikeUsageDict(usage)
  ) {
    dict = nested;
  }
  return clipUsageValue(dict, true);
}

function looksLikeUsageDict(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return false;
  }
  return [
    'prompt_tokens',
    'completion_tokens',
    'input_tokens',
    'output_tokens',
    'total_tokens',
  ].some((key) => Object.prototype.hasOwnProperty.call(obj, key));
}

export function getLogUsageDict(record) {
  const other = getLogOther(record?.other) || {};
  if (
    other.usage &&
    typeof other.usage === 'object' &&
    !Array.isArray(other.usage) &&
    Object.keys(other.usage).length > 0
  ) {
    return { usage: other.usage, reconstructed: false, needsFetch: false };
  }
  if (other.has_usage) {
    return { usage: null, reconstructed: false, needsFetch: true };
  }

  return { usage: null, reconstructed: false, needsFetch: false };
}
