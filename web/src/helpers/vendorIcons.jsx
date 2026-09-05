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

import { Avatar } from '@douyinfe/semi-ui';
import { Layers } from 'lucide-react';
import {
  Ai360,
  Alibaba,
  Anthropic,
  Aws,
  Azure,
  Baidu,
  Bedrock,
  ChatGLM,
  Claude,
  Cloudflare,
  Cohere,
  DeepSeek,
  Dify,
  Doubao,
  FastGPT,
  Flux,
  Gemini,
  Google,
  Grok,
  Groq,
  HuggingFace,
  Hunyuan,
  Jina,
  Meta,
  Midjourney,
  Minimax,
  Mistral,
  Moonshot,
  Nvidia,
  Ollama,
  OpenAI,
  OpenRouter,
  Perplexity,
  Qwen,
  Replicate,
  SiliconCloud,
  Spark,
  Stability,
  Suno,
  Tencent,
  Together,
  VertexAI,
  Volcengine,
  Wenxin,
  XAI,
  Xinference,
  Zhipu,
} from '@lobehub/icons';

const ICONS = {
  Ai360,
  Alibaba,
  Anthropic,
  Aws,
  Azure,
  Baidu,
  Bedrock,
  ChatGLM,
  Claude,
  Cloudflare,
  Cohere,
  DeepSeek,
  Dify,
  Doubao,
  FastGPT,
  Flux,
  Gemini,
  Google,
  Grok,
  Groq,
  HuggingFace,
  Hunyuan,
  Jina,
  Layers,
  Llama: Ollama,
  Meta,
  Midjourney,
  MiniMax: Minimax,
  Minimax,
  Mistral,
  Moonshot,
  Nvidia,
  Ollama,
  OpenAI,
  OpenRouter,
  Perplexity,
  Qwen,
  Replicate,
  SiliconCloud,
  Spark,
  Stability,
  Suno,
  Tencent,
  Together,
  VertexAI,
  Volcengine,
  Wenxin,
  XAI,
  Xinference,
  Zhipu,
};

function LetterAvatar({ letter, size }) {
  return (
    <Avatar size='extra-extra-small' style={{ width: size, height: size, fontSize: Math.max(10, size - 6) }}>
      {letter}
    </Avatar>
  );
}

function parseValue(raw) {
  if (raw == null) return true;
  let v = String(raw).trim();
  if (v.startsWith('{') && v.endsWith('}')) {
    v = v.slice(1, -1).trim();
  }
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(v)) return Number(v);
  return v;
}

function resolveVendorIcon(iconName, size = 14) {
  const segments = String(iconName).split('.');
  const baseKey = segments[0];
  const BaseIcon = ICONS[baseKey];

  let IconComponent = undefined;
  let propStartIndex = 1;

  if (BaseIcon && segments.length > 1 && BaseIcon[segments[1]]) {
    IconComponent = BaseIcon[segments[1]];
    propStartIndex = 2;
  } else {
    IconComponent = BaseIcon;
    propStartIndex = 1;
  }

  if (
    !IconComponent ||
    (typeof IconComponent !== 'function' && typeof IconComponent !== 'object')
  ) {
    const firstLetter = String(iconName).charAt(0).toUpperCase() || '?';
    return <LetterAvatar letter={firstLetter} size={size} />;
  }

  const props = {};
  for (let i = propStartIndex; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg) continue;
    const eqIdx = seg.indexOf('=');
    if (eqIdx === -1) {
      props[seg.trim()] = true;
      continue;
    }
    props[seg.slice(0, eqIdx).trim()] = parseValue(seg.slice(eqIdx + 1).trim());
  }

  if (props.size == null && size != null) props.size = size;
  return <IconComponent {...props} />;
}

export function VendorNamedIcon({ name, color = false, size = 14 }) {
  const Base = ICONS[name];
  if (!Base) {
    return <LetterAvatar letter={(name || '?').charAt(0).toUpperCase()} size={size} />;
  }
  const Icon = color && Base.Color ? Base.Color : Base;
  return <Icon size={size} />;
}

export function getLobeHubIcon(iconName, size = 14) {
  if (typeof iconName === 'string') iconName = iconName.trim();
  if (!iconName) {
    return <LetterAvatar letter='?' size={size} />;
  }
  return resolveVendorIcon(iconName, size);
}
