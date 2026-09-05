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

import i18next from 'i18next';
import { Modal, Tag, Typography } from '@douyinfe/semi-ui';
import { copy, showSuccess } from './utils';
import { quotaToDisplayAmount } from './quota';
import { MOBILE_BREAKPOINT } from '../hooks/common/useIsMobile';
import { VendorNamedIcon, getLobeHubIcon } from './vendorIcons';

export { getLobeHubIcon };

const localStorageCache = {};

export function cachedGetItem(key) {
  if (!(key in localStorageCache)) {
    localStorageCache[key] = localStorage.getItem(key);
  }
  return localStorageCache[key];
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', () => {
    Object.keys(localStorageCache).forEach((k) => {
      localStorageCache[k] = localStorage.getItem(k);
    });
  });
  window.addEventListener('locale-change', () => {
    delete localStorageCache['quota_display_type'];
    delete localStorageCache['quota_per_unit'];
    delete localStorageCache['status'];
  });
}

export function invalidateQuotaCache() {
  delete localStorageCache['quota_display_type'];
  delete localStorageCache['quota_per_unit'];
  delete localStorageCache['status'];
}

// 获取模型分类
export const getModelCategories = (() => {
  let categoriesCache = null;
  let lastLocale = null;

  return (t) => {
    const currentLocale = i18next.language;
    if (categoriesCache && lastLocale === currentLocale) {
      return categoriesCache;
    }

    categoriesCache = {
      all: {
        label: t('全部模型'),
        icon: null,
        filter: () => true,
      },
      openai: {
        label: 'OpenAI',
        icon: <VendorNamedIcon name='OpenAI' />,
        filter: (model) =>
          model.model_name.toLowerCase().includes('gpt') ||
          model.model_name.toLowerCase().includes('dall-e') ||
          model.model_name.toLowerCase().includes('whisper') ||
          model.model_name.toLowerCase().includes('tts-1') ||
          model.model_name.toLowerCase().includes('text-embedding-3') ||
          model.model_name.toLowerCase().includes('text-moderation') ||
          model.model_name.toLowerCase().includes('babbage') ||
          model.model_name.toLowerCase().includes('davinci') ||
          model.model_name.toLowerCase().includes('curie') ||
          model.model_name.toLowerCase().includes('ada') ||
          model.model_name.toLowerCase().includes('o1') ||
          model.model_name.toLowerCase().includes('o3') ||
          model.model_name.toLowerCase().includes('o4'),
      },
      anthropic: {
        label: 'Anthropic',
        icon: <VendorNamedIcon name='Claude' color />,
        filter: (model) => model.model_name.toLowerCase().includes('claude'),
      },
      gemini: {
        label: 'Gemini',
        icon: <VendorNamedIcon name='Gemini' color />,
        filter: (model) =>
          model.model_name.toLowerCase().includes('gemini') ||
          model.model_name.toLowerCase().includes('gemma') ||
          model.model_name.toLowerCase().includes('learnlm') ||
          model.model_name.toLowerCase().startsWith('embedding-') ||
          model.model_name.toLowerCase().includes('text-embedding-004') ||
          model.model_name.toLowerCase().includes('imagen-4') ||
          model.model_name.toLowerCase().includes('veo-') ||
          model.model_name.toLowerCase().includes('aqa'),
      },
      zhipu: {
        label: t('智谱'),
        icon: <VendorNamedIcon name='Zhipu' color />,
        filter: (model) =>
          model.model_name.toLowerCase().includes('chatglm') ||
          model.model_name.toLowerCase().includes('glm-') ||
          model.model_name.toLowerCase().includes('cogview') ||
          model.model_name.toLowerCase().includes('cogvideo'),
      },
      deepseek: {
        label: 'DeepSeek',
        icon: <VendorNamedIcon name='DeepSeek' color />,
        filter: (model) => model.model_name.toLowerCase().includes('deepseek'),
      },
      baidu: {
        label: t('文心一言'),
        icon: <VendorNamedIcon name='Wenxin' color />,
        filter: (model) => model.model_name.toLowerCase().includes('ernie'),
      },
      xunfei: {
        label: t('讯飞星火'),
        icon: <VendorNamedIcon name='Spark' color />,
        filter: (model) => model.model_name.toLowerCase().includes('spark'),
      },
      midjourney: {
        label: 'Midjourney',
        icon: <VendorNamedIcon name='Midjourney' />,
        filter: (model) => model.model_name.toLowerCase().includes('mj_'),
      },
      cohere: {
        label: 'Cohere',
        icon: <VendorNamedIcon name='Cohere' color />,
        filter: (model) =>
          model.model_name.toLowerCase().includes('command') ||
          model.model_name.toLowerCase().includes('c4ai-') ||
          model.model_name.toLowerCase().includes('embed-'),
      },
      cloudflare: {
        label: 'Cloudflare',
        icon: <VendorNamedIcon name='Cloudflare' color />,
        filter: (model) => model.model_name.toLowerCase().includes('@cf/'),
      },
      ai360: {
        label: t('360智脑'),
        icon: <VendorNamedIcon name='Ai360' color />,
        filter: (model) => model.model_name.toLowerCase().includes('360'),
      },
      jina: {
        label: 'Jina',
        icon: <VendorNamedIcon name='Jina' />,
        filter: (model) => model.model_name.toLowerCase().includes('jina'),
      },
      xai: {
        label: 'xAI',
        icon: <VendorNamedIcon name='XAI' />,
        filter: (model) => model.model_name.toLowerCase().includes('grok'),
      },
      llama: {
        label: 'Llama',
        icon: <VendorNamedIcon name='Ollama' />,
        filter: (model) => model.model_name.toLowerCase().includes('llama'),
      },
    };

    lastLocale = currentLocale;
    return categoriesCache;
  };
})();

