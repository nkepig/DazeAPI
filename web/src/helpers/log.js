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

function setIfPositive(target, key, value) {
  const n = Number(value);
  if (!n) {
    return;
  }
  target[key] = n;
}

// Prefer the stored upstream usage dict. Older logs reconstruct a compact
// usage object from token columns and billing fields already in `other`.
export function getLogUsageDict(record) {
  const other = getLogOther(record?.other) || {};
  if (other.usage && typeof other.usage === 'object' && !Array.isArray(other.usage)) {
    return { usage: other.usage, reconstructed: false };
  }

  const promptTokens = Number(record?.prompt_tokens || 0);
  const completionTokens = Number(record?.completion_tokens || 0);
  const usage = {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
  };

  setIfPositive(usage, 'input_tokens', other.input_tokens_total);
  if (other.usage_semantic) {
    usage.usage_semantic = other.usage_semantic;
  }
  if (other.usage_source) {
    usage.usage_source = other.usage_source;
  }

  const promptDetails = {};
  setIfPositive(promptDetails, 'cached_tokens', other.cache_tokens);
  const cacheWrite = Number(
    other.cache_write_tokens || other.cache_creation_tokens || 0,
  );
  if (cacheWrite) {
    promptDetails.cache_write_tokens = cacheWrite;
    promptDetails.cached_creation_tokens = Number(
      other.cache_creation_tokens || cacheWrite,
    );
  }
  setIfPositive(promptDetails, 'audio_tokens', other.audio_input);
  setIfPositive(promptDetails, 'image_tokens', other.image_output);
  if (Object.keys(promptDetails).length > 0) {
    usage.prompt_tokens_details = promptDetails;
  }

  const completionDetails = {};
  setIfPositive(completionDetails, 'audio_tokens', other.audio_output);
  if (Object.keys(completionDetails).length > 0) {
    usage.completion_tokens_details = completionDetails;
  }

  setIfPositive(
    usage,
    'claude_cache_creation_5_m_tokens',
    other.cache_creation_tokens_5m,
  );
  setIfPositive(
    usage,
    'claude_cache_creation_1_h_tokens',
    other.cache_creation_tokens_1h,
  );

  return { usage, reconstructed: true };
}
