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

import React, { useMemo, useState } from 'react';
import { Tag } from '@douyinfe/semi-ui';
import {
  calculateModelPrice,
  formatPriceInfo,
  getModelPriceItems,
} from '../../../../helpers';

const formatTierLabel = (tier) => {
  if (tier?.max_len === null || tier?.max_len === undefined || tier?.max_len === '') {
    return '∞';
  }
  const n = Number(tier.max_len);
  if (!Number.isFinite(n)) {
    return '∞';
  }
  if (n >= 1000 && n % 1000 === 0) {
    return `≤${n / 1000}K`;
  }
  return `≤${n}`;
};

export const sortTiers = (tiers) => {
  return [...(tiers || [])].sort((a, b) => {
    const aUnlimited = a?.max_len === null || a?.max_len === undefined || a?.max_len === '';
    const bUnlimited = b?.max_len === null || b?.max_len === undefined || b?.max_len === '';
    if (aUnlimited && bUnlimited) return 0;
    if (aUnlimited) return 1;
    if (bUnlimited) return -1;
    return Number(a.max_len) - Number(b.max_len);
  });
};

export const isTieredPricing = (record) =>
  record?.billing_mode === 'tiered' && Array.isArray(record?.tiers) && record.tiers.length > 0;

export const applyTierToRecord = (record, tier) => {
  if (!record || !tier) return record;
  return {
    ...record,
    prompt_price: tier.prompt_price ?? 0,
    completion_price: tier.completion_price ?? 0,
    cache_read_price: tier.cache_read_price ?? 0,
    cache_write_price: tier.cache_write_price ?? 0,
  };
};

/**
 * 动态阶梯价格展示：触碰/点击档位切换显示对应输入输出价。
 */
export default function TieredPriceDisplay({
  record,
  selectedGroup,
  groupRatio,
  tokenUnit,
  displayPrice,
  currency,
  siteDisplayType,
  t,
  compact = false,
  showItems = false,
  tierIndex: controlledIndex,
  onTierIndexChange,
}) {
  const tiers = useMemo(() => sortTiers(record?.tiers), [record?.tiers]);
  const [innerIndex, setInnerIndex] = useState(0);
  const isControlled = controlledIndex !== undefined;
  const tierIndex = isControlled ? controlledIndex : innerIndex;
  const setTierIndex = (index) => {
    if (!isControlled) {
      setInnerIndex(index);
    }
    onTierIndexChange?.(index);
  };
  const safeIndex = tiers.length === 0 ? 0 : Math.min(tierIndex, tiers.length - 1);
  const activeTier = tiers[safeIndex];

  const priceData = useMemo(() => {
    const pricedRecord = applyTierToRecord(record, activeTier);
    return calculateModelPrice({
      record: pricedRecord,
      selectedGroup,
      groupRatio,
      tokenUnit,
      displayPrice,
      currency,
      quotaDisplayType: siteDisplayType,
    });
  }, [
    record,
    activeTier,
    selectedGroup,
    groupRatio,
    tokenUnit,
    displayPrice,
    currency,
    siteDisplayType,
  ]);

  if (!tiers.length) {
    return null;
  }

  return (
    <div
      className={compact ? 'space-y-1' : 'space-y-2'}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className='flex flex-wrap items-center gap-1'>
        {tiers.map((tier, index) => (
          <Tag
            key={`tier-${index}`}
            size='small'
            shape='circle'
            color={index === safeIndex ? 'orange' : 'white'}
            className='cursor-pointer select-none'
            onClick={() => setTierIndex(index)}
            onMouseEnter={() => setTierIndex(index)}
          >
            {formatTierLabel(tier)}
          </Tag>
        ))}
      </div>
      {showItems ? (
        <div className='space-y-1 text-gray-700'>
          {getModelPriceItems(priceData, t, siteDisplayType).map((item) => (
            <div key={item.key}>
              {item.label}：{item.value}
              {item.suffix}
            </div>
          ))}
        </div>
      ) : (
        <div className='flex flex-col gap-1 text-xs'>
          {formatPriceInfo(priceData, t, siteDisplayType)}
        </div>
      )}
    </div>
  );
}