/**
 * 根据渠道类型返回对应的厂商图标
 * @param {number} channelType - 渠道类型值
 * @returns {JSX.Element|null} - 对应的厂商图标组件
 */
const CHANNEL_ICON_MAP = {
  1: ['OpenAI'],
  3: ['OpenAI'],
  57: ['OpenAI'],
  2: ['Midjourney'],
  5: ['Midjourney'],
  36: ['Suno'],
  14: ['Claude', true],
  33: ['Claude', true],
  41: ['Gemini', true],
  34: ['Cohere', true],
  39: ['Cloudflare', true],
  43: ['DeepSeek', true],
  15: ['Wenxin', true],
  46: ['Wenxin', true],
  18: ['Spark', true],
  16: ['Zhipu', true],
  26: ['Zhipu', true],
  24: ['Gemini', true],
  11: ['Gemini', true],
  47: ['Xinference', true],
  20: ['OpenRouter'],
  19: ['Ai360', true],
  37: ['Dify', true],
  38: ['Jina'],
  48: ['XAI'],
  56: ['Replicate'],
  22: ['FastGPT', true],
};

export function getChannelIcon(channelType) {
  const spec = CHANNEL_ICON_MAP[channelType];
  if (!spec) return null;
  return <VendorNamedIcon name={spec[0]} color={!!spec[1]} size={14} />;
}

// 颜色列表
const colors = [
  'amber',
  'blue',
  'cyan',
  'green',
  'grey',
  'indigo',
  'light-blue',
  'lime',
  'orange',
  'pink',
  'purple',
  'red',
  'teal',
  'violet',
  'yellow',
];

// 基础10色色板 (N ≤ 10)
const baseColors = [
  '#1664FF', // 主色
  '#1AC6FF',
  '#FF8A00',
  '#3CC780',
  '#7442D4',
  '#FFC400',
  '#304D77',
  '#B48DEB',
  '#009488',
  '#FF7DDA',
];

// 扩展20色色板 (10 < N ≤ 20)
const extendedColors = [
  '#1664FF',
  '#B2CFFF',
  '#1AC6FF',
  '#94EFFF',
  '#FF8A00',
  '#FFCE7A',
  '#3CC780',
  '#B9EDCD',
  '#7442D4',
  '#DDC5FA',
  '#FFC400',
  '#FAE878',
  '#304D77',
  '#8B959E',
  '#B48DEB',
  '#EFE3FF',
  '#009488',
  '#59BAA8',
  '#FF7DDA',
  '#FFCFEE',
];

