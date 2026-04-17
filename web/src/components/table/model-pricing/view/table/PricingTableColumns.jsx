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
import { Tag, Space, Tooltip } from '@douyinfe/semi-ui';
import { IconHelpCircle } from '@douyinfe/semi-icons';
import {
  renderModelTag,
  stringToColor,
  calculateModelPrice,
  getModelPriceItems,
  getLobeHubIcon,
} from '../../../../../helpers';
import {
  renderLimitedItems,
  renderDescription,
} from '../../../../common/ui/RenderUtils';
import { useIsMobile } from '../../../../../hooks/common/useIsMobile';

function renderQuotaType(type, t) {
  switch (type) {
    case 1:
      return (
        <Tag color='teal' shape='circle'>
          {t('按次计费')}
        </Tag>
      );
    case 0:
      return (
        <Tag color='violet' shape='circle'>
          {t('按量计费')}
        </Tag>
      );
    default:
      return t('未知');
  }
}

// Render vendor name
const renderVendor = (vendorName, vendorIcon, t) => {
  if (!vendorName) return '-';
  return (
    <Tag
      color='white'
      shape='circle'
      prefixIcon={getLobeHubIcon(vendorIcon || 'Layers', 14)}
    >
      {vendorName}
    </Tag>
  );
};

// Render tags list using RenderUtils
const renderTags = (text) => {
  if (!text) return '-';
  const tagsArr = text.split(',').filter((tag) => tag.trim());
  return renderLimitedItems({
    items: tagsArr,
    renderItem: (tag, idx) => (
      <Tag
        key={idx}
        color={stringToColor(tag.trim())}
        shape='circle'
        size='small'
      >
        {tag.trim()}
      </Tag>
    ),
    maxDisplay: 3,
  });
};

function renderSupportedEndpoints(endpoints) {
  if (!endpoints || endpoints.length === 0) {
    return null;
  }
  return (
    <Space wrap>
      {endpoints.map((endpoint, idx) => (
        <Tag key={endpoint} color={stringToColor(endpoint)} shape='circle'>
          {endpoint}
        </Tag>
      ))}
    </Space>
  );
}

export const getPricingTableColumns = ({
  t,
  selectedGroup,
  groupRatio,
  copyText,
  setModalImageUrl,
  setIsModalOpenurl,
  currency,
  siteDisplayType,
  tokenUnit,
  displayPrice,
  showRatio,
}) => {
  const isMobile = useIsMobile();
  const priceDataCache = new WeakMap();

  const getPriceData = (record) => {
    let cache = priceDataCache.get(record);
    if (!cache) {
      cache = calculateModelPrice({
        record,
        selectedGroup,
        groupRatio,
        tokenUnit,
        displayPrice,
        currency,
        quotaDisplayType: siteDisplayType,
      });
      priceDataCache.set(record, cache);
    }
    return cache;
  };

  const endpointColumn = {
    title: t('可用端点类型'),
    dataIndex: 'supported_endpoint_types',
    render: (text, record, index) => {
      return renderSupportedEndpoints(text);
    },
  };

  const modelNameColumn = {
    title: t('模型名称'),
    dataIndex: 'model_name',
    render: (text, record, index) => {
      return renderModelTag(text, {
        onClick: () => {
          copyText(text);
        },
      });
    },
    onFilter: (value, record) =>
      record.model_name.toLowerCase().includes(value.toLowerCase()),
  };

  const quotaColumn = {
    title: t('计费类型'),
    dataIndex: 'pricing_type',
    render: (text, record, index) => {
      return renderQuotaType(parseInt(text), t);
    },
    sorter: (a, b) => a.pricing_type - b.pricing_type,
  };

  const descriptionColumn = {
    title: t('描述'),
    dataIndex: 'description',
    render: (text) => renderDescription(text, 200),
  };

  const tagsColumn = {
    title: t('标签'),
    dataIndex: 'tags',
    render: renderTags,
  };

  const vendorColumn = {
    title: t('供应商'),
    dataIndex: 'vendor_name',
    render: (text, record) => renderVendor(text, record.vendor_icon, t),
  };

  const baseColumns = [
    modelNameColumn,
    vendorColumn,
    descriptionColumn,
    tagsColumn,
    quotaColumn,
  ];

  const pricingColumn = {
    title: t('模型价格'),
    dataIndex: 'prompt_price',
    ...(isMobile ? {} : { fixed: 'right' }),
    render: (text, record, index) => {
      const priceData = getPriceData(record);
      if (record.pricing_type === 1) {
        return (
          <div className='space-y-1'>
            <div className='text-gray-700'>
              {t('按次计费')}：${record.per_call_price?.toFixed(4) || '-'}
            </div>
            <div className='text-gray-700'>
              {t('分组折扣')}：{priceData?.usedGroupRatio ?? '-'}
            </div>
          </div>
        );
      }
      return (
        <div className='space-y-1'>
          <div className='text-gray-700'>
            {t('输入价格')}：${record.prompt_price?.toFixed(2) || '-'} /1M tokens
          </div>
          <div className='text-gray-700'>
            {t('输出价格')}：${record.completion_price?.toFixed(2) || '-'} /1M tokens
          </div>
          {record.cache_read_price > 0 && (
            <div className='text-gray-700'>
              {t('缓存读取')}：${record.cache_read_price?.toFixed(2) || '-'} /1M tokens
            </div>
          )}
          {record.cache_write_price > 0 && (
            <div className='text-gray-700'>
              {t('缓存写入')}：${record.cache_write_price?.toFixed(2) || '-'} /1M tokens
            </div>
          )}
          <div className='text-gray-700'>
            {t('分组折扣')}：{priceData?.usedGroupRatio ?? '-'}
          </div>
        </div>
      );
    },
  };

  const columns = [...baseColumns];
  columns.push(endpointColumn);
  columns.push(pricingColumn);
  return columns;
};
