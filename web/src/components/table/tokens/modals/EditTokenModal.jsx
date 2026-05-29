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
  getCurrencyConfig,
} from '../../../../helpers';
import { quotaToDisplayAmount, displayAmountToQuota } from '../../../../helpers/quota';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import {
  Button,
  SideSheet,
  Space,
  Spin,
  Typography,
  Card,
  Tag,
  Avatar,
  Form,
  Col,
  Row,
} from '@douyinfe/semi-ui';
import { StatusPill } from '../../../common/ui/StatusPill';
import {
  IconCreditCard,
  IconSave,
  IconClose,
  IconKey,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

const { Text, Title } = Typography;

const EditTokenModal = (props) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [userGroups, setUserGroups] = useState([]);
  const isMobile = useIsMobile();
  const formApiRef = useRef(null);
  const isEdit = props.editingToken.id !== undefined;

  const getInitValues = () => ({
    name: '',
    remain_quota: 0,
    unlimited_quota: true,
    group: '',
  });

  const { symbol } = getCurrencyConfig();

  const loadUserGroups = async () => {
    try {
      const res = await API.get('/api/user/self/groups');
      if (res.data.success) {
        const groups = res.data.data || {};
        const groupOptions = Object.entries(groups).map(([name, info]) => ({
          label: `${name}${info.desc ? ' - ' + info.desc : ''}`,
          value: name,
          ...info,
        }));
        setUserGroups(groupOptions);
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
    let res = await API.get(`/api/token/${props.editingToken.id}`);
    const { success, message, data } = res.data;
    if (success) {
      data.remain_quota = quotaToDisplayAmount(data.remain_quota || 0);
      if (formApiRef.current) {
        formApiRef.current.setValues({ ...getInitValues(), ...data });
      }
    } else {
      showError(message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (formApiRef.current) {
      if (!isEdit) {
        formApiRef.current.setValues(getInitValues());
      }
    }
  }, [props.editingToken.id]);

  useEffect(() => {
    if (props.visiable) {
      loadUserGroups();
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
    if (isEdit) {
      const { ...localInputs } = values;
      localInputs.remain_quota = displayAmountToQuota(localInputs.remain_quota);
      let res = await API.put(`/api/token/`, {
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
      const { ...localInputs } = values;
      const baseName =
        values.name.trim() === '' ? 'default' : values.name.trim();
      localInputs.name = baseName;
      localInputs.remain_quota = 0;
      localInputs.unlimited_quota = true;
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
    <SideSheet
      placement={isEdit ? 'right' : 'left'}
      title={
        <Space>
          {isEdit ? (
            <StatusPill variant='info'>{t('更新')}</StatusPill>
          ) : (
            <StatusPill variant='success'>{t('新建')}</StatusPill>
          )}
          <Title heading={4} className='m-0'>
            {isEdit ? t('更新令牌信息') : t('创建新的令牌')}
          </Title>
        </Space>
      }
      bodyStyle={{ padding: '0' }}
      visible={props.visiable}
      width={isMobile ? '100%' : 600}
      footer={
        <div className='flex justify-end bg-white'>
          <Space>
            <Button
              theme='solid'
              className='!rounded-lg'
              onClick={() => formApiRef.current?.submitForm()}
              icon={<IconSave />}
              loading={loading}
            >
              {t('提交')}
            </Button>
            <Button
              theme='light'
              className='!rounded-lg'
              type='primary'
              onClick={handleCancel}
              icon={<IconClose />}
            >
              {t('取消')}
            </Button>
          </Space>
        </div>
      }
      closeIcon={null}
      onCancel={() => handleCancel()}
    >
      <Spin spinning={loading}>
        <Form
          key={isEdit ? 'edit' : 'new'}
          initValues={getInitValues()}
          getFormApi={(api) => (formApiRef.current = api)}
          onSubmit={submit}
        >
          {({ values }) => (
            <div className='p-2'>
              {/* 基本信息 */}
              <Card className='!rounded-2xl shadow-sm border-0'>
                <div className='flex items-center mb-2'>
                  <Avatar size='small' color='blue' className='mr-2 shadow-md'>
                    <IconKey size={16} />
                  </Avatar>
                  <div>
                    <Text className='text-lg font-medium'>{t('基本信息')}</Text>
                    <div className='text-xs text-gray-600'>
                      {t('设置令牌的基本信息')}
                    </div>
                  </div>
                </div>
                <Row gutter={12}>
                  <Col span={24}>
                    <Form.Input
                      field='name'
                      label={t('名称')}
                      placeholder={t('请输入名称')}
                      rules={[{ required: true, message: t('请输入名称') }]}
                      showClear
                    />
                  </Col>
                  <Col span={24}>
                    <Form.Select
                      field='group'
                      label={t('分组')}
                      placeholder={t('请选择分组')}
                      optionList={userGroups}
                      showClear
                      filter
                      style={{ width: '100%' }}
                      extraText={t('选择分组以应用对应的分组折扣')}
                    />
                  </Col>
                </Row>
              </Card>

              {isEdit && (
                <Card className='!rounded-2xl shadow-sm border-0'>
                  <div className='flex items-center mb-2'>
                    <Avatar size='small' color='green' className='mr-2 shadow-md'>
                      <IconCreditCard size={16} />
                    </Avatar>
                    <div>
                      <Text className='text-lg font-medium'>{t('额度设置')}</Text>
                      <div className='text-xs text-gray-600'>
                        {t('设置令牌可用额度')}
                      </div>
                    </div>
                  </div>
                  <Row gutter={12}>
                    <Col span={24}>
                      <Form.InputNumber
                        field='remain_quota'
                        label={t('额度')}
                        placeholder={t('请输入额度')}
                        type='number'
                        disabled={values.unlimited_quota}
                        extraText={
                          values.unlimited_quota
                            ? ''
                            : `${symbol}${(values.remain_quota || 0).toFixed(2)}`
                        }
                        step={1}
                        precision={2}
                        rules={
                          values.unlimited_quota
                            ? []
                            : [{ required: true, message: t('请输入额度') }]
                        }
                      />
                    </Col>
                    <Col span={24}>
                      <Form.Switch
                        field='unlimited_quota'
                        label={t('无限额度')}
                        size='default'
                        extraText={t(
                          '令牌的额度仅用于限制令牌本身的最大额度使用量，实际的使用受到账户的剩余额度限制',
                        )}
                      />
                    </Col>
                  </Row>
                </Card>
              )}

            </div>
          )}
        </Form>
      </Spin>
    </SideSheet>
  );
};

export default EditTokenModal;
