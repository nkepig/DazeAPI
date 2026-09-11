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

import React, { useMemo } from 'react';
import { Button, Descriptions, Empty, Modal, Typography } from '@douyinfe/semi-ui';
import { IconCopy } from '@douyinfe/semi-icons';
import { copy, showError, showSuccess } from '../../../../helpers';

const { Text } = Typography;

function flattenUsage(value, prefix = '') {
  if (value === null || value === undefined) {
    return [];
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return [{ key: prefix || 'value', value }];
  }
  const rows = [];
  for (const [k, v] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      rows.push(...flattenUsage(v, path));
      continue;
    }
    rows.push({ key: path, value: v });
  }
  return rows;
}

function formatUsageValue(value) {
  if (value === undefined || value === '') {
    return '-';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : String(value);
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  }
  return String(value);
}

const UsageDictModal = ({
  showUsageDictModal,
  setShowUsageDictModal,
  usageDictTarget,
  t,
}) => {
  const usage = usageDictTarget?.usage && typeof usageDictTarget.usage === 'object'
    ? usageDictTarget.usage
    : null;
  const reconstructed = Boolean(usageDictTarget?.reconstructed);
  const rows = useMemo(
    () =>
      flattenUsage(usage || {}).map((row) => ({
        key: row.key,
        value: formatUsageValue(row.value),
      })),
    [usage],
  );
  const jsonText = useMemo(() => {
    if (!usage) {
      return '';
    }
    try {
      return JSON.stringify(usage, null, 2);
    } catch (e) {
      return '';
    }
  }, [usage]);

  const copyUsage = async () => {
    if (!jsonText) {
      return;
    }
    if (await copy(jsonText)) {
      showSuccess(t('Usage 已复制'));
      return;
    }
    showError(t('无法复制到剪贴板，请手动复制'));
  };

  return (
    <Modal
      title={t('用量明细')}
      visible={showUsageDictModal}
      onCancel={() => setShowUsageDictModal(false)}
      footer={null}
      centered
      closable
      maskClosable
      width={640}
    >
      <div style={{ padding: '8px 20px 20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <Text style={{ fontWeight: 600 }}>
              {usageDictTarget?.modelName || '-'}
            </Text>
            {usageDictTarget?.requestId ? (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  color: 'var(--semi-color-text-2)',
                  wordBreak: 'break-all',
                }}
              >
                {usageDictTarget.requestId}
              </div>
            ) : null}
            {reconstructed ? (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: 'var(--semi-color-text-2)',
                }}
              >
                {t('该条为旧日志，已根据已有字段还原 Usage')}
              </div>
            ) : null}
          </div>
          <Button
            icon={<IconCopy />}
            size='small'
            disabled={!jsonText}
            onClick={copyUsage}
          >
            {t('复制 Usage')}
          </Button>
        </div>

        {!usage || rows.length === 0 ? (
          <Empty description={t('暂无 Usage 数据')} />
        ) : (
          <Descriptions data={rows} />
        )}
      </div>
    </Modal>
  );
};

export default UsageDictModal;