// 模型颜色映射
export const modelColorMap = {
  'dall-e': 'rgb(147,112,219)', // 深紫色
  // 'dall-e-2': 'rgb(147,112,219)', // 介于紫色和蓝色之间的色调
  'dall-e-3': 'rgb(153,50,204)', // 介于紫罗兰和洋红之间的色调
  'gpt-3.5-turbo': 'rgb(184,227,167)', // 浅绿色
  // 'gpt-3.5-turbo-0301': 'rgb(131,220,131)', // 亮绿色
  'gpt-3.5-turbo-0613': 'rgb(60,179,113)', // 海洋绿
  'gpt-3.5-turbo-1106': 'rgb(32,178,170)', // 浅海洋绿
  'gpt-3.5-turbo-16k': 'rgb(149,252,206)', // 淡橙色
  'gpt-3.5-turbo-16k-0613': 'rgb(119,255,214)', // 淡桃
  'gpt-3.5-turbo-instruct': 'rgb(175,238,238)', // 粉蓝色
  'gpt-4': 'rgb(135,206,235)', // 天蓝色
  // 'gpt-4-0314': 'rgb(70,130,180)', // 钢蓝色
  'gpt-4-0613': 'rgb(100,149,237)', // 矢车菊蓝
  'gpt-4-1106-preview': 'rgb(30,144,255)', // 道奇蓝
  'gpt-4-0125-preview': 'rgb(2,177,236)', // 深天蓝
  'gpt-4-turbo-preview': 'rgb(2,177,255)', // 深天蓝
  'gpt-4-32k': 'rgb(104,111,238)', // 中紫色
  // 'gpt-4-32k-0314': 'rgb(90,105,205)', // 暗灰蓝色
  'gpt-4-32k-0613': 'rgb(61,71,139)', // 暗蓝灰色
  'gpt-4-all': 'rgb(65,105,225)', // 皇家蓝
  'gpt-4-gizmo-*': 'rgb(0,0,255)', // 纯蓝色
  'gpt-4-vision-preview': 'rgb(25,25,112)', // 午夜蓝
  'text-ada-001': 'rgb(255,192,203)', // 粉红色
  'text-babbage-001': 'rgb(255,160,122)', // 浅珊瑚色
  'text-curie-001': 'rgb(219,112,147)', // 苍紫罗兰色
  // 'text-davinci-002': 'rgb(199,21,133)', // 中紫罗兰红色
  'text-davinci-003': 'rgb(219,112,147)', // 苍紫罗兰色（与Curie相同，表示同一个系列）
  'text-davinci-edit-001': 'rgb(255,105,180)', // 热粉色
  'text-embedding-ada-002': 'rgb(255,182,193)', // 浅粉红
  'text-embedding-v1': 'rgb(255,174,185)', // 浅粉红色（略有区别）
  'text-moderation-latest': 'rgb(255,130,171)', // 强粉色
  'text-moderation-stable': 'rgb(255,160,122)', // 浅珊瑚色（与Babbage相同，表示同一类功能）
  'tts-1': 'rgb(255,140,0)', // 深橙色
  'tts-1-1106': 'rgb(255,165,0)', // 橙色
  'tts-1-hd': 'rgb(255,215,0)', // 金色
  'tts-1-hd-1106': 'rgb(255,223,0)', // 金黄色（略有区别）
  'whisper-1': 'rgb(245,245,220)', // 米色
  'claude-3-opus-20240229': 'rgb(255,132,31)', // 橙红色
  'claude-3-sonnet-20240229': 'rgb(253,135,93)', // 橙色
  'claude-3-haiku-20240307': 'rgb(255,175,146)', // 浅橙色
};

export function modelToColor(modelName) {
  // 1. 如果模型在预定义的 modelColorMap 中，使用预定义颜色
  if (modelColorMap[modelName]) {
    return modelColorMap[modelName];
  }

  // 2. 生成一个稳定的数字作为索引
  let hash = 0;
  for (let i = 0; i < modelName.length; i++) {
    hash = (hash << 5) - hash + modelName.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  hash = Math.abs(hash);

  // 3. 根据模型名称长度选择不同的色板
  const colorPalette = modelName.length > 10 ? extendedColors : baseColors;

  // 4. 使用hash值选择颜色
  const index = hash % colorPalette.length;
  return colorPalette[index];
}

export function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 6) + (hash << 16) - hash);
  }
  hash = Math.abs(hash);
  return colors[hash % colors.length];
}

const groupColors = [
  'red',
  'orange',
  'yellow',
  'lime',
  'green',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'purple',
  'pink',
  'amber',
  'grey',
];

export function groupToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  hash = Math.abs(hash);
  return groupColors[hash % groupColors.length];
}

// 渲染带有模型图标的标签
export function renderModelTag(modelName, options = {}) {
  const {
    color,
    size = 'default',
    shape = 'circle',
    onClick,
    suffixIcon,
  } = options;

  const categories = getModelCategories(i18next.t);
  let icon = null;

  for (const [key, category] of Object.entries(categories)) {
    if (key !== 'all' && category.filter({ model_name: modelName })) {
      icon = category.icon;
      break;
    }
  }

  return (
    <Tag
      color={color || stringToColor(modelName)}
      prefixIcon={icon}
      suffixIcon={suffixIcon}
      size={size}
      shape={shape}
      onClick={onClick}
    >
      {modelName}
    </Tag>
  );
}

export function renderText(text, limit) {
  if (text.length > limit) {
    return text.slice(0, limit - 3) + '...';
  }
  return text;
}

/**
 * Render group tags based on the input group string
 * @param {string} group - The input group string
 * @returns {JSX.Element} - The rendered group tags
 */
