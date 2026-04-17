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
  renderQuota,
  renderQuotaWithPrompt,
  getCurrencyConfig,
  isRoot,
} from '../../../../helpers';
import {
  quotaToDisplayAmount,
  displayAmountToQuota,
} from '../../../../helpers/quota';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import {
  Button,
  Modal,
  SideSheet,
  Space,
  Spin,
  Typography,
  Card,
  Tag,
  Form,
  Avatar,
  Row,
  Col,
  InputNumber,
  Select,
} from '@douyinfe/semi-ui';
import {
  IconUser,
  IconSave,
  IconClose,
  IconUserGroup,
  IconPlus,
} from '@douyinfe/semi-icons';
import { DollarSign } from 'lucide-react';

const { Text, Title } = Typography;

const EditUserModal = (props) => {
  const { t } = useTranslation();
  const userId = props.editingUser.id;
  const [loading, setLoading] = useState(true);
  const [addQuotaModalOpen, setIsModalOpen] = useState(false);
  const [addQuotaLocal, setAddQuotaLocal] = useState('');
  const [addAmountLocal, setAddAmountLocal] = useState('');
  const [originalQuota, setOriginalQuota] = useState(0);
  const [pendingQuotaDelta, setPendingQuotaDelta] = useState(0);
  const [userGroup, setUserGroup] = useState('');
  const isMobile = useIsMobile();
  const formApiRef = useRef(null);

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
      setOriginalQuota(data.quota || 0);
      setPendingQuotaDelta(0);
      setUserGroup(data.group || data.username || '');
      const groupEntries = [];
      const overrides = {};
      if (data.group_ratio) {
        try {
          const parsed = typeof data.group_ratio === 'string' ? JSON.parse(data.group_ratio) : data.group_ratio;
          let idCounter = 0;
          for (const [g, v] of Object.entries(parsed)) {
            const ratio = typeof v === 'number' ? v : 1;
            groupEntries.push({
              id: `existing-${idCounter++}`,
              name: g,
              ratio: ratio,
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
    let payload = { ...values };
    if (typeof payload.quota === 'string')
      payload.quota = parseInt(payload.quota) || 0;
    if (userId) {
      payload.id = parseInt(userId);
      if (
        pendingQuotaDelta !== 0 &&
        Number(payload.quota || 0) === originalQuota + pendingQuotaDelta
      ) {
        payload.quota_delta = pendingQuotaDelta;
      }
      if (isRoot()) {
        const fullGroupRatio = {};
        groupList.forEach((item) => {
          if (item.name && item.name.trim() !== '') {
            fullGroupRatio[item.name.trim()] = item.ratio ?? 1;
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
    const current = parseInt(formApiRef.current?.getValue('quota') || 0);
    const delta = parseInt(addQuotaLocal) || 0;
    formApiRef.current?.setValue('quota', current + delta);
    setPendingQuotaDelta((prev) => prev + delta);
  };

  return (
    <>
      <SideSheet
        placement='right'
        title={
          <Space>
            <Tag color='blue' shape='circle'>
              {t(isEdit ? '编辑' : '新建')}
            </Tag>
            <Title heading={4} className='m-0'>
              {isEdit ? t('编辑用户') : t('创建用户')}
            </Title>
          </Space>
        }
        bodyStyle={{ padding: 0 }}
        visible={props.visible}
        width={isMobile ? '100%' : 640}
        footer={
          <div className='flex justify-end bg-white'>
            <Space>
              <Button
                theme='solid'
                onClick={() => formApiRef.current?.submitForm()}
                icon={<IconSave />}
                loading={loading}
              >
                {t('提交')}
              </Button>
              <Button
                theme='light'
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
        onCancel={handleCancel}
      >
        <Spin spinning={loading}>
          <Form
            initValues={getInitValues()}
            getFormApi={(api) => (formApiRef.current = api)}
            onSubmit={submit}
          >
            {({ values }) => (
              <div className='p-2 space-y-3'>
                {/* 基本信息 */}
                <Card className='!rounded-2xl shadow-sm border-0'>
                  <div className='flex items-center mb-2'>
                    <Avatar size='small' color='blue' className='mr-2 shadow-md'>
                      <IconUser size={16} />
                    </Avatar>
                    <div>
                      <Text className='text-lg font-medium'>{t('基本信息')}</Text>
                      <div className='text-xs text-gray-600'>{t('用户的基本账户信息')}</div>
                    </div>
                  </div>
                  <Row gutter={12}>
                    <Col span={24}>
                       <Form.Input
                        field='username'
                        label={<span style={{fontSize: '12px', fontWeight: 600}}>{t('用户名')}</span>}
                        placeholder={t('新用户名')}
                        rules={[{ required: true, message: t('请输入用户名') }]}
                        showClear
                      />
                    </Col>
                    <Col span={24}>
                       <Form.Input
                        field='password'
                        label={<span style={{fontSize: '12px', fontWeight: 600}}>{t('密码')}</span>}
                        placeholder={t('新密码')}
                        mode='password'
                        showClear
                      />
                    </Col>
                    <Col span={24}>
                       <Form.Input
                        field='display_name'
                        label={<span style={{fontSize: '12px', fontWeight: 600}}>{t('显示名称')}</span>}
                        placeholder={t('新显示名')}
                        showClear
                      />
                    </Col>
                    <Col span={24}>
                      <Form.Input
                        field='remark'
                        label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('备注')}</span>}
                        placeholder={t('管理员可见')}
                        showClear
                      />
                    </Col>
                  </Row>
                </Card>

                {/* 权限设置 */}
                {userId && (
                  <Card className='!rounded-2xl shadow-sm border-0'>
                    <div className='flex items-center mb-2'>
                      <Avatar size='small' color='green' className='mr-2 shadow-md'>
                        <IconUserGroup size={16} />
                      </Avatar>
                    <div>
                      <Text className='text-lg font-medium'>{t('权限设置')}</Text>
                      <div className='text-xs text-gray-600'>{t('用户额度管理')}</div>
                    </div>
                    </div>
                    <Row gutter={12}>
                      <Col span={10}>
                        <Form.InputNumber
                          field='quota'
                          label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('剩余额度')}</span>}
                          placeholder={t('剩余额度')}
                          step={500000}
                          extraText={renderQuotaWithPrompt(values.quota || 0)}
                          rules={[{ required: true, message: t('请输入额度') }]}
                          style={{ width: '100%' }}
                        />
                      </Col>
                      <Col span={14}>
                        <Form.Slot label={<span style={{fontSize: '12px', fontWeight: 600, color: '#000'}}>{t('添加额度')}</span>}>
                          <Button icon={<IconPlus />} onClick={() => setIsModalOpen(true)} />
                        </Form.Slot>
                      </Col>
                    </Row>
                  </Card>
                )}

                {/* 分组倍率配置 — 仅超级管理员可见 */}
                {userId && isRoot() && (
                  <Card className='!rounded-2xl shadow-sm border-0'>
                    <div className='flex items-center mb-2'>
                      <Avatar size='small' color='orange' className='mr-2 shadow-md'>
                        <DollarSign size={16} />
                      </Avatar>
                      <div className='flex-1'>
                        <Text className='text-lg font-medium'>{t('分组倍率配置')}</Text>
                        <div className='text-xs text-gray-600'>
                          {Object.keys(groupOverrides).length === 0
                            ? t('当前为测试用户状态，所有分组可用，倍率为1')
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
                              setGroupList((prev) => [...prev, { id: `channel-${value}`, name: value, ratio: 1, isNew: false }]);
                              setGroupOverrides((prev) => ({ ...prev, [value]: 1 }));
                            }
                          }}
                          optionList={availableGroups
                            .filter((g) => !groupOverrides[g])
                            .map((g) => ({ label: g, value: g }))}
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
                            step={0.1}
                            value={item.ratio ?? 1}
                            onChange={(v) => {
                              const ratio = v ?? 1;
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
              </div>
            )}
          </Form>
        </Spin>
      </SideSheet>

      {/* 添加额度模态框 */}
      <Modal
        centered
        visible={addQuotaModalOpen}
        onOk={() => {
          addLocalQuota();
          setIsModalOpen(false);
          setAddQuotaLocal('');
          setAddAmountLocal('');
        }}
        onCancel={() => setIsModalOpen(false)}
        closable={null}
        title={
          <div className='flex items-center'>
            <IconPlus className='mr-2' />
            {t('添加额度')}
          </div>
        }
      >
        <div className='mb-4'>
          {(() => {
            const current = formApiRef.current?.getValue('quota') || 0;
            return (
              <Text type='secondary' className='block mb-2'>
                {`${t('新额度：')}${renderQuota(current)} + ${renderQuota(addQuotaLocal)} = ${renderQuota(current + parseInt(addQuotaLocal || 0))}`}
              </Text>
            );
          })()}
        </div>
        {getCurrencyConfig().type !== 'TOKENS' && (
          <div className='mb-3'>
            <div className='mb-1'>
              <Text size='small'>{t('金额')}</Text>
              <Text size='small' type='tertiary'>
                {' '}({t('仅用于换算，实际保存的是额度')})
              </Text>
            </div>
            <InputNumber
              prefix={getCurrencyConfig().symbol}
              placeholder={t('输入金额')}
              value={addAmountLocal}
              precision={2}
              onChange={(val) => {
                setAddAmountLocal(val);
                setAddQuotaLocal(
                  val != null && val !== ''
                    ? displayAmountToQuota(Math.abs(val)) * Math.sign(val)
                    : '',
                );
              }}
              style={{ width: '100%' }}
              showClear
            />
          </div>
        )}
        <div>
          <div className='mb-1'>
            <Text size='small'>{t('额度')}</Text>
          </div>
          <InputNumber
            placeholder={t('输入额度')}
            value={addQuotaLocal}
            onChange={(val) => {
              setAddQuotaLocal(val);
              setAddAmountLocal(
                val != null && val !== ''
                  ? Number(
                      (quotaToDisplayAmount(Math.abs(val)) * Math.sign(val)).toFixed(2),
                    )
                  : '',
              );
            }}
            style={{ width: '100%' }}
            showClear
            step={500000}
          />
        </div>
      </Modal>
    </>
  );
};

export default EditUserModal;
