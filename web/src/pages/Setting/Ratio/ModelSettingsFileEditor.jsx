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
import { API, showError, showSuccess, verifyJSON } from '../../../helpers';

const { Text } = Typography;

export default function ModelSettingsFileEditor({ options, refresh }) {
  const { t } = useTranslation();
  const [jsonText, setJsonText] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const raw = options.ModelPrice || '{}';
    try {
      const parsed = raw.trim() ? JSON.parse(raw) : {};
      setJsonText(JSON.stringify(parsed, null, 2));
    } catch {
      setJsonText(raw);
    }
  }, [options.ModelPrice]);

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
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
        JSON.parse(text);
        setJsonText(text);
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
      JSON.parse(jsonText);
      const blob = new Blob([jsonText], { type: 'application/json' });
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
      const res = await API.put('/api/option/', {
        key: 'ModelPrice',
        value: jsonText,
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
