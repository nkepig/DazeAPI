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

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
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
  Input,
  Select,
  Checkbox,
  Banner,
  Empty,
} from '@douyinfe/semi-ui';
import {
  IconUser,
  IconSave,
  IconClose,
  IconUserGroup,
  IconPlus,
  IconSearch,
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
  const isMobile = useIsMobile();
  const formApiRef = useRef(null);

  // model overrides state
  const [globalModels, setGlobalModels] = useState([]);
  const [modelOverrides, setModelOverrides] = useState({});
  const [overridesSaving, setOverridesSaving] = useState(false);
  const [overridesHasChanges, setOverridesHasChanges] = useState(false);
  const [modelSearch, setModelSearch] = useState('');

  const isEdit = Boolean(userId);

  const getInitValues = () => ({
    username: '',
    display_name: '',
    password: '',
    email: '',
    quota: 0,
    remark: '',
  });

  const loadModelOverrides = useCallback(async (uid) => {
    if (!uid || !isRoot()) return;
    try {
      const res = await API.get(`/api/user/${uid}/model-overrides`);
      if (res.data.success) {
        const { model_overrides, global_models } = res.data.data;
        const gm = global_models || [];
        setGlobalModels(gm);
        if (model_overrides && Object.keys(model_overrides).length > 0) {
          setModelOverrides(model_overrides);
          setOverridesHasChanges(false);
        } else {
          // 与后端一致：空 overrides 表示不限制，实际可用模型由分组+渠道 abilities 决定；
          // 不要用全局倍率表全选预填，否则会误显「已勾选」已下线的模型。
          setModelOverrides({});
          setOverridesHasChanges(false);
        }
      }
    } catch (e) {
      /* ignore */
    }
  }, []);

  const saveModelOverrides = async () => {
    if (!userId) return;
    setOverridesSaving(true);
    try {
      const res = await API.put(`/api/user/${userId}/model-overrides`, {
        model_overrides: modelOverrides,
      });
      if (res.data.success) {
        showSuccess(t('模型配置保存成功'));
        setOverridesHasChanges(false);
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e.message);
    }
    setOverridesSaving(false);
  };

  const toggleModel = (modelName) => {
    setModelOverrides((prev) => {
      const next = { ...prev };
      if (next[modelName]) {
        delete next[modelName];
      } else {
        next[modelName] = { billing_type: 'ratio', value: 1 };
      }
      return next;
    });
    setOverridesHasChanges(true);
  };

  const updateOverride = (modelName, field, value) => {
    setModelOverrides((prev) => ({
      ...prev,
      [modelName]: { ...prev[modelName], [field]: value },
    }));
    setOverridesHasChanges(true);
  };

  const selectAll = () => {
    const newOverrides = { ...modelOverrides };
    filteredModels.forEach((m) => {
      if (!newOverrides[m.model]) {
        newOverrides[m.model] = { billing_type: 'ratio', value: 1 };
      }
    });
    setModelOverrides(newOverrides);
    setOverridesHasChanges(true);
  };

  const deselectAll = () => {
    const newOverrides = { ...modelOverrides };
    filteredModels.forEach((m) => {
      delete newOverrides[m.model];
    });
    setModelOverrides(newOverrides);
    setOverridesHasChanges(true);
  };

  const handleCancel = () => props.handleClose();

  const loadUser = async () => {
    setLoading(true);
    const url = userId ? `/api/user/${userId}` : `/api/user/self`;
    const res = await API.get(url);
    const { success, message, data } = res.data;
    if (success) {
      data.password = '';
      formApiRef.current?.setValues({ ...getInitValues(), ...data });
    } else {
      showError(message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUser();
    if (userId) {
      loadModelOverrides(userId);
    }
    setModelSearch('');
  }, [props.editingUser.id]);

  const submit = async (values) => {
    setLoading(true);
    let payload = { ...values };
    if (typeof payload.quota === 'string')
      payload.quota = parseInt(payload.quota) || 0;
    if (userId) {
      payload.id = parseInt(userId);
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
  };

  // merge global models with user overrides for display, deduped
  const allModels = useMemo(() => {
    const map = new Map();
    globalModels.forEach((m) => {
      map.set(m.model, m);
    });
    // models in overrides but not in global list
    Object.keys(modelOverrides).forEach((name) => {
      if (!map.has(name)) {
        const o = modelOverrides[name];
        map.set(name, { model: name, billing_type: o.billing_type, value: o.value });
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      const aEnabled = !!modelOverrides[a.model];
      const bEnabled = !!modelOverrides[b.model];
      if (aEnabled !== bEnabled) return aEnabled ? -1 : 1;
      return a.model.localeCompare(b.model);
    });
  }, [globalModels, modelOverrides]);

  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) return allModels;
    const q = modelSearch.toLowerCase();
    return allModels.filter((m) => m.model.toLowerCase().includes(q));
  }, [allModels, modelSearch]);

  const enabledCount = Object.keys(modelOverrides).length;

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
                        label={t('用户名')}
                        placeholder={t('请输入新的用户名')}
                        rules={[{ required: true, message: t('请输入用户名') }]}
                        showClear
                      />
                    </Col>
                    <Col span={24}>
                      <Form.Input
                        field='password'
                        label={t('密码')}
                        placeholder={t('请输入新的密码，最短 8 位')}
                        mode='password'
                        showClear
                      />
                    </Col>
                    <Col span={24}>
                      <Form.Input
                        field='display_name'
                        label={t('显示名称')}
                        placeholder={t('请输入新的显示名称')}
                        showClear
                      />
                    </Col>
                    <Col span={24}>
                      <Form.Input
                        field='remark'
                        label={t('备注')}
                        placeholder={t('请输入备注（仅管理员可见）')}
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
                          label={t('剩余额度')}
                          placeholder={t('请输入新的剩余额度')}
                          step={500000}
                          extraText={renderQuotaWithPrompt(values.quota || 0)}
                          rules={[{ required: true, message: t('请输入额度') }]}
                          style={{ width: '100%' }}
                        />
                      </Col>
                      <Col span={14}>
                        <Form.Slot label={t('添加额度')}>
                          <Button icon={<IconPlus />} onClick={() => setIsModalOpen(true)} />
                        </Form.Slot>
                      </Col>
                    </Row>
                  </Card>
                )}

                {/* 模型与计费配置 — 仅超级管理员可见 */}
                {userId && isRoot() && (
                  <Card className='!rounded-2xl shadow-sm border-0'>
                    <div className='flex items-center mb-2'>
                      <Avatar size='small' color='orange' className='mr-2 shadow-md'>
                        <DollarSign size={16} />
                      </Avatar>
                      <div className='flex-1'>
                        <Text className='text-lg font-medium'>{t('模型与计费')}</Text>
                        <div className='text-xs text-gray-600'>
                          {enabledCount > 0
                            ? t(
                                '已保存白名单：仅列表中勾选的模型可调用；未勾选不可调用，可单独设置倍率或固定价。',
                              )
                            : t(
                                '默认不限制（等同原先「全部勾选」的含义）：用户可在其分组对应的已启用渠道范围内使用模型，计费按全局倍率表。下方列表未勾选仅表示尚未写入白名单，不是禁用。',
                              )}
                        </div>
                      </div>
                      {enabledCount > 0 ? (
                        <Tag color='orange' size='small' className='ml-2'>
                          {enabledCount} {t('个已选')}
                        </Tag>
                      ) : (
                        <Tag color='grey' size='small' className='ml-2'>
                          {t('默认不限制')}
                        </Tag>
                      )}
                    </div>

                    {enabledCount === 0 && (
                      <Banner
                        type='info'
                        description={t(
                          '说明：列表来自倍率表，与渠道是否仍提供某模型可能不一致。需要限制可用范围或覆盖计费时，请勾选模型后点「保存模型配置」；也可用「全选」再保存，效果接近以前的默认全部勾选（仍受渠道能力约束）。',
                        )}
                        className='mb-3 !rounded-lg'
                        closeIcon={null}
                      />
                    )}

                    {/* 搜索 + 操作栏 */}
                    <div className='flex items-center gap-2 mb-2'>
                      <Input
                        prefix={<IconSearch />}
                        placeholder={t('搜索模型...')}
                        value={modelSearch}
                        onChange={setModelSearch}
                        showClear
                        style={{ flex: 1 }}
                        size='small'
                      />
                      <Button size='small' theme='borderless' onClick={selectAll}>
                        {t('全选')}
                      </Button>
                      <Button size='small' theme='borderless' onClick={deselectAll}>
                        {t('取消全选')}
                      </Button>
                    </div>

                    {/* 模型列表 */}
                    <div
                      style={{ maxHeight: 360, overflowY: 'auto', overflowX: 'hidden' }}
                      className='border rounded-lg'
                    >
                      {filteredModels.length === 0 ? (
                        <Empty
                          description={t('没有匹配的模型')}
                          style={{ padding: '24px 0' }}
                        />
                      ) : (
                        filteredModels.map((m) => {
                          const enabled = !!modelOverrides[m.model];
                          const override = modelOverrides[m.model];
                          return (
                            <div
                              key={m.model}
                              className='flex items-center gap-2 px-3 py-1.5 border-b last:border-b-0'
                              style={{
                                background: enabled
                                  ? 'var(--semi-color-primary-light-default)'
                                  : 'transparent',
                              }}
                            >
                              <Checkbox
                                checked={enabled}
                                onChange={() => toggleModel(m.model)}
                              />
                              <Text
                                ellipsis={{ showTooltip: true }}
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  fontSize: 13,
                                  fontWeight: enabled ? 500 : 400,
                                }}
                              >
                                {m.model}
                              </Text>
                              {enabled && (
                                <>
                                  <Select
                                    size='small'
                                    value={override?.billing_type || 'ratio'}
                                    onChange={(v) => updateOverride(m.model, 'billing_type', v)}
                                    style={{ width: 90 }}
                                    optionList={[
                                      { label: t('倍率'), value: 'ratio' },
                                      { label: t('固定价'), value: 'price' },
                                    ]}
                                  />
                                  <InputNumber
                                    size='small'
                                    value={override?.value ?? 0}
                                    onChange={(v) =>
                                      updateOverride(m.model, 'value', v ?? 0)
                                    }
                                    min={0}
                                    step={0.1}
                                    style={{ width: 90 }}
                                  />
                                </>
                              )}
                              {!enabled && (
                                <Text type='tertiary' size='small'>
                                  {m.billing_type === 'price' ? t('固定价') : t('倍率')}{' '}
                                  {m.value}
                                </Text>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className='mt-3'>
                      <Button
                        theme='solid'
                        type='warning'
                        size='small'
                        loading={overridesSaving}
                        disabled={!overridesHasChanges}
                        onClick={saveModelOverrides}
                      >
                        {t('保存模型配置')}
                      </Button>
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
