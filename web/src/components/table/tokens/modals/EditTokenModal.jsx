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
import {
  API,
  showError,
  showSuccess,
} from '../../../../helpers';
import { quotaToDisplayAmount, displayAmountToQuota } from '../../../../helpers/quota';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import { Button, Modal, Spin, Form } from '@douyinfe/semi-ui';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const EditTokenModal = (props) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [userGroups, setUserGroups] = useState([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const isMobile = useIsMobile();
  const formApiRef = useRef(null);
  const isEdit = props.editingToken.id !== undefined;

  const getInitValues = () => ({
    name: '',
    remain_quota: 0,
    unlimited_quota: true,
    group: '',
    allow_ips: '',
    block_ips: '',
  });

  const loadUserGroups = async () => {
    try {
      const res = await API.get('/api/user/self/groups');
      if (res.data.success) {
        const groups = res.data.data || {};
        setUserGroups(
          Object.entries(groups).map(([name, info]) => ({
            label: info.desc ? `${name} · ${info.desc}` : name,
            value: name,
            ...info,
          })),
        );
      }
    } catch (error) {
      console.error('Failed to load user groups:', error);
    }
  };

  const handleCancel = () => {
    props.handleClose();
  };

  const loadToken = async () => {
    setLoading(true);
    const res = await API.get(`/api/token/${props.editingToken.id}`);
    const { success, message, data } = res.data;
    if (success) {
      data.remain_quota = quotaToDisplayAmount(data.remain_quota || 0);
      formApiRef.current?.setValues({ ...getInitValues(), ...data });
      if ((data.allow_ips || data.block_ips)) {
        setAdvancedOpen(true);
      }
    } else {
      showError(message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (props.visiable) {
      loadUserGroups();
      setAdvancedOpen(false);
      if (isEdit) {
        loadToken();
      } else {
        formApiRef.current?.setValues(getInitValues());
      }
    } else {
      formApiRef.current?.reset();
    }
  }, [props.visiable, props.editingToken.id]);

  const submit = async (values) => {
    setLoading(true);
    const localInputs = { ...values };
    localInputs.remain_quota = displayAmountToQuota(localInputs.remain_quota);
    if (isEdit) {
      const res = await API.put(`/api/token/`, {
        ...localInputs,
        id: parseInt(props.editingToken.id),
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('令牌更新成功！'));
        props.refresh();
        props.handleClose();
      } else {
        showError(t(message));
      }
    } else {
      localInputs.name =
        (values.name || '').trim() === '' ? 'default' : values.name.trim();
      const res = await API.post(`/api/token/`, localInputs);
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('令牌创建成功，请在列表页面点击复制获取令牌！'));
        props.refresh();
        props.handleClose();
      } else {
        showError(t(message));
      }
    }
    setLoading(false);
    formApiRef.current?.setValues(getInitValues());
  };

  return (
    <Modal
      className='compact-modal'
      title={isEdit ? t('编辑令牌') : t('添加令牌')}
      visible={props.visiable}
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
          key={isEdit ? 'edit' : 'new'}
          initValues={getInitValues()}
          getFormApi={(api) => (formApiRef.current = api)}
          onSubmit={submit}
        >
          {({ values }) => (
            <>
              <Form.Input
                field='name'
                label={t('名称')}
                placeholder={t('我的令牌')}
                rules={[{ required: true, message: t('请输入名称') }]}
                showClear
              />
              <Form.Select
                field='group'
                label={t('分组')}
                placeholder={t('默认')}
                optionList={userGroups}
                showClear
                filter
                style={{ width: '100%' }}
              />
              <div className='flex items-end gap-3'>
                <div className='flex-1 min-w-0'>
                  <Form.InputNumber
                    field='remain_quota'
                    label={t('额度')}
                    placeholder='0.00'
                    disabled={values.unlimited_quota}
                    step={1}
                    precision={2}
                    hideButtons
                    style={{ width: '100%' }}
                    rules={
                      values.unlimited_quota
                        ? []
                        : [{ required: true, message: t('请输入额度') }]
                    }
                  />
                </div>
                <Form.Switch
                  field='unlimited_quota'
                  label={t('无限')}
                  style={{ marginBottom: 14 }}
                />
              </div>

              <button
                type='button'
                className='compact-advanced-toggle'
                onClick={() => setAdvancedOpen((v) => !v)}
              >
                <span>{t('高级 · IP 限制')}</span>
                <ChevronDown
                  size={14}
                  style={{
                    transform: advancedOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s',
                  }}
                />
              </button>
              {advancedOpen && (
                <div className='pt-2'>
                  <Form.TextArea
                    field='allow_ips'
                    label={t('IP 白名单')}
                    placeholder={'1.2.3.4\n10.0.0.0/8'}
                    autosize
                    rows={2}
                  />
                  <Form.TextArea
                    field='block_ips'
                    label={t('IP 黑名单')}
                    placeholder={'5.6.7.8\n192.168.0.0/16'}
                    autosize
                    rows={2}
                  />
                </div>
              )}
            </>
          )}
        </Form>
      </Spin>
    </Modal>
  );
};

export default EditTokenModal;
