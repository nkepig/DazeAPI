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

import React, { useCallback, useEffect, useState } from 'react';
import { Avatar, Button, Card, InputNumber, Modal, Select, Spin, Typography } from '@douyinfe/semi-ui';
import { DollarSign } from 'lucide-react';
import { API, showError, showSuccess } from '../../../../helpers';

const createGroupItem = (group, ratio = 1) => ({
  id: `${Date.now()}-${Math.random()}`,
  name: group,
  ratio,
});

const DefaultRegistrationGroupRatioModal = ({ visible, onClose, t }) => {
  const { Text } = Typography;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [groupList, setGroupList] = useState([]);
  const [groupOverrides, setGroupOverrides] = useState({});
  const [groupOptions, setGroupOptions] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, groupsRes] = await Promise.all([
        API.get('/api/user/default-registration-group-ratio'),
        API.get('/api/group/'),
      ]);
      const res = configRes;
      const { success, message, data } = res.data;
      if (!success) {
        showError(message || t('加载失败'));
        return;
      }
      const ratioMap = data.default_registration_group_ratio || {};
      const nextGroupList = [];
      const nextOverrides = {};
      for (const [group, ratio] of Object.entries(ratioMap)) {
        const normalizedRatio = Number(ratio) > 0 ? Number(ratio) : 1;
        nextGroupList.push(createGroupItem(group, normalizedRatio));
        nextOverrides[group] = normalizedRatio;
      }
      const groups = groupsRes.data?.success ? groupsRes.data.data || [] : [];
      const optionGroups = Array.from(
        new Set([...groups, ...Object.keys(ratioMap)].filter(Boolean)),
      );
      setGroupOptions(
        optionGroups.map((group) => ({
          label: group,
          value: group,
        })),
      );
      setGroupList(nextGroupList);
      setGroupOverrides(nextOverrides);
    } catch (e) {
      showError(e.message || t('加载失败'));
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    if (visible) {
      load();
    }
  }, [visible, load]);

  const handleSave = async () => {
    const payload = {};
    for (const [group, ratioValue] of Object.entries(groupOverrides)) {
      const ratio = Number(ratioValue);
      if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 1000) {
        showError(t('倍率须在 (0, 1000] 之间'));
        return;
      }
      payload[group] = ratio;
    }
    setSaving(true);
    try {
      const res = await API.put('/api/user/default-registration-group-ratio', {
        default_registration_group_ratio: payload,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('保存成功'));
        onClose();
      } else {
        showError(message);
      }
    } catch (e) {
      showError(e.message || t('保存失败'));
    }
    setSaving(false);
  };

  return (
    <Modal
      title={t('注册用户默认可用分组及倍率')}
      visible={visible}
      onCancel={onClose}
      onOk={handleSave}
      okText={t('保存')}
      cancelText={t('取消')}
      confirmLoading={saving}
      width={680}
      maskClosable={false}
    >
      <Typography.Paragraph type='tertiary' className='!mb-4'>
        {t('保存后，新注册用户的 group_ratio 会按此配置初始化；留空则保存为空配置。')}
      </Typography.Paragraph>
      {loading ? (
        <div className='py-16 flex justify-center'>
          <Spin size='large' />
        </div>
      ) : (
        <Card className='!rounded-2xl shadow-sm border-0'>
          <div className='flex items-center mb-2'>
            <Avatar size='small' color='orange' className='mr-2 shadow-md'>
              <DollarSign size={16} />
            </Avatar>
            <div className='flex-1'>
              <Text className='text-lg font-medium'>{t('分组倍率配置')}</Text>
              <div className='text-xs text-gray-600'>
                {Object.keys(groupOverrides).length === 0
                  ? t('当前未配置默认可用分组')
                  : t('配置各分组的倍率，不在列表中的分组将不可用')}
              </div>
            </div>
          </div>
          <div className='space-y-2'>
            <div className='mb-3'>
              <Select
                placeholder={t('选择渠道分组')}
                value=''
                onChange={(value) => {
                  if (value && !groupOverrides[value]) {
                    setGroupList((prev) => [...prev, createGroupItem(value, 1)]);
                    setGroupOverrides((prev) => ({ ...prev, [value]: 1 }));
                  }
                }}
                optionList={groupOptions
                  .filter((option) => !groupOverrides[option.value])
                  .map((option) => ({ label: option.label, value: option.value }))}
                style={{ width: '100%' }}
                size='small'
              />
            </div>
            {groupList.length === 0 && (
              <Text type='secondary' size='small'>
                {t('暂无配置，从上方下拉选择分组')}
              </Text>
            )}
            {groupList.map((item, index) => (
              <div
                key={item.id || item.name}
                className='flex items-center gap-2 px-3 py-2 rounded-lg bg-[#fafafa] hover:bg-[#f5f5f5] transition-colors'
              >
                <Text strong style={{ minWidth: 80, fontSize: 13 }}>
                  {item.name}
                </Text>
                <InputNumber
                  min={0.01}
                  max={1000}
                  step={0.01}
                  precision={2}
                  value={item.ratio ?? 1}
                  onChange={(value) => {
                    const ratio = value == null ? 1 : Number(value.toFixed(2));
                    setGroupList((prev) => {
                      const next = [...prev];
                      next[index] = { ...next[index], ratio };
                      return next;
                    });
                    if (item.name) {
                      setGroupOverrides((prev) => ({ ...prev, [item.name]: ratio }));
                    }
                  }}
                  size='small'
                  style={{ width: 90 }}
                />
                <Button
                  type='danger'
                  size='small'
                  theme='borderless'
                  onClick={() => {
                    setGroupList((prev) => prev.filter((_, i) => i !== index));
                    if (item.name) {
                      setGroupOverrides((prev) => {
                        const next = { ...prev };
                        delete next[item.name];
                        return next;
                      });
                    }
                  }}
                >
                  {t('删除')}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </Modal>
  );
};

export default DefaultRegistrationGroupRatioModal;
