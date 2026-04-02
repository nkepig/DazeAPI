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

import React from 'react';

/** 与渠道列表「已启用」等状态一致的胶囊样式 */
const PALETTE = {
  success: {
    background: '#f0fdf4',
    color: '#16a34a',
    border: '1px solid #bbf7d0',
  },
  danger: {
    background: '#fff1f2',
    color: '#e11d48',
    border: '1px solid #fecdd3',
  },
  warning: {
    background: '#fffbeb',
    color: '#d97706',
    border: '1px solid #fde68a',
  },
  neutral: {
    background: '#f9fafb',
    color: '#6b7280',
    border: '1px solid #e5e7eb',
  },
  info: {
    background: '#eff6ff',
    color: '#2563eb',
    border: '1px solid #bfdbfe',
  },
  lime: {
    background: '#f7fee7',
    color: '#4d7c0f',
    border: '1px solid #d9f99d',
  },
  purple: {
    background: '#faf5ff',
    color: '#9333ea',
    border: '1px solid #e9d5ff',
  },
};

const BASE_LAYOUT = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 10px',
  borderRadius: '9999px',
  fontSize: '12px',
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

/**
 * @param {number|string} variant
 *   数字：1 启用/成功，2 禁用/失败，3 警告类，0 未知/中性
 *   字符串：success | danger | warning | neutral | info | lime | purple 及别名
 */
export function resolveStatusPillPalette(variant) {
  const key = resolvePaletteKey(variant);
  return PALETTE[key] || PALETTE.neutral;
}

function resolvePaletteKey(variant) {
  if (variant === 1 || variant === 'success' || variant === 'enabled') {
    return 'success';
  }
  if (
    variant === 2 ||
    variant === 'error' ||
    variant === 'failure' ||
    variant === 'disabled' ||
    variant === 'danger'
  ) {
    return 'danger';
  }
  if (variant === 3 || variant === 'warning') {
    return 'warning';
  }
  if (
    variant === 0 ||
    variant === 'neutral' ||
    variant === 'default' ||
    variant === 'unknown'
  ) {
    return 'neutral';
  }
  if (variant === 'info') {
    return 'info';
  }
  if (variant === 'lime') {
    return 'lime';
  }
  if (variant === 'purple') {
    return 'purple';
  }
  return 'neutral';
}

/**
 * 渠道状态、令牌状态、测试结果等统一胶囊标签（与 ChannelsColumnDefs 渠道状态视觉一致）
 */
export function StatusPill({ variant = 'neutral', children, className, style }) {
  const palette = resolveStatusPillPalette(variant);
  return (
    <span
      className={className}
      style={{
        ...palette,
        ...BASE_LAYOUT,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
