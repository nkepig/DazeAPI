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

import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  API,
  showError,
  showSuccess,
  getCurrencyConfig,
  isAdmin,
} from '../../../../helpers';
import {
  quotaToDisplayAmount,
  displayAmountToQuota,
} from '../../../../helpers/quota';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import {
  Button,
  Modal,
  Spin,
  Form,
  InputNumber,
  Select,
} from '@douyinfe/semi-ui';
import { ChevronDown } from 'lucide-react';

const EditUserModal = (props) => {
  const { t } = useTranslation();
  const userId = props.editingUser.id;
  const [loading, setLoading] = useState(true);
  const [addQuotaModalOpen, setIsModalOpen] = useState(false);
  const [addAmountLocal, setAddAmountLocal] = useState('');
  const [pendingQuotaDelta, setPendingQuotaDelta] = useState(0);
  const isMobile = useIsMobile();
  const formApiRef = useRef(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [groupOverrides, setGroupOverrides] = useState({});
  const [groupList, setGroupList] = useState([]);
  const [availableGroups, setAvailableGroups] = useState([]);

  const isEdit = Boolean(userId);

  const getInitValues = () => ({
    username: '',
    display_name: '',
    password: '',
    email: '',
    quota: 0,
    remark: '',
  });

  const handleCancel = () => props.handleClose();

  const loadUser = async () => {
    setLoading(true);
    try {
      const groupRes = await API.get('/api/group/');
      if (groupRes.data?.success) {
        setAvailableGroups(groupRes.data.data || []);
      }
    } catch (e) {
      // non-critical
    }

    const url = userId ? `/api/user/${userId}` : `/api/user/self`;
    const res = await API.get(url);
    const { success, message, data } = res.data;
    if (success) {
      data.password = '';
      data.quota = quotaToDisplayAmount(data.quota || 0);
      setPendingQuotaDelta(0);
      const groupEntries = [];
      const overrides = {};
      if (data.group_ratio) {
        try {
          const parsed = typeof data.group_ratio === 'string' ? JSON.parse(data.group_ratio) : data.group_ratio;
          let idCounter = 0;
          for (const [g, v] of Object.entries(parsed)) {
            const ratio = typeof v === 'number' ? Number(v.toFixed(2)) : 1;
            groupEntries.push({
              id: `existing-${idCounter++}`,
              name: g,
              ratio,
              isNew: false,
            });
            overrides[g] = ratio;
          }
        } catch (e) {
          console.error('Failed to parse group_ratio:', e);
        }
      }
      setGroupList(groupEntries);
      setGroupOverrides(overrides);
      setAdvancedOpen(groupEntries.length > 0);
      formApiRef.current?.setValues({ ...getInitValues(), ...data });
    } else {
      showError(message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUser();
  }, [props.editingUser.id]);

  const submit = async (values) => {
    setLoading(true);
    const payload = { ...values };
    payload.quota = displayAmountToQuota(payload.quota || 0);
    if (userId) {
      payload.id = parseInt(userId);
      const delta = Number(pendingQuotaDelta || 0);
      if (delta !== 0) {
        payload.quota_delta = displayAmountToQuota(delta);
      }
      if (isAdmin()) {
        const fullGroupRatio = {};
        groupList.forEach((item) => {
          if (item.name && item.name.trim() !== '') {
            fullGroupRatio[item.name.trim()] = Number((item.ratio ?? 1).toFixed(2));
          }
        });
        payload.group_ratio = JSON.stringify(fullGroupRatio);
      }
    }
    const url = userId ? `/api/user/` : `/api/user/self`;
    const res = await API.put(url, payload);
    const { success, message } = res.data;
    if (success) {
      showSuccess(t('用户信息更新成功！'));
      props.refresh();
      props.handleClose();
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const addLocalQuota = () => {
    const current = formApiRef.current?.getValue('quota') || 0;
    const delta = parseFloat(addAmountLocal) || 0;
    formApiRef.current?.setValue('quota', Number((current + delta).toFixed(2)));
    setPendingQuotaDelta((prev) => prev + delta);
  };

  return (
    <>
      <Modal
        className='compact-modal'
        title={isEdit ? t('编辑用户') : t('创建用户')}
        visible={props.visible}
        onCancel={handleCancel}
        width={isMobile ? '100%' : 420}
        centered
        closable
        maskClosable={false}
        footer={
          <div className='flex justify-end gap-2'>
            <Button theme='light' type='tertiary' onClick={handleCancel}>
              {t('取消')}
            </Button>
            <Button
              theme='solid'
              type='primary'
              loading={loading}
              onClick={() => formApiRef.current?.submitForm()}
            >
              {t('保存')}
            </Button>
          </div>
        }
      >
        <Spin spinning={loading}>
          <Form
            className='compact-form'
            initValues={getInitValues()}
            getFormApi={(api) => (formApiRef.current = api)}
            onSubmit={submit}
          >
            {() => (
              <>
                <Form.Input
                  field='username'
                  label={t('用户名')}
                  placeholder={t('登录名')}
                  rules={[{ required: true, message: t('请输入用户名') }]}
                  showClear
                />
                <Form.Input
                  field='password'
                  label={t('密码')}
                  placeholder={t('留空则不修改')}
                  mode='password'
                  showClear
                />
                <Form.Input
                  field='display_name'
                  label={t('显示名称')}
                  placeholder={t('可选')}
                  showClear
                />
                <Form.Input
                  field='remark'
                  label={t('备注')}
                  placeholder={t('仅管理员可见')}
                  showClear
                />

                {userId && (
                  <div className='flex items-end gap-2'>
                    <div className='flex-1 min-w-0'>
                      <Form.InputNumber
                        field='quota'
                        label={t('余额')}
                        step={1}
                        precision={2}
                        disabled
                        hideButtons
                        style={{ width: '100%' }}
                      />
                    </div>
                    <Button
                      style={{ marginBottom: 14 }}
                      onClick={() => setIsModalOpen(true)}
                    >
                      {t('调整')}
                    </Button>
                  </div>
                )}

                {userId && isAdmin() && (
                  <>
                    <button
                      type='button'
                      className='compact-advanced-toggle'
                      onClick={() => setAdvancedOpen((v) => !v)}
                    >
                      <span>{t('高级 · 分组倍率')}</span>
                      <ChevronDown
                        size={14}
                        style={{
                          transform: advancedOpen ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.15s',
                        }}
                      />
                    </button>
                    {advancedOpen && (
                      <div className='pt-2 pb-2'>
                        <Select
                          placeholder={t('添加分组')}
                          value=''
                          onChange={(value) => {
                            if (value && !groupOverrides[value]) {
                              setGroupList((prev) => [
                                ...prev,
                                { id: `channel-${value}`, name: value, ratio: 1.0, isNew: false },
                              ]);
                              setGroupOverrides((prev) => ({ ...prev, [value]: 1.0 }));
                            }
                          }}
                          optionList={availableGroups
                            .filter((g) => !groupOverrides[g])
                            .map((g) => ({ label: g, value: g }))}
                          style={{ width: '100%', marginBottom: 8 }}
                          size='small'
                        />
                        {groupList.map((item, index) => (
                          <div
                            key={item.id || item.name}
                            className='flex items-center gap-2 py-2 border-b border-[#F0F0F0]'
                          >
                            <span className='text-[13px] font-medium min-w-[72px]'>
                              {item.name}
                            </span>
                            <InputNumber
                              min={0.01}
                              max={1000}
                              step={0.01}
                              precision={2}
                              value={item.ratio ?? 1}
                              onChange={(v) => {
                                const ratio = v == null ? 1 : Number(v.toFixed(2));
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
                            <button
                              type='button'
                              className='text-[12px] text-[#999] bg-transparent border-0 cursor-pointer hover:text-[#1A1A1A]'
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
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </Form>
        </Spin>
      </Modal>

      <Modal
        className='compact-modal'
        centered
        visible={addQuotaModalOpen}
        onOk={() => {
          addLocalQuota();
          setIsModalOpen(false);
          setAddAmountLocal('');
        }}
        onCancel={() => setIsModalOpen(false)}
        title={t('调整余额')}
        okText={t('确定')}
        cancelText={t('取消')}
        width={360}
      >
        {(() => {
          const current = formApiRef.current?.getValue('quota') || 0;
          const addVal = parseFloat(addAmountLocal) || 0;
          return (
            <p className='text-[13px] text-[#666] mb-3'>
              {t('新额度：')}{getCurrencyConfig().symbol}{(current + addVal).toFixed(2)}
            </p>
          );
        })()}
        <p className='compact-hint'>{t('正数增加，负数减少。提交时按最新余额增减，不会覆盖期间消耗。')}</p>
        <InputNumber
          min={-999999999}
          prefix={getCurrencyConfig().symbol}
          placeholder={t('金额')}
          value={addAmountLocal}
          precision={2}
          onChange={(val) => setAddAmountLocal(val ?? '')}
          style={{ width: '100%' }}
          showClear
        />
      </Modal>
    </>
  );
};

export default EditUserModal;
