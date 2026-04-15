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
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Button,
  Table,
  Tag,
  Typography,
  Space,
  Tooltip,
  Popconfirm,
  Empty,
  Spin,
  Select,
  Row,
  Col,
  Badge,
  Progress,
  Card,
  TextArea,
  Input,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import {
  API,
  showError,
  showSuccess,
  timestamp2string,
  isRoot,
} from '../../../../helpers';
import { StatusPill } from '../../../common/ui/StatusPill';

const { Text } = Typography;

const MultiKeyManageModal = ({ visible, onCancel, channel, onRefresh, onOpenModelTest }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [keyStatusList, setKeyStatusList] = useState([]);
  const [operationLoading, setOperationLoading] = useState({});

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Statistics states
  const [enabledCount, setEnabledCount] = useState(0);
  const [manualDisabledCount, setManualDisabledCount] = useState(0);
  const [autoDisabledCount, setAutoDisabledCount] = useState(0);

  // Filter state
  const [statusFilter, setStatusFilter] = useState(null);

  // View key modal
  const [viewKeyVisible, setViewKeyVisible] = useState(false);
  const [viewKeyValue, setViewKeyValue] = useState('');
  const [viewKeyIndex, setViewKeyIndex] = useState(null);

  // Edit key modal
  const [editKeyVisible, setEditKeyVisible] = useState(false);
  const [editKeyIndex, setEditKeyIndex] = useState(null);
  const [editKeyValue, setEditKeyValue] = useState('');
  const [editKeyLoading, setEditKeyLoading] = useState(false);

  // Add keys modal
  const [addKeysVisible, setAddKeysVisible] = useState(false);
  const [addKeysValue, setAddKeysValue] = useState('');
  const [addKeysLoading, setAddKeysLoading] = useState(false);
  const [addMultiKeyMode, setAddMultiKeyMode] = useState('random');

  /** 最近一次单密钥测试结果（仅前端展示） */
  const [keyTestResults, setKeyTestResults] = useState({});

  const [keySuccessRates, setKeySuccessRates] = useState({});

  const isMultiKey = channel?.channel_info?.is_multi_key;

  const loadKeyStatus = async (
    page = currentPage,
    size = pageSize,
    status = statusFilter,
  ) => {
    if (!channel?.id) return;
    setLoading(true);
    try {
      const requestData = {
        channel_id: channel.id,
        action: 'get_key_status',
        page,
        page_size: size,
      };
      if (status !== null) {
        requestData.status = status;
      }
      const res = await API.post('/api/channel/multi_key/manage', requestData);
      if (res.data.success) {
        const data = res.data.data;
        setKeyStatusList(data.keys || []);
        setTotal(data.total || 0);
        setCurrentPage(data.page || 1);
        setPageSize(data.page_size || 10);
        setTotalPages(data.total_pages || 0);
        setEnabledCount(data.enabled_count || 0);
        setManualDisabledCount(data.manual_disabled_count || 0);
        setAutoDisabledCount(data.auto_disabled_count || 0);
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      console.error(error);
      showError(t('获取密钥状态失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleDisableKey = async (keyIndex) => {
    const operationId = `disable_${keyIndex}`;
    setOperationLoading((prev) => ({ ...prev, [operationId]: true }));
    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'disable_key',
        key_index: keyIndex,
      });
      if (res.data.success) {
        showSuccess(t('密钥已禁用'));
        await loadKeyStatus(currentPage, pageSize);
        onRefresh && onRefresh();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('禁用密钥失败'));
    } finally {
      setOperationLoading((prev) => ({ ...prev, [operationId]: false }));
    }
  };

  const handleEnableKey = async (keyIndex) => {
    const operationId = `enable_${keyIndex}`;
    setOperationLoading((prev) => ({ ...prev, [operationId]: true }));
    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'enable_key',
        key_index: keyIndex,
      });
      if (res.data.success) {
        showSuccess(t('密钥已启用'));
        await loadKeyStatus(currentPage, pageSize);
        onRefresh && onRefresh();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('启用密钥失败'));
    } finally {
      setOperationLoading((prev) => ({ ...prev, [operationId]: false }));
    }
  };

  const handleEnableAll = async () => {
    setOperationLoading((prev) => ({ ...prev, enable_all: true }));
    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'enable_all_keys',
      });
      if (res.data.success) {
        showSuccess(res.data.message || t('已启用所有密钥'));
        setCurrentPage(1);
        await loadKeyStatus(1, pageSize);
        onRefresh && onRefresh();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('启用所有密钥失败'));
    } finally {
      setOperationLoading((prev) => ({ ...prev, enable_all: false }));
    }
  };

  const handleDisableAll = async () => {
    setOperationLoading((prev) => ({ ...prev, disable_all: true }));
    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'disable_all_keys',
      });
      if (res.data.success) {
        showSuccess(res.data.message || t('已禁用所有密钥'));
        setCurrentPage(1);
        await loadKeyStatus(1, pageSize);
        onRefresh && onRefresh();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('禁用所有密钥失败'));
    } finally {
      setOperationLoading((prev) => ({ ...prev, disable_all: false }));
    }
  };

  const handleDeleteDisabledKeys = async () => {
    setOperationLoading((prev) => ({ ...prev, delete_disabled: true }));
    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'delete_disabled_keys',
      });
      if (res.data.success) {
        showSuccess(res.data.message);
        setCurrentPage(1);
        await loadKeyStatus(1, pageSize);
        onRefresh && onRefresh();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('删除禁用密钥失败'));
    } finally {
      setOperationLoading((prev) => ({ ...prev, delete_disabled: false }));
    }
  };

  const handleTestKey = async (keyIndex) => {
    const operationId = `test_${keyIndex}`;
    setOperationLoading((prev) => ({ ...prev, [operationId]: true }));
    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'test_key',
        key_index: keyIndex,
      });
      if (res.data.success) {
        const msg = res.data.message || t('密钥测试成功');
        setKeyTestResults((prev) => ({
          ...prev,
          [keyIndex]: { success: true, message: msg },
        }));
        showSuccess(msg);
      } else {
        const msg = res.data.message || t('密钥测试失败');
        setKeyTestResults((prev) => ({
          ...prev,
          [keyIndex]: { success: false, message: msg },
        }));
        showError(msg);
      }
    } catch (error) {
      const msg = error?.message || t('密钥测试失败');
      setKeyTestResults((prev) => ({
        ...prev,
        [keyIndex]: { success: false, message: msg },
      }));
      showError(t('密钥测试失败'));
    } finally {
      setOperationLoading((prev) => ({ ...prev, [operationId]: false }));
    }
  };

  const handleDeleteKey = async (keyIndex) => {
    const operationId = `delete_${keyIndex}`;
    setOperationLoading((prev) => ({ ...prev, [operationId]: true }));
    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'delete_key',
        key_index: keyIndex,
      });
      if (res.data.success) {
        showSuccess(t('密钥已删除'));
        await loadKeyStatus(currentPage, pageSize);
        onRefresh && onRefresh();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('删除密钥失败'));
    } finally {
      setOperationLoading((prev) => ({ ...prev, [operationId]: false }));
    }
  };

  // View key (root only)
  const handleViewKey = async (keyIndex) => {
    const operationId = `view_${keyIndex}`;
    setOperationLoading((prev) => ({ ...prev, [operationId]: true }));
    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'view_key',
        key_index: keyIndex,
      });
      if (res.data.success) {
        setViewKeyIndex(keyIndex);
        setViewKeyValue(res.data.data?.key || '');
        setViewKeyVisible(true);
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('获取密钥失败'));
    } finally {
      setOperationLoading((prev) => ({ ...prev, [operationId]: false }));
    }
  };

  // Edit key (root only)
  const handleOpenEditKey = (keyIndex, currentPreview) => {
    setEditKeyIndex(keyIndex);
    setEditKeyValue('');
    setEditKeyVisible(true);
  };

  const handleSaveEditKey = async () => {
    const trimmed = editKeyValue.trim();
    if (!trimmed) {
      showError(t('密钥不能为空'));
      return;
    }
    setEditKeyLoading(true);
    try {
      const res = await API.post('/api/channel/multi_key/manage', {
        channel_id: channel.id,
        action: 'update_key',
        key_index: editKeyIndex,
        new_key_value: trimmed,
      });
      if (res.data.success) {
        showSuccess(t('密钥已更新'));
        setEditKeyVisible(false);
        setEditKeyValue('');
        await loadKeyStatus(currentPage, pageSize);
        onRefresh && onRefresh();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('更新密钥失败'));
    } finally {
      setEditKeyLoading(false);
    }
  };

  const runAddKeysRequest = async (trimmed, multiKeyMode) => {
    const res = await API.post('/api/channel/multi_key/manage', {
      channel_id: channel.id,
      action: 'add_keys',
      new_key_value: trimmed,
      multi_key_mode: multiKeyMode,
    });
    if (res.data.success) {
      showSuccess(res.data.message || t('密钥已添加'));
      setCurrentPage(1);
      await loadKeyStatus(1, pageSize);
      onRefresh && onRefresh();
      return true;
    }
    showError(res.data.message);
    return false;
  };

  // Add keys（弹窗）
  const handleAddKeys = async () => {
    const trimmed = addKeysValue.trim();
    if (!trimmed) {
      showError(t('请输入要添加的密钥'));
      return;
    }
    setAddKeysLoading(true);
    try {
      const ok = await runAddKeysRequest(trimmed, addMultiKeyMode);
      if (ok) {
        setAddKeysVisible(false);
        setAddKeysValue('');
      }
    } catch (error) {
      showError(t('添加密钥失败'));
    } finally {
      setAddKeysLoading(false);
    }
  };

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setCurrentPage(1);
    loadKeyStatus(1, size);
  };

  const handleStatusFilterChange = (status) => {
    setStatusFilter(status);
    setCurrentPage(1);
    loadKeyStatus(1, pageSize, status);
  };

  useEffect(() => {
    if (visible && channel?.id) {
      setCurrentPage(1);
      loadKeyStatus(1, pageSize);
      loadKeySuccessRates();
    }
  }, [visible, channel?.id]);

  const loadKeySuccessRates = async () => {
    if (!channel?.id) return;
    try {
      const now = Math.floor(Date.now() / 1000);
      const weekAgo = now - 7 * 86400;
      const res = await API.get(`/api/log/channel_success_rate?start_timestamp=${weekAgo}&end_timestamp=${now}`);
      if (res.data.success) {
        const rates = {};
        for (const item of (res.data.data || [])) {
          if (item.channel_id === channel.id) {
            const key = item.key_index || 0;
            if (!rates[key]) {
              rates[key] = { total: 0, success: 0 };
            }
            rates[key].total += item.total_count;
            rates[key].success += item.success_count;
          }
        }
        setKeySuccessRates(rates);
      }
    } catch (e) {
      console.error('Failed to load key success rates:', e);
    }
  };

  useEffect(() => {
    if (!visible) {
      setCurrentPage(1);
      setKeyStatusList([]);
      setTotal(0);
      setTotalPages(0);
      setEnabledCount(0);
      setManualDisabledCount(0);
      setAutoDisabledCount(0);
      setStatusFilter(null);
      setKeyTestResults({});
      setKeySuccessRates({});
    }
  }, [visible]);

  const enabledPercent =
    total > 0 ? Math.round((enabledCount / total) * 100) : 0;
  const manualDisabledPercent =
    total > 0 ? Math.round((manualDisabledCount / total) * 100) : 0;
  const autoDisabledPercent =
    total > 0 ? Math.round((autoDisabledCount / total) * 100) : 0;

  const renderStatusTag = (status) => {
    switch (status) {
      case 1:
        return <StatusPill variant={1}>{t('已启用')}</StatusPill>;
      case 2:
        return <StatusPill variant={2}>{t('已禁用')}</StatusPill>;
      case 3:
        return <StatusPill variant={3}>{t('自动禁用')}</StatusPill>;
      default:
        return <StatusPill variant={0}>{t('未知状态')}</StatusPill>;
    }
  };

  // Index number color based on status
  const getIndexColor = (status) => {
    switch (status) {
      case 2:
        return '#ef4444';
      case 3:
        return '#f59e0b';
      default:
        return undefined;
    }
  };

  const columns = [
    {
      title: t('索引'),
      dataIndex: 'index',
      width: 70,
      render: (text, record) => {
        const color = getIndexColor(record.status);
        return (
          <span style={color ? { color, fontWeight: 600 } : { fontWeight: 500 }}>
            #{text}
          </span>
        );
      },
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      render: (status) => renderStatusTag(status),
    },
    {
      title: t('禁用原因'),
      dataIndex: 'reason',
      render: (reason, record) => {
        if (record.status === 1 || !reason) {
          return <Text type='quaternary'>-</Text>;
        }
        const modelRelated = /model|模型|404|not\s*found|invalid/i.test(reason);
        const color =
          record.status === 3
            ? '#d97706'
            : modelRelated
              ? '#b91c1c'
              : '#dc2626';
        return (
          <Tooltip content={reason}>
            <Text
              style={{
                maxWidth: '200px',
                display: 'block',
                color,
                fontWeight: modelRelated ? 600 : 500,
              }}
              ellipsis
            >
              {reason}
            </Text>
          </Tooltip>
        );
      },
    },
    {
      title: t('禁用时间'),
      dataIndex: 'disabled_time',
      render: (time, record) => {
        if (record.status === 1 || !time) {
          return <Text type='quaternary'>-</Text>;
        }
        return (
          <Tooltip content={timestamp2string(time)}>
            <Text style={{ fontSize: '12px' }}>{timestamp2string(time)}</Text>
          </Tooltip>
        );
      },
    },
    {
      title: t('最近测试'),
      key: 'last_test',
      width: 96,
      render: (_, record) => {
        const tr = keyTestResults[record.index];
        if (!tr) {
          return <Text type='quaternary'>-</Text>;
        }
        return (
          <Tooltip content={tr.message}>
            <StatusPill variant={tr.success ? 'success' : 'danger'}>
              {tr.success ? t('成功') : t('失败')}
            </StatusPill>
          </Tooltip>
        );
      },
    },
    {
      title: t('成功率'),
      key: 'success_rate',
      width: 80,
      render: (_, record) => {
        const rateData = keySuccessRates[record.index];
        if (!rateData || rateData.total === 0) {
          return <Text type='quaternary'>-</Text>;
        }
        const rate = (rateData.success / rateData.total * 100).toFixed(1);
        const rateNum = parseFloat(rate);
        let color = '#16a34a';
        if (rateNum < 50) color = '#dc2626';
        else if (rateNum < 80) color = '#d97706';
        else if (rateNum < 95) color = '#d97706';
        return (
          <Tooltip content={`${rateData.success}/${rateData.total}`}>
            <span style={{ color, fontWeight: 600, fontSize: 12 }}>{rate}%</span>
          </Tooltip>
        );
      },
    },
    {
      title: t('操作'),
      key: 'action',
      fixed: 'right',
      width: isRoot() ? 380 : 200,
      render: (_, record) => (
        <Space>
          {isRoot() && (
            <Tooltip content={t('查看该密钥的完整内容')}>
              <Button
                size='small'
                type='tertiary'
                loading={operationLoading[`view_${record.index}`]}
                onClick={() => handleViewKey(record.index)}
              >
                {t('查看')}
              </Button>
            </Tooltip>
          )}
          {isRoot() && (
            <Tooltip content={t('编辑该密钥')}>
              <Button
                size='small'
                type='tertiary'
                onClick={() => handleOpenEditKey(record.index, record.key_preview)}
              >
                {t('编辑')}
              </Button>
            </Tooltip>
          )}
          {isRoot() && (() => {
            const tr = keyTestResults[record.index];
            let btnType = 'tertiary';
            if (tr) {
              btnType = tr.success ? 'primary' : 'danger';
            }
            return (
              <Space spacing={0} style={{ marginRight: 4 }}>
                <Tooltip content={t('测试该密钥')}>
                  <Button
                    size='small'
                    type={btnType}
                    theme={tr ? 'solid' : 'light'}
                    loading={operationLoading[`test_${record.index}`]}
                    onClick={() => handleTestKey(record.index)}
                    style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                  >
                    {t('测试')}
                  </Button>
                </Tooltip>
                <Button
                  size='small'
                  type={btnType}
                  theme={tr ? 'solid' : 'light'}
                  onClick={() => {
                    if (onOpenModelTest) {
                      onOpenModelTest(channel, record.index);
                    }
                  }}
                  style={{ paddingLeft: 4, paddingRight: 4, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeftWidth: 0 }}
                >
                  <svg viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' width='1em' height='1em' style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                    <path d='m20.56 9.66-7.8 8.97a1 1 0 0 1-1.51 0L3.44 9.66A1 1 0 0 1 4.19 8h15.62a1 1 0 0 1 .75 1.66Z' fill='currentColor' />
                  </svg>
                </Button>
              </Space>
            );
          })()}
          {record.status === 1 ? (
            <Button
              type='danger'
              size='small'
              loading={operationLoading[`disable_${record.index}`]}
              onClick={() => handleDisableKey(record.index)}
            >
              {t('禁用')}
            </Button>
          ) : (
            <Button
              type='primary'
              size='small'
              loading={operationLoading[`enable_${record.index}`]}
              onClick={() => handleEnableKey(record.index)}
            >
              {t('启用')}
            </Button>
          )}
          {isMultiKey && (
            <Popconfirm
              title={t('确定要删除此密钥吗？')}
              content={t('此操作不可撤销，将永久删除该密钥')}
              onConfirm={() => handleDeleteKey(record.index)}
              okType={'danger'}
              position={'topRight'}
            >
              <Button
                type='danger'
                size='small'
                loading={operationLoading[`delete_${record.index}`]}
              >
                {t('删除')}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Modal
        title={
          <Space>
            <Text>
              {isMultiKey ? t('多密钥管理') : t('密钥管理')}
            </Text>
            {channel?.name && (
              <Tag size='small' shape='circle' color='white'>
                {channel.name}
              </Tag>
            )}
            <Tag size='small' shape='circle' color='white'>
              {t('总密钥数')}: {total}
            </Tag>
            {isMultiKey && channel?.channel_info?.multi_key_mode && (
              <Tag size='small' shape='circle' color='white'>
                {channel.channel_info.multi_key_mode === 'random'
                  ? t('随机模式')
                  : t('轮询模式')}
              </Tag>
            )}
          </Space>
        }
        visible={visible}
        onCancel={onCancel}
        width={950}
        footer={null}
      >
        <div className='flex flex-col mb-5'>
          {/* Stats：单密钥与多密钥均展示，与参考布局一致 */}
          <div
            className='rounded-xl p-4 mb-3'
            style={{
              background: 'var(--semi-color-bg-1)',
              border: '1px solid var(--semi-color-border)',
            }}
          >
            <Row gutter={16} align='middle'>
                <Col span={8}>
                  <div
                    style={{
                      background: 'var(--semi-color-bg-0)',
                      border: '1px solid var(--semi-color-border)',
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div className='flex items-center gap-2 mb-2'>
                      <Badge dot type='success' />
                      <Text type='tertiary'>{t('已启用')}</Text>
                    </div>
                    <div className='flex items-end gap-2 mb-2'>
                      <Text style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>
                        {enabledCount}
                      </Text>
                      <Text style={{ fontSize: 18, color: 'var(--semi-color-text-2)' }}>
                        / {total}
                      </Text>
                    </div>
                    <Progress
                      percent={enabledPercent}
                      showInfo={false}
                      size='small'
                      stroke='#22c55e'
                      style={{ height: 6, borderRadius: 999 }}
                    />
                  </div>
                </Col>
                <Col span={8}>
                  <div
                    style={{
                      background: 'var(--semi-color-bg-0)',
                      border: '1px solid var(--semi-color-border)',
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div className='flex items-center gap-2 mb-2'>
                      <Badge dot type='danger' />
                      <Text type='tertiary'>{t('手动禁用')}</Text>
                    </div>
                    <div className='flex items-end gap-2 mb-2'>
                      <Text style={{ fontSize: 18, fontWeight: 700, color: '#ef4444' }}>
                        {manualDisabledCount}
                      </Text>
                      <Text style={{ fontSize: 18, color: 'var(--semi-color-text-2)' }}>
                        / {total}
                      </Text>
                    </div>
                    <Progress
                      percent={manualDisabledPercent}
                      showInfo={false}
                      size='small'
                      stroke='#ef4444'
                      style={{ height: 6, borderRadius: 999 }}
                    />
                  </div>
                </Col>
                <Col span={8}>
                  <div
                    style={{
                      background: 'var(--semi-color-bg-0)',
                      border: '1px solid var(--semi-color-border)',
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div className='flex items-center gap-2 mb-2'>
                      <Badge dot type='warning' />
                      <Text type='tertiary'>{t('自动禁用')}</Text>
                    </div>
                    <div className='flex items-end gap-2 mb-2'>
                      <Text style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b' }}>
                        {autoDisabledCount}
                      </Text>
                      <Text style={{ fontSize: 18, color: 'var(--semi-color-text-2)' }}>
                        / {total}
                      </Text>
                    </div>
                    <Progress
                      percent={autoDisabledPercent}
                      showInfo={false}
                      size='small'
                      stroke='#f59e0b'
                      style={{ height: 6, borderRadius: 999 }}
                    />
                  </div>
                </Col>
              </Row>
          </div>

          {/* Table */}
          <div className='flex-1 flex flex-col min-h-0'>
            <Spin spinning={loading}>
              <Card className='!rounded-xl'>
                <Table
                  title={() => (
                    <Row gutter={12} style={{ width: '100%' }}>
                      <Col span={14}>
                        <Row gutter={12} style={{ alignItems: 'center' }}>
                          <Col>
                            <Select
                              value={statusFilter}
                              onChange={handleStatusFilterChange}
                              size='small'
                              placeholder={t('全部状态')}
                            >
                              <Select.Option value={null}>{t('全部状态')}</Select.Option>
                              <Select.Option value={1}>{t('已启用')}</Select.Option>
                              <Select.Option value={2}>{t('手动禁用')}</Select.Option>
                              <Select.Option value={3}>{t('自动禁用')}</Select.Option>
                            </Select>
                          </Col>
                        </Row>
                      </Col>
                      <Col
                        span={10}
                        style={{ display: 'flex', justifyContent: 'flex-end' }}
                      >
                        <Space>
                          <Button
                            size='small'
                            type='tertiary'
                            onClick={() => loadKeyStatus(currentPage, pageSize)}
                            loading={loading}
                          >
                            {t('刷新')}
                          </Button>
                          {isMultiKey && (
                            <Popconfirm
                              title={t('确定要删除所有已自动禁用的密钥吗？')}
                              content={t('此操作不可撤销，将永久删除已自动禁用的密钥')}
                              onConfirm={handleDeleteDisabledKeys}
                              okType={'danger'}
                              position={'topRight'}
                            >
                              <Button
                                size='small'
                                type='warning'
                                theme='light'
                                loading={operationLoading.delete_disabled}
                              >
                                {t('删除自动禁用密钥')}
                              </Button>
                            </Popconfirm>
                          )}
                          <Button
                            size='small'
                            type='primary'
                            onClick={() => {
                              setAddMultiKeyMode(
                                channel?.channel_info?.multi_key_mode || 'random',
                              );
                              setAddKeysValue('');
                              setAddKeysVisible(true);
                            }}
                          >
                            {t('添加密钥')}
                          </Button>
                        </Space>
                      </Col>
                    </Row>
                  )}
                  columns={columns}
                  dataSource={keyStatusList}
                  pagination={
                    isMultiKey
                      ? {
                          currentPage,
                          pageSize,
                          total,
                          showSizeChanger: true,
                          showQuickJumper: true,
                          pageSizeOpts: [10, 20, 50, 100],
                          onChange: (page, size) => {
                            setCurrentPage(page);
                            loadKeyStatus(page, size);
                          },
                          onShowSizeChange: (current, size) => {
                            setCurrentPage(1);
                            handlePageSizeChange(size);
                          },
                        }
                      : false
                  }
                  size='small'
                  bordered={false}
                  rowKey='index'
                  scroll={{ x: 'max-content' }}
                  empty={
                    <Empty
                      image={
                        <IllustrationNoResult style={{ width: 140, height: 140 }} />
                      }
                      darkModeImage={
                        <IllustrationNoResultDark style={{ width: 140, height: 140 }} />
                      }
                      title={t('暂无密钥数据')}
                      description={t('请点击「添加密钥」来配置密钥')}
                      style={{ padding: 30 }}
                    />
                  }
                />
              </Card>
            </Spin>
          </div>
        </div>
      </Modal>

      {/* View Key Modal */}
      <Modal
        title={t('查看密钥 #{{index}}', { index: viewKeyIndex })}
        visible={viewKeyVisible}
        onCancel={() => {
          setViewKeyVisible(false);
          setViewKeyValue('');
        }}
        footer={
          <Button
            onClick={() => {
              navigator.clipboard.writeText(viewKeyValue).then(
                () => showSuccess(t('复制成功')),
                () => showError(t('复制失败')),
              );
            }}
          >
            {t('复制')}
          </Button>
        }
        width={600}
      >
        <TextArea
          value={viewKeyValue}
          readOnly
          autosize={{ minRows: 3, maxRows: 8 }}
          style={{ fontFamily: 'monospace', fontSize: 13 }}
        />
      </Modal>

      {/* Edit Key Modal */}
      <Modal
        title={t('编辑密钥 #{{index}}', { index: editKeyIndex })}
        visible={editKeyVisible}
        onCancel={() => {
          setEditKeyVisible(false);
          setEditKeyValue('');
        }}
        onOk={handleSaveEditKey}
        okButtonProps={{ loading: editKeyLoading }}
        width={600}
      >
        <div className='mb-2'>
          <Text type='tertiary' size='small'>
            {t('输入新的密钥值（将覆盖当前密钥）')}
          </Text>
        </div>
        <TextArea
          value={editKeyValue}
          onChange={setEditKeyValue}
          placeholder={t('请输入新密钥')}
          autosize={{ minRows: 3, maxRows: 8 }}
          style={{ fontFamily: 'monospace', fontSize: 13 }}
          autoComplete='new-password'
        />
      </Modal>

      {/* Add Keys Modal */}
      <Modal
        title={t('添加密钥')}
        visible={addKeysVisible}
        onCancel={() => {
          setAddKeysVisible(false);
          setAddKeysValue('');
        }}
        onOk={handleAddKeys}
        okButtonProps={{ loading: addKeysLoading }}
        width={600}
      >
        <Space vertical align='start' style={{ width: '100%' }} spacing={12}>
          <div style={{ width: '100%' }}>
            <Text className='mb-1 block'>{t('密钥内容（每行一个）')}</Text>
            <TextArea
              value={addKeysValue}
              onChange={setAddKeysValue}
              placeholder={t('请输入密钥，每行一个')}
              autosize={{ minRows: 4, maxRows: 10 }}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
              autoComplete='new-password'
            />
          </div>
          {!isMultiKey && (
            <div style={{ width: '100%' }}>
              <Text className='mb-1 block'>{t('多密钥模式（添加多个密钥时生效）')}</Text>
              <Select
                value={addMultiKeyMode}
                onChange={setAddMultiKeyMode}
                style={{ width: '100%' }}
              >
                <Select.Option value='random'>{t('随机模式')}</Select.Option>
                <Select.Option value='roundrobin'>{t('轮询模式')}</Select.Option>
              </Select>
            </div>
          )}
        </Space>
      </Modal>
    </>
  );
};

export default MultiKeyManageModal;
