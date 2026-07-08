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

import React, { useEffect, useState, useCallback } from 'react';
import { Button, Input, Row, Spin, Typography } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';

const { Title: SemiTitle } = Typography;

export default function SettingsClawd() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/channel/clawd/setting');
      if (res.data.success) {
        const d = res.data.data || {};
        setBaseUrl(d.agent_base_url || '');
        setModel(d.agent_model || '');
        setHasKey(!!d.agent_api_key);
      }
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        agent_base_url: baseUrl,
        agent_model: model,
      };
      if (keyInput) {
        payload.agent_api_key = keyInput;
      }
      await API.put('/api/channel/clawd/setting', payload);
      showSuccess(t('保存成功'));
      setKeyInput('');
      loadSettings();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  const labelStyle = {
    display: 'block',
    marginBottom: 4,
    fontSize: 13,
    color: 'var(--semi-color-text-2)',
    whiteSpace: 'nowrap',
    paddingLeft: 2,
  };
  const inputStyle = { width: '100%' };

  return (
    <Spin spinning={loading}>
      <div style={{ marginBottom: 15 }}>
        <SemiTitle heading={6} style={{ marginBottom: 12 }}>
          {t('Clawd 智能体配置')}
        </SemiTitle>
        <Row gutter={16} style={{ marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 200, paddingRight: 16 }}>
            <label style={labelStyle}>
              {t('Clawd Base URL')}
            </label>
            <Input
              value={baseUrl}
              onChange={setBaseUrl}
              placeholder='https://api.openai.com/v1'
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1, minWidth: 200, paddingRight: 16 }}>
            <label style={labelStyle}>
              {t('Clawd API Key')}
            </label>
            <Input
              value={keyInput}
              onChange={setKeyInput}
              type={showKey ? 'text' : 'password'}
              placeholder={hasKey ? t('已配置，输入新值可覆盖') : 'sk-...'}
              style={inputStyle}
              suffix={
                <Button
                  size='small'
                  theme='borderless'
                  type='tertiary'
                  onClick={() => setShowKey((v) => !v)}
                >
                  {showKey ? t('隐藏') : t('显示')}
                </Button>
              }
            />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>
              {t('Clawd 模型')}
            </label>
            <Input
              value={model}
              onChange={setModel}
              placeholder='gpt-4o'
              style={inputStyle}
            />
          </div>
        </Row>
        <Row>
          <Button
            size='default'
            onClick={handleSave}
            loading={saving}
            theme='solid'
            type='primary'
          >
            {t('保存 Clawd 配置')}
          </Button>
        </Row>
      </div>
    </Spin>
  );
}