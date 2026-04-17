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

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Form,
  TextArea,
  Spin,
  Typography,
  Banner,
} from '@douyinfe/semi-ui';
import { IconSave, IconSetting } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import {
  API,
  showError,
  showSuccess,
  showWarning,
  verifyJSON,
} from '../../../../helpers';

const { Title, Text } = Typography;

const GroupConfigModal = ({ visible, onCancel, onSuccess }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState({
    GroupRatio: '',
    UserUsableGroups: '',
  });
  const [originalInputs, setOriginalInputs] = useState({});

  // Load current settings
  useEffect(() => {
    if (visible) {
      loadSettings();
    }
  }, [visible]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/option/');
      if (res.data.success) {
        const options = res.data.data;
        const newInputs = {
          GroupRatio: options.GroupRatio || '',
          UserUsableGroups: options.UserUsableGroups || '',
        };
        setInputs(newInputs);
        setOriginalInputs(newInputs);
      } else {
        showError(res.data.message || t('加载设置失败'));
      }
    } catch (error) {
      console.error('Failed to load group settings:', error);
      showError(t('加载设置失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const updates = [];
    
    if (inputs.GroupRatio !== originalInputs.GroupRatio) {
      updates.push({ key: 'GroupRatio', value: inputs.GroupRatio });
    }
    
    if (inputs.UserUsableGroups !== originalInputs.UserUsableGroups) {
      updates.push({ key: 'UserUsableGroups', value: inputs.UserUsableGroups });
    }

    if (updates.length === 0) {
      showWarning(t('你似乎并没有修改什么'));
      return;
    }

    // Validate JSON before saving
    for (const update of updates) {
      if (update.value && !verifyJSON(update.value)) {
        showError(t('{{key}} 不是合法的 JSON 字符串', { key: update.key }));
        return;
      }
    }

    setSaving(true);
    try {
      const promises = updates.map((update) =>
        API.put('/api/option/', update)
      );
      
      const results = await Promise.all(promises);
      
      let hasError = false;
      for (const res of results) {
        if (!res.data.success) {
          hasError = true;
          showError(res.data.message);
          break;
        }
      }

      if (!hasError) {
        showSuccess(t('保存成功'));
        setOriginalInputs(inputs);
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error) {
      console.error('Failed to save group settings:', error);
      showError(t('保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (key, value) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <IconSetting className="text-blue-500" />
          <span>{t('配置可用分组与倍率')}</span>
        </div>
      }
      visible={visible}
      onCancel={onCancel}
      width={700}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>{t('取消')}</Button>
          <Button
            type="primary"
            icon={<IconSave />}
            loading={saving}
            onClick={handleSave}
          >
            {t('保存')}
          </Button>
        </div>
      }
    >
      <Spin spinning={loading}>
        <div className="space-y-4">
          <Banner
            type="info"
            description={t(
              '在这里配置渠道可以选择的分组以及各分组的默认倍率。这些设置将应用于所有渠道。'
            )}
            className="mb-4"
          />

          <Form>
            <Form.TextArea
              label={
                <div>
                  <Title heading={6} className="mb-1">
                    {t('用户可选分组（可用分组）')}
                  </Title>
                  <Text type="secondary" size="small">
                    {t('渠道可以选择的分组列表')}
                  </Text>
                </div>
              }
              placeholder={t('例如：{"default": "默认分组", "vip": "VIP 分组"}')}
              extraText={t(
                '格式为 JSON 对象，键为分组名称，值为分组描述。渠道在编辑时将可以选择这些分组。'
              )}
              field="UserUsableGroups"
              value={inputs.UserUsableGroups}
              autosize={{ minRows: 5, maxRows: 10 }}
              onChange={(value) => handleInputChange('UserUsableGroups', value)}
              trigger="blur"
              rules={[
                {
                  validator: (rule, value) => {
                    if (!value || value.trim() === '') {
                      return true;
                    }
                    return verifyJSON(value);
                  },
                  message: t('必须是合法的 JSON 字符串'),
                },
              ]}
            />

            <Form.TextArea
              label={
                <div>
                  <Title heading={6} className="mb-1">
                    {t('分组默认倍率')}
                  </Title>
                  <Text type="secondary" size="small">
                    {t('各分组的计费倍率')}
                  </Text>
                </div>
              }
              placeholder={t('例如：{"default": 1, "vip": 0.5}')}
              extraText={t(
                '格式为 JSON 对象，键为分组名称，值为倍率（1 表示原价，0.5 表示五折）。倍率将影响该分组下所有渠道的计费。'
              )}
              field="GroupRatio"
              value={inputs.GroupRatio}
              autosize={{ minRows: 5, maxRows: 10 }}
              onChange={(value) => handleInputChange('GroupRatio', value)}
              trigger="blur"
              rules={[
                {
                  validator: (rule, value) => {
                    if (!value || value.trim() === '') {
                      return true;
                    }
                    return verifyJSON(value);
                  },
                  message: t('必须是合法的 JSON 字符串'),
                },
              ]}
            />
          </Form>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <Text strong>{t('示例配置：')}</Text>
            <div className="mt-2 space-y-2 text-sm">
              <div>
                <Text type="secondary">{t('用户可选分组：')}</Text>
                <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
{`{
  "default": "默认分组",
  "vip": "VIP 用户",
  "test": "测试分组"
}`}
                </pre>
              </div>
              <div>
                <Text type="secondary">{t('分组默认倍率：')}</Text>
                <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
{`{
  "default": 1.0,
  "vip": 0.5,
  "test": 0.8
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </Spin>
    </Modal>
  );
};

export default GroupConfigModal;
