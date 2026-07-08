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
import { Button, Col, Form, Row, Spin } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function SettingsClawd() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState({
    agent_base_url: '',
    agent_api_key: '',
    agent_model: '',
  });
  const [showKey, setShowKey] = useState(false);
  const [keyInput, setKeyInput] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/channel/clawd/setting');
      if (res.data.success) {
        const d = res.data.data || {};
        setCfg({
          agent_base_url: d.agent_base_url || '',
          agent_api_key: d.agent_api_key || '',
          agent_model: d.agent_model || '',
        });
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

  const handleFieldChange = (field, value) => {
    setCfg((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        agent_base_url: cfg.agent_base_url,
        agent_model: cfg.agent_model,
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

  return (
    <Spin spinning={loading}>
      <Form style={{ marginBottom: 15 }} key={cfg.agent_base_url + cfg.agent_model}>
        <Form.Section text={t('Clawd 智能体配置')}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Input
                field='agent_base_url'
                label={t('Agent Base URL')}
                placeholder='https://api.openai.com/v1'
                defaultValue={cfg.agent_base_url}
                onChange={(v) => handleFieldChange('agent_base_url', v)}
              />
            </Col>
            <Col xs={24} md={8}>
              <Form.Input
                field='agent_api_key'
                label={t('Agent API Key')}
                type={showKey ? 'text' : 'password'}
                placeholder={cfg.agent_api_key ? t('已配置，输入新值可覆盖') : 'sk-...'}
                value={keyInput}
                onChange={(v) => setKeyInput(v)}
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
            </Col>
            <Col xs={24} md={8}>
              <Form.Input
                field='agent_model'
                label={t('Agent 模型')}
                placeholder='gpt-4o'
                defaultValue={cfg.agent_model}
                onChange={(v) => handleFieldChange('agent_model', v)}
              />
            </Col>
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
        </Form.Section>
      </Form>
    </Spin>
  );
}