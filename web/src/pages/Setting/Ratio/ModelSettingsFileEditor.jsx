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

import React, { useEffect, useRef, useState } from 'react';
import { Button, Card, Space, Typography } from '@douyinfe/semi-ui';
import { IconDownload, IconFile, IconSave, IconCode } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import {
  API,
  showError,
  showInfo,
  showSuccess,
  verifyJSON,
} from '../../../helpers';

const { Text } = Typography;

const normalizeModelPriceJson = (rawText) => {
  const parsed = rawText.trim() ? JSON.parse(rawText) : {};
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('invalid-model-price-json');
  }

  const normalized = {};
  let trimmedKeyCount = 0;
  let mergedDuplicateCount = 0;
  let emptyKeyCount = 0;

  Object.entries(parsed).forEach(([modelName, value]) => {
    const rawModelName = String(modelName || '');
    const normalizedName = rawModelName.trim();
    if (!normalizedName) {
      emptyKeyCount += 1;
      return;
    }
    if (rawModelName !== normalizedName) {
      trimmedKeyCount += 1;
    }
    if (
      Object.prototype.hasOwnProperty.call(normalized, normalizedName)
    ) {
      mergedDuplicateCount += 1;
    }
    normalized[normalizedName] = value;
  });

  return {
    normalized,
    stats: {
      trimmedKeyCount,
      mergedDuplicateCount,
      emptyKeyCount,
    },
  };
};

const stringifyModelPriceJson = (rawText) => {
  const { normalized, stats } = normalizeModelPriceJson(rawText);
  return {
    text: JSON.stringify(normalized, null, 2),
    stats,
  };
};

const notifyNormalization = (stats, t) => {
  const changedCount =
    stats.trimmedKeyCount + stats.mergedDuplicateCount + stats.emptyKeyCount;
  if (changedCount <= 0) {
    return;
  }

  showInfo(
    t('已自动清理模型名：去除空白 {{trimmed}}, 合并重复 {{merged}}, 删除空键 {{empty}}', {
      trimmed: stats.trimmedKeyCount,
      merged: stats.mergedDuplicateCount,
      empty: stats.emptyKeyCount,
    }),
  );
};

export default function ModelSettingsFileEditor({ options, refresh }) {
  const { t } = useTranslation();
  const [jsonText, setJsonText] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const raw = options.ModelPrice || '{}';
    try {
      setJsonText(stringifyModelPriceJson(raw).text);
    } catch {
      setJsonText(raw);
    }
  }, [options.ModelPrice]);

  const handleFormat = () => {
    try {
      const { text, stats } = stringifyModelPriceJson(jsonText);
      setJsonText(text);
      notifyNormalization(stats, t);
      showSuccess(t('格式化成功'));
    } catch {
      showError(t('JSON 格式错误，无法格式化'));
    }
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      try {
        const { text: normalizedText, stats } = stringifyModelPriceJson(text);
        setJsonText(normalizedText);
        notifyNormalization(stats, t);
        showSuccess(t('导入成功'));
      } catch {
        showError(t('导入的文件不是合法的 JSON'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportFile = () => {
    try {
      const { text: normalizedText, stats } = stringifyModelPriceJson(jsonText);
      setJsonText(normalizedText);
      notifyNormalization(stats, t);
      const blob = new Blob([normalizedText], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'model-pricing.json';
      a.click();
      URL.revokeObjectURL(url);
      showSuccess(t('导出成功'));
    } catch {
      showError(t('JSON 格式错误，无法导出'));
    }
  };

  const handleSave = async () => {
    if (!verifyJSON(jsonText)) {
      showError(t('不是合法的 JSON 字符串'));
      return;
    }

    setLoading(true);
    try {
      const { text: normalizedText, stats } = stringifyModelPriceJson(jsonText);
      setJsonText(normalizedText);
      notifyNormalization(stats, t);
      const res = await API.put('/api/option/', {
        key: 'ModelPrice',
        value: normalizedText,
      });
      if (res.data.success) {
        showSuccess(t('保存成功'));
        await refresh();
      } else {
        showError(res.data.message || t('保存失败'));
      }
    } catch {
      showError(t('保存失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space vertical align='start' style={{ width: '100%' }}>
      <Space wrap className='mt-2'>
        <Button icon={<IconCode />} onClick={handleFormat}>
          {t('格式化 JSON')}
        </Button>
        <Button icon={<IconFile />} onClick={() => fileInputRef.current?.click()}>
          {t('导入文件')}
        </Button>
        <input
          ref={fileInputRef}
          type='file'
          accept='.json,application/json'
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />
        <Button icon={<IconDownload />} onClick={handleExportFile}>
          {t('导出文件')}
        </Button>
        <Button type='primary' icon={<IconSave />} loading={loading} onClick={handleSave}>
          {t('保存')}
        </Button>
      </Space>

      <Text size='small' type='tertiary'>
        {t('可直接编辑 ModelPrice JSON，便于快速迁移和批量修改。')}
      </Text>

      <Card style={{ width: '100%' }} bodyStyle={{ padding: 0 }}>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          spellCheck={false}
          style={{
            width: '100%',
            minHeight: 480,
            padding: 16,
            fontFamily: 'monospace',
            fontSize: 13,
            border: 'none',
            outline: 'none',
            resize: 'vertical',
            background: 'var(--semi-color-fill-0)',
            color: 'var(--semi-color-text-0)',
            lineHeight: 1.6,
          }}
        />
      </Card>
    </Space>
  );
}
