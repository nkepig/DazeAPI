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
import {
  Button,
  Space,
  Tag,
  Progress,
  Popover,
  Typography,
  Input,
  Modal,
} from '@douyinfe/semi-ui';
import {
  timestamp2string,
  renderQuota,
} from '../../../helpers';
import { IconCopy } from '@douyinfe/semi-icons';
import { StatusPill } from '../../common/ui/StatusPill';

// progress color helper
const getProgressColor = (pct) => {
  if (pct === 100) return 'var(--semi-color-success)';
  if (pct <= 10) return 'var(--semi-color-danger)';
  if (pct <= 30) return 'var(--semi-color-warning)';
  return undefined;
};

// Render functions
function renderTimestamp(timestamp) {
  return <>{timestamp2string(timestamp)}</>;
}

// Render status column only (no usage)
const renderStatus = (text, record, t) => {
  let variant = 0;
  let tagText = t('未知状态');
  if (text === 1) {
    variant = 1;
    tagText = t('已启用');
  } else if (text === 2) {
    variant = 2;
    tagText = t('已禁用');
  } else if (text === 3) {
    variant = 3;
    tagText = t('已过期');
  } else if (text === 4) {
    variant = 0;
    tagText = t('已耗尽');
  }
  return <StatusPill variant={variant}>{tagText}</StatusPill>;
};

// Render token key column with show/hide and copy functionality
const renderTokenKey = (
  text,
  record,
  loadingTokenKeys,
  copyTokenKey,
) => {
  const loading = !!loadingTokenKeys[record.id];
  const keyValue = record.key || '';
  const displayedKey = keyValue ? `sk-${keyValue.slice(0, 6)}...` : '';

  return (
    <div className='w-[160px]'>
      <Input
        readOnly
        value={displayedKey}
        size='small'
        suffix={
          <Button
            theme='borderless'
            size='small'
            type='tertiary'
            icon={<IconCopy />}
            loading={loading}
            aria-label='copy token key'
            onClick={async (e) => {
              e.stopPropagation();
              await copyTokenKey(record);
            }}
          />
        }
      />
    </div>
  );
};

// Render separate quota usage column
const renderQuotaUsage = (text, record, t) => {
  const { Paragraph } = Typography;
  const used = parseInt(record.used_quota) || 0;
  const remain = parseInt(record.remain_quota) || 0;
  const total = used + remain;
  if (record.unlimited_quota) {
    const popoverContent = (
      <div className='text-xs p-2'>
        <Paragraph copyable={{ content: renderQuota(used) }}>
          {t('已用额度')}: {renderQuota(used)}
        </Paragraph>
      </div>
    );
    return (
      <Popover content={popoverContent} position='top'>
        <Tag color='white' shape='circle'>
          {t('无限额度')}
        </Tag>
      </Popover>
    );
  }
  const percent = total > 0 ? (remain / total) * 100 : 0;
  const popoverContent = (
    <div className='text-xs p-2'>
      <Paragraph copyable={{ content: renderQuota(used) }}>
        {t('已用额度')}: {renderQuota(used)}
      </Paragraph>
      <Paragraph copyable={{ content: renderQuota(remain) }}>
        {t('剩余额度')}: {renderQuota(remain)} ({percent.toFixed(0)}%)
      </Paragraph>
      <Paragraph copyable={{ content: renderQuota(total) }}>
        {t('总额度')}: {renderQuota(total)}
      </Paragraph>
    </div>
  );
  return (
    <Popover content={popoverContent} position='top'>
      <Tag color='white' shape='circle'>
        <div className='flex flex-col items-end'>
          <span className='text-xs leading-none'>{`${renderQuota(remain)} / ${renderQuota(total)}`}</span>
          <Progress
            percent={percent}
            stroke={getProgressColor(percent)}
            aria-label='quota usage'
            format={() => `${percent.toFixed(0)}%`}
            style={{ width: '100%', marginTop: '1px', marginBottom: 0 }}
          />
        </div>
      </Tag>
    </Popover>
  );
};

// Render operations column
const renderOperations = (
  text,
  record,
  setEditingToken,
  setShowEdit,
  manageToken,
  refresh,
  t,
) => {
  return (
    <Space wrap>
      {record.status === 1 ? (
        <Button
          type='danger'
          onClick={async () => {
            await manageToken(record.id, 'disable', record);
            await refresh();
          }}
        >
          {t('禁用')}
        </Button>
      ) : (
        <Button
          onClick={async () => {
            await manageToken(record.id, 'enable', record);
            await refresh();
          }}
        >
          {t('启用')}
        </Button>
      )}

      <Button
        type='tertiary'
        onClick={() => {
          setEditingToken(record);
          setShowEdit(true);
        }}
      >
        {t('编辑')}
      </Button>

      <Button
        type='danger'
        onClick={() => {
          Modal.confirm({
            title: t('确定是否要删除此令牌？'),
            content: t('此修改将不可逆'),
            onOk: () => {
              (async () => {
                await manageToken(record.id, 'delete', record);
                await refresh();
              })();
            },
          });
        }}
      >
        {t('删除')}
      </Button>
    </Space>
  );
};

export const getTokensColumns = ({
  t,
  loadingTokenKeys,
  copyTokenKey,
  manageToken,
  setEditingToken,
  setShowEdit,
  refresh,
}) => {
  return [
    {
      title: t('名称'),
      dataIndex: 'name',
      render: (text, record) => {
        const disabled = record.status === 2;
        return (
          <span
            className={
              disabled ? 'text-red-600 font-semibold' : undefined
            }
          >
            {text}
          </span>
        );
      },
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      key: 'status',
      render: (text, record) => renderStatus(text, record, t),
    },
    {
      title: t('剩余额度/总额度'),
      key: 'quota_usage',
      render: (text, record) => renderQuotaUsage(text, record, t),
    },
    {
      title: t('密钥'),
      key: 'token_key',
      render: (text, record) =>
        renderTokenKey(text, record, loadingTokenKeys, copyTokenKey),
    },
    {
      title: t('分组'),
      dataIndex: 'group',
      render: (text) => <Tag color='blue' shape='circle'>{text || '-'}</Tag>,
    },
    {
      title: '',
      dataIndex: 'operate',
      fixed: 'right',
      render: (text, record, index) =>
        renderOperations(
          text,
          record,
          setEditingToken,
          setShowEdit,
          manageToken,
          refresh,
          t,
        ),
    },
  ];
};