export function renderGroup(group) {
  if (group === '') {
    return (
      <Tag key='default' color='white' shape='circle'>
        {i18next.t('用户分组')}
      </Tag>
    );
  }

  const tagColors = {
    vip: 'yellow',
    pro: 'yellow',
    svip: 'red',
    premium: 'red',
  };

  const groups = group.split(',').sort();

  return (
    <span key={group}>
      {groups.map((group) => (
        <Tag
          color={tagColors[group] || groupToColor(group)}
          key={group}
          shape='circle'
          onClick={async (event) => {
            event.stopPropagation();
            if (await copy(group)) {
              showSuccess(i18next.t('已复制：') + group);
            } else {
              Modal.error({
                title: i18next.t('无法复制到剪贴板，请手动复制'),
                content: group,
              });
            }
          }}
        >
          {group}
        </Tag>
      ))}
    </span>
  );
}

export function renderRatio(ratio) {
  let color = 'green';
  if (ratio > 5) {
    color = 'red';
  } else if (ratio > 3) {
    color = 'orange';
  } else if (ratio > 1) {
    color = 'blue';
  }
  return (
    <Tag color={color}>
      {ratio}x {i18next.t('倍率')}
    </Tag>
  );
}

const measureTextWidth = (
  text,
  style = {
    fontSize: '14px',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  containerWidth,
) => {
  const span = document.createElement('span');

  span.style.visibility = 'hidden';
  span.style.position = 'absolute';
  span.style.whiteSpace = 'nowrap';
  span.style.fontSize = style.fontSize;
  span.style.fontFamily = style.fontFamily;

  span.textContent = text;

  document.body.appendChild(span);
  const width = span.offsetWidth;

  document.body.removeChild(span);

  return width;
};

export function truncateText(text, maxWidth = 200) {
  const isMobileScreen = window.matchMedia(
    `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
  ).matches;
  if (!isMobileScreen) {
    return text;
  }
  if (!text) return text;

  try {
    // Handle percentage-based maxWidth
    let actualMaxWidth = maxWidth;
    if (typeof maxWidth === 'string' && maxWidth.endsWith('%')) {
      const percentage = parseFloat(maxWidth) / 100;
      // Use window width as fallback container width
      actualMaxWidth = window.innerWidth * percentage;
    }

    const width = measureTextWidth(text);
    if (width <= actualMaxWidth) return text;

    let left = 0;
    let right = text.length;
    let result = text;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const truncated = text.slice(0, mid) + '...';
      const currentWidth = measureTextWidth(truncated);

      if (currentWidth <= actualMaxWidth) {
        result = truncated;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return result;
  } catch (error) {
    console.warn(
      'Text measurement failed, falling back to character count',
      error,
    );
    if (text.length > 20) {
      return text.slice(0, 17) + '...';
    }
    return text;
  }
}

export const renderGroupOption = (item) => {
  const {
    disabled,
    selected,
    label,
    value,
    focused,
    className,
    style,
    onMouseEnter,
    onClick,
    empty,
    emptyContent,
    ...rest
  } = item;

  const baseStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 16px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    backgroundColor: focused ? 'var(--semi-color-fill-0)' : 'transparent',
    opacity: disabled ? 0.5 : 1,
    ...(selected && {
      backgroundColor: 'var(--semi-color-primary-light-default)',
    }),
    '&:hover': {
      backgroundColor: !disabled && 'var(--semi-color-fill-1)',
    },
  };

  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  const handleMouseEnter = (e) => {
    if (!disabled && onMouseEnter) {
      onMouseEnter(e);
    }
  };

  return (
    <div
      style={baseStyle}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <Typography.Text strong type={disabled ? 'tertiary' : undefined}>
          {value}
        </Typography.Text>
        <Typography.Text type='secondary' size='small'>
          {label}
        </Typography.Text>
      </div>
      {item.ratio && renderRatio(item.ratio)}
    </div>
  );
};

export function renderNumber(num) {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B';
  } else if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 10000) {
    return (num / 1000).toFixed(1) + 'k';
  } else {
    return num;
  }
}

export function renderQuotaNumberWithDigit(num, digits = 2) {
  if (typeof num !== 'number' || isNaN(num)) {
    return 0;
  }
  const quotaDisplayType = cachedGetItem('quota_display_type') || 'USD';
  num = num.toFixed(digits);
  if (quotaDisplayType === 'CNY') {
    return '¥' + num;
  } else if (quotaDisplayType === 'USD') {
    return '$' + num;
  } else if (quotaDisplayType === 'CUSTOM') {
    const statusStr = cachedGetItem('status');
    let symbol = '¤';
    try {
      if (statusStr) {
        const s = JSON.parse(statusStr);
        symbol = s?.custom_currency_symbol || symbol;
      }
    } catch (e) { /* invalid status JSON, use defaults */ }
    return symbol + num;
  } else {
    return num;
  }
}

export function renderNumberWithPoint(num) {
  if (num === undefined) return '';
  num = num.toFixed(2);
  if (num >= 100000) {
    // Convert number to string to manipulate it
    let numStr = num.toString();
    // Find the position of the decimal point
    let decimalPointIndex = numStr.indexOf('.');

    let wholePart = numStr;
    let decimalPart = '';

    // If there is a decimal point, split the number into whole and decimal parts
    if (decimalPointIndex !== -1) {
      wholePart = numStr.slice(0, decimalPointIndex);
      decimalPart = numStr.slice(decimalPointIndex);
    }

    // Take the first two and last two digits of the whole number part
    let shortenedWholePart = wholePart.slice(0, 2) + '..' + wholePart.slice(-2);

    // Return the formatted number
    return shortenedWholePart + decimalPart;
  }

  // If the number is less than 100,000, return it unmodified
  return num;
}

export function getQuotaPerUnit() {
  return 1;
}

export function renderUnitWithQuota(quota) {
  const amount = quotaToDisplayAmount(quota);
  return amount;
}

export function getQuotaWithUnit(quota, digits = 6) {
  const amount = quotaToDisplayAmount(quota);
  return amount.toFixed(digits);
}

export function renderQuotaWithAmount(amount, digits = 6) {
  const quotaDisplayType = cachedGetItem('quota_display_type') || 'USD';
  if (quotaDisplayType === 'TOKENS') {
    return renderNumber(renderUnitWithQuota(amount));
  }

  const numericAmount = Number(amount);
  const formattedAmount = Number.isFinite(numericAmount)
    ? numericAmount.toFixed(digits)
    : amount;

  if (quotaDisplayType === 'CNY') {
    return '¥' + formattedAmount;
  } else if (quotaDisplayType === 'CUSTOM') {
    const statusStr = cachedGetItem('status');
    let symbol = '¤';
    try {
      if (statusStr) {
        const s = JSON.parse(statusStr);
        symbol = s?.custom_currency_symbol || symbol;
      }
    } catch (e) { /* invalid status JSON, use defaults */ }
    return symbol + formattedAmount;
  }
  return '$' + formattedAmount;
}

/**
 * 获取当前货币配置信息
 * @returns {Object} - { symbol, rate, type }
 */
export function getCurrencyConfig() {
  const quotaDisplayType = cachedGetItem('quota_display_type') || 'USD';
  const statusStr = cachedGetItem('status');

  let symbol = '$';
  let rate = 1;

  if (quotaDisplayType === 'CNY') {
    symbol = '¥';
    try {
      if (statusStr) {
        const s = JSON.parse(statusStr);
        rate = s?.usd_exchange_rate || 7;
      }
    } catch (e) { /* invalid status JSON, use defaults */ }
  } else if (quotaDisplayType === 'CUSTOM') {
    try {
      if (statusStr) {
        const s = JSON.parse(statusStr);
        symbol = s?.custom_currency_symbol || '¤';
        rate = s?.custom_currency_exchange_rate || 1;
      }
    } catch (e) { /* invalid status JSON, use defaults */ }
  }

  return { symbol, rate, type: quotaDisplayType };
}

/**
 * 将美元金额转换为当前选择的货币
 * @param {number} usdAmount - 美元金额
 * @param {number} digits - 小数位数
 * @returns {string} - 格式化后的货币字符串
 */
export function convertUSDToCurrency(usdAmount, digits = 2) {
  const { symbol } = getCurrencyConfig();
  const convertedAmount = usdAmount * rate;
  return symbol + convertedAmount.toFixed(digits);
}

export function renderQuota(quota, digits = 6) {
  const quotaDisplayType = cachedGetItem('quota_display_type') || 'USD';
  if (quotaDisplayType === 'TOKENS') {
    return renderNumber(quota);
  }
  const amount = quotaToDisplayAmount(quota);
  const { symbol, rate } = getCurrencyConfig();
  const value = quotaDisplayType === 'USD' ? amount : amount;
  const fixedResult = value.toFixed(digits);
  if (parseFloat(fixedResult) === 0 && quota > 0 && value > 0) {
    const minValue = Math.pow(10, -digits);
    return symbol + minValue.toFixed(digits);
  }
  return symbol + fixedResult;
}

function isValidGroupRatio(ratio) {
  return Number.isFinite(ratio) && ratio !== -1;
}

function getEffectiveRatio(groupRatio, user_group_ratio) {
  const useUserGroupRatio = isValidGroupRatio(user_group_ratio);
  const ratioLabel = useUserGroupRatio
    ? i18next.t('专属倍率')
    : i18next.t('倍率');
  const effectiveRatio = useUserGroupRatio ? user_group_ratio : groupRatio;

  return {
    ratio: effectiveRatio,
    label: ratioLabel,
    useUserGroupRatio: useUserGroupRatio,
  };
}

function getQuotaDisplayType() {
  return cachedGetItem('quota_display_type') || 'USD';
}

function resolveBillingDisplayMode(displayMode, modelPrice = -1) {
  if (modelPrice !== -1) {
    return 'price';
  }
  if (getQuotaDisplayType() === 'TOKENS') {
    return 'ratio';
  }
  return displayMode === 'ratio' ? 'ratio' : 'price';
}

function isPriceDisplayMode(displayMode, modelPrice = -1) {
  return resolveBillingDisplayMode(displayMode, modelPrice) === 'price';
}

function shouldUseLegacyTokenFallback(modelPrice = -1) {
  return modelPrice === -1 && getQuotaDisplayType() === 'TOKENS';
}

function formatCompactDisplayPrice(usdAmount, digits = 6) {
  const { symbol, rate } = getCurrencyConfig();
  const amount = Number((usdAmount * rate).toFixed(digits));
  return `${symbol}${amount}`;
}

function appendPricePart(parts, condition, key, vars) {
  if (!condition) {
    return;
  }
  parts.push(i18next.t(key, vars));
}

function joinBillingSummary(parts) {
  return parts.filter(Boolean).join('，');
}

function getGroupRatioText(groupRatio, user_group_ratio) {
  const { ratio, label } = getEffectiveRatio(groupRatio, user_group_ratio);
  return i18next.t('{{ratioType}} {{ratio}}x', {
    ratioType: label,
    ratio,
  });
}

function formatRatioValue(value, digits = 6) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Number(num.toFixed(digits));
}

function renderDisplayAmountFromUsd(usdAmount, digits = 8) {
  const numericAmount = Number(usdAmount || 0);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return '$0.00000000';
  }

  const roundedAmount = Number(numericAmount.toFixed(digits));
  const quotaDisplayType = cachedGetItem('quota_display_type') || 'USD';
  if (quotaDisplayType === 'TOKENS') {
    return renderNumber(renderUnitWithQuota(roundedAmount));
  }
  return '$' + roundedAmount.toFixed(digits);
}

function formatBillingDisplayPrice(usdAmount, rate, digits = 8) {
  return (usdAmount * rate).toFixed(digits);
}

function renderBillingArticle(lines) {
  const articleLines = lines.filter(Boolean);
  return (
    <article style={{ lineHeight: 1.45, width: '100%' }}>
      {articleLines.map((line, index) => (
        <div key={index} style={{ marginTop: index === 0 ? 0 : 6, whiteSpace: 'pre-wrap', fontVariantNumeric: 'tabular-nums' }}>
          {line}
        </div>
      ))}
    </article>
  );
}

export function renderModelPriceSimple(...args) {
  return renderModelPrice(...args);
}

export function renderModelPrice(
  inputTokens,
  completionTokens,
  legacyTokenUnitPrice,
  modelPrice = -1,
  completionRatio,
  groupRatio,
  user_group_ratio,
  cacheTokens = 0,
  cacheRatio = 1.0,
  image = false,
  imageRatio = 1.0,
  imageOutputTokens = 0,
  webSearch = false,
  webSearchCallCount = 0,
  webSearchPrice = 0,
  fileSearch = false,
  fileSearchCallCount = 0,
  fileSearchPrice = 0,
  audioInputSeperatePrice = false,
  audioInputTokens = 0,
  audioInputPrice = 0,
  imageGenerationCall = false,
  imageGenerationCallPrice = 0,
  displayMode = 'price',
  pricingData = null,
) {
  const { ratio: effectiveGroupRatio } = getEffectiveRatio(groupRatio, user_group_ratio);
  groupRatio = effectiveGroupRatio;
  const { symbol, rate } = getCurrencyConfig();
  const promptPrice = pricingData?.prompt_price ?? 0;
  const completionPrice = pricingData?.completion_price ?? 0;
  const cacheReadPrice = pricingData?.cache_read_price ?? 0;
  const imageInputPrice = pricingData?.image_price ?? 0;
  const perCallPrice = pricingData?.per_call_price;
  const cacheWritePrice = pricingData?.cache_write_price ?? 0;
  const cacheWrite5mPrice = pricingData?.cache_write_5m_price ?? cacheWritePrice;
  const cacheWrite1hPrice = pricingData?.cache_write_1h_price ?? cacheWritePrice;

  if (perCallPrice !== undefined && perCallPrice > 0) {
    const total = perCallPrice * groupRatio;
    return renderBillingArticle([
      '按次  : 1 × ' + symbol + formatBillingDisplayPrice(perCallPrice, rate, 8) + ' × (' + groupRatio + ') = ' + renderDisplayAmountFromUsd(total),
      '结果  : ' + renderDisplayAmountFromUsd(total),
    ]);
  }

  // Anthropic 语义下 input_tokens 已是不含缓存读/写的普通输入，不能再扣除 cacheTokens；
  // OpenAI 语义下 input_tokens 包含缓存读 token，需要扣除以避免重复计费。
  const isAnthropicSemantic = pricingData?.claude === true || pricingData?.usage_semantic === 'anthropic';
  const cacheInputTokens = Math.max(cacheTokens, 0);
  const normalInputTokens = isAnthropicSemantic
    ? Math.max(inputTokens - audioInputTokens - imageOutputTokens, 0)
    : Math.max(inputTokens - cacheTokens - audioInputTokens - imageOutputTokens, 0);
  const cacheWriteBaseTokens = Math.max(pricingData?.cache_creation_tokens || 0, 0);
  const cacheWrite5mTokens = Math.max(pricingData?.cache_creation_tokens_5m || 0, 0);
  const cacheWrite1hTokens = Math.max(pricingData?.cache_creation_tokens_1h || 0, 0);
  const cacheWriteTokens = cacheWriteBaseTokens + cacheWrite5mTokens + cacheWrite1hTokens;
  const imageInputTokens = image && imageOutputTokens > 0 ? imageOutputTokens : 0;
  const audioPromptTokens = Math.max(audioInputTokens, 0);
  const textOutputTokens = Math.max(completionTokens, 0);

  const inputAmount =
    (normalInputTokens / 1_000_000) * promptPrice * groupRatio +
    (cacheInputTokens / 1_000_000) * cacheReadPrice * groupRatio +
    (cacheWriteBaseTokens / 1_000_000) * cacheWritePrice * groupRatio +
    (cacheWrite5mTokens / 1_000_000) * cacheWrite5mPrice * groupRatio +
    (cacheWrite1hTokens / 1_000_000) * cacheWrite1hPrice * groupRatio +
    (imageInputTokens / 1_000_000) * imageInputPrice * groupRatio +
    (audioPromptTokens / 1_000_000) * (audioInputPrice || promptPrice) * groupRatio;

  const outputAmount =
    (textOutputTokens / 1_000_000) * completionPrice * groupRatio +
    (webSearchCallCount / 1000) * webSearchPrice * groupRatio +
    (fileSearchCallCount / 1000) * fileSearchPrice * groupRatio +
    imageGenerationCallPrice * groupRatio;

  const totalAmount = inputAmount + outputAmount;

  const inputTerms = [];
  const cacheInputTerms = [];
  const cacheWriteTerms = [];
  const imageInputTerms = [];
  const audioInputTerms = [];
  if (normalInputTokens > 0 && promptPrice > 0) inputTerms.push(String(normalInputTokens) + ' × ' + symbol + formatBillingDisplayPrice(promptPrice, rate, 8) + '/m');
  if (cacheInputTokens > 0 && cacheReadPrice > 0) cacheInputTerms.push(String(cacheInputTokens) + ' × ' + symbol + formatBillingDisplayPrice(cacheReadPrice, rate, 8) + '/m');
  if (cacheWriteTokens > 0 && cacheWritePrice > 0) cacheWriteTerms.push(String(cacheWriteTokens) + ' × ' + symbol + formatBillingDisplayPrice(cacheWritePrice, rate, 8) + '/m');
  if (cacheWrite5mTokens > 0 && cacheWrite5mPrice > 0 && cacheWrite5mPrice !== cacheWritePrice) cacheWriteTerms.push(String(cacheWrite5mTokens) + ' × ' + symbol + formatBillingDisplayPrice(cacheWrite5mPrice, rate, 8) + '/m');
  if (cacheWrite1hTokens > 0 && cacheWrite1hPrice > 0 && cacheWrite1hPrice !== cacheWritePrice) cacheWriteTerms.push(String(cacheWrite1hTokens) + ' × ' + symbol + formatBillingDisplayPrice(cacheWrite1hPrice, rate, 8) + '/m');
  if (imageInputTokens > 0 && imageInputPrice > 0) imageInputTerms.push(String(imageInputTokens) + ' × ' + symbol + formatBillingDisplayPrice(imageInputPrice, rate, 8) + '/m');
  if (audioPromptTokens > 0 && (audioInputPrice > 0 || promptPrice > 0)) audioInputTerms.push(String(audioPromptTokens) + ' × ' + symbol + formatBillingDisplayPrice(audioInputPrice || promptPrice, rate, 8) + '/m');

  const outputTerms = [];
  if (textOutputTokens > 0 && completionPrice > 0) outputTerms.push(String(textOutputTokens) + ' × ' + symbol + formatBillingDisplayPrice(completionPrice, rate, 8) + '/m');
  if (webSearchCallCount > 0 && webSearchPrice > 0) outputTerms.push('搜索' + String(webSearchCallCount) + ' × ' + symbol + formatBillingDisplayPrice(webSearchPrice, rate, 8) + '/K');
  if (fileSearchCallCount > 0 && fileSearchPrice > 0) outputTerms.push('文件' + String(fileSearchCallCount) + ' × ' + symbol + formatBillingDisplayPrice(fileSearchPrice, rate, 8) + '/K');
  if (imageGenerationCall && imageGenerationCallPrice > 0) outputTerms.push('图片生成1 × ' + symbol + formatBillingDisplayPrice(imageGenerationCallPrice, rate, 8));

  const lines = [];
  if (inputTerms.length > 0) lines.push('输入  : ' + inputTerms.join(' + ') + ' × (' + groupRatio + ') = ' + renderDisplayAmountFromUsd((normalInputTokens / 1_000_000) * promptPrice * groupRatio));
  if (cacheInputTerms.length > 0) lines.push('缓存读: ' + cacheInputTerms.join(' + ') + ' × (' + groupRatio + ') = ' + renderDisplayAmountFromUsd((cacheInputTokens / 1_000_000) * cacheReadPrice * groupRatio));
  if (cacheWriteTerms.length > 0) lines.push('缓存写: ' + cacheWriteTerms.join(' + ') + ' × (' + groupRatio + ') = ' + renderDisplayAmountFromUsd((cacheWriteBaseTokens / 1_000_000) * cacheWritePrice * groupRatio + (cacheWrite5mTokens / 1_000_000) * cacheWrite5mPrice * groupRatio + (cacheWrite1hTokens / 1_000_000) * cacheWrite1hPrice * groupRatio));
  if (imageInputTerms.length > 0) lines.push('图片输入: ' + imageInputTerms.join(' + ') + ' × (' + groupRatio + ') = ' + renderDisplayAmountFromUsd((imageInputTokens / 1_000_000) * imageInputPrice * groupRatio));
  if (audioInputTerms.length > 0) lines.push('音频输入: ' + audioInputTerms.join(' + ') + ' × (' + groupRatio + ') = ' + renderDisplayAmountFromUsd((audioPromptTokens / 1_000_000) * (audioInputPrice || promptPrice) * groupRatio));
  if (outputTerms.length > 0) lines.push('输出  : ' + outputTerms.join(' + ') + ' × (' + groupRatio + ') = ' + renderDisplayAmountFromUsd(outputAmount));
  lines.push('结果  : ' + renderDisplayAmountFromUsd(totalAmount));

  return renderBillingArticle(lines);
}

export function renderAudioModelPrice(...args) {
  return renderModelPrice(...args);
}

export function renderQuotaWithPrompt(quota, digits) {
  const quotaDisplayType = cachedGetItem('quota_display_type') || 'USD';
  if (quotaDisplayType !== 'TOKENS') {
    return i18next.t('等价金额：') + renderQuota(quota, digits);
  }
  return '';
}

export function renderClaudeModelPrice(
  inputTokens,
  completionTokens,
  legacyTokenUnitPrice,
  modelPrice = -1,
  completionRatio,
  groupRatio,
  user_group_ratio,
  cacheTokens = 0,
  cacheRatio = 1.0,
  cacheCreationTokens = 0,
  cacheCreationRatio = 1.0,
  cacheCreationTokens5m = 0,
  cacheCreationRatio5m = 1.0,
  cacheCreationTokens1h = 0,
  cacheCreationRatio1h = 1.0,
  displayMode = 'price',
  pricingData = null,
) {
  return renderModelPrice(
    inputTokens,
    completionTokens,
    legacyTokenUnitPrice,
    modelPrice,
    completionRatio,
    groupRatio,
    user_group_ratio,
    cacheTokens,
    cacheRatio,
    false,
    1.0,
    0,
    false,
    0,
    0,
    false,
    0,
    0,
    false,
    0,
    0,
    false,
    0,
    displayMode,
    pricingData,
  );
}

export function renderLogContent(...args) {
  return renderModelPrice(...args);
}

export function renderClaudeLogContent(...args) {
  return renderLogContent(...args);
}

// 已统一至 renderModelPriceSimple，若仍有遗留引用，请改为传入 provider='claude'
