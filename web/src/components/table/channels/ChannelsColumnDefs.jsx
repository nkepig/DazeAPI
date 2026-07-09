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

import React from 'react';
import {
  Button,
  Dropdown,
  InputNumber,
  Modal,
  Space,
  SplitButtonGroup,
  Tag,
  Tooltip,
  Typography,
} from '@douyinfe/semi-ui';
import {
  timestamp2string,
  renderQuota,
  getChannelIcon,
  renderQuotaWithAmount,
  groupToColor,
  showSuccess,
  showError,
  showInfo,
} from '../../../helpers';
import { quotaToDisplayAmount } from '../../../helpers/quota';
import {
  CHANNEL_OPTIONS,
  MODEL_FETCHABLE_CHANNEL_TYPES,
} from '../../../constants';
import { parseUpstreamUpdateMeta } from '../../../hooks/channels/upstreamUpdateUtils';
import { IconTreeTriangleDown, IconMore } from '@douyinfe/semi-icons';
import { FaRandom } from 'react-icons/fa';
import { StatusPill } from '../../common/ui/StatusPill';

const HOVER_TOOLTIP_PROPS = {
  mouseEnterDelay: 200,
  mouseLeaveDelay: 200,
};

const InlineChannelNumberInput = ({
  value,
  min,
  onCommit,
}) => {
  const wrapperRef = React.useRef(null);
  const [localValue, setLocalValue] = React.useState(value);

  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const commitValue = () => {
    if (localValue === '' || localValue === null || localValue === undefined) {
      return;
    }
    if (Number(localValue) === Number(value)) {
      return;
    }
    onCommit(localValue);
  };

  return (
    <div ref={wrapperRef}>
      <InputNumber
        style={{ width: 70 }}
        value={localValue}
        min={min}
        size='small'
        innerButtons
        keepFocus={true}
        onChange={(nextValue) => setLocalValue(nextValue)}
        onBlur={(e) => {
          const nextFocusTarget = e?.relatedTarget;
          if (
            nextFocusTarget &&
            wrapperRef.current?.contains(nextFocusTarget)
          ) {
            return;
          }
          commitValue();
        }}
        onEnterPress={commitValue}
      />
    </div>
  );
};

// Render functions
const renderType = (type, record = {}, t) => {
  const channelInfo = record?.channel_info;
  let type2label = new Map();
  for (let i = 0; i < CHANNEL_OPTIONS.length; i++) {
    type2label[CHANNEL_OPTIONS[i].value] = CHANNEL_OPTIONS[i];
  }
  type2label[0] = { value: 0, label: t('未知类型'), color: 'grey' };

  let icon = getChannelIcon(type);

  if (channelInfo?.is_multi_key) {
    icon =
      channelInfo?.multi_key_mode === 'random' ? (
        <div className='flex items-center gap-1'>
          <FaRandom className='text-blue-500' />
          {icon}
        </div>
      ) : (
        <div className='flex items-center gap-1'>
          <IconTreeTriangleDown className='text-blue-500' />
          {icon}
        </div>
      );
  }

  const typeTag = (
    <Tag color={type2label[type]?.color} shape='circle' prefixIcon={icon}>
      {type2label[type]?.label}
    </Tag>
  );

  let ionetMeta = null;
  if (record?.other_info) {
    try {
      const parsed = JSON.parse(record.other_info);
      if (parsed && typeof parsed === 'object' && parsed.source === 'ionet') {
        ionetMeta = parsed;
      }
    } catch (error) {
      // ignore invalid metadata
    }
  }

  if (!ionetMeta) {
    return typeTag;
  }

  const handleNavigate = (event) => {
    event?.stopPropagation?.();
    if (!ionetMeta?.deployment_id) {
      return;
    }
    const targetUrl = `/console/deployment?deployment_id=${ionetMeta.deployment_id}`;
    window.open(targetUrl, '_blank', 'noopener');
  };

  return (
    <Space spacing={6}>
      {typeTag}
      <Tooltip
        content={
          <div className='max-w-xs'>
            <div className='text-xs text-gray-600'>
              {t('来源于 IO.NET 部署')}
            </div>
            {ionetMeta?.deployment_id && (
              <div className='text-xs text-gray-500 mt-1'>
                {t('部署 ID')}: {ionetMeta.deployment_id}
              </div>
            )}
          </div>
        }
        {...HOVER_TOOLTIP_PROPS}
      >
        <span>
          <Tag
            color='purple'
            type='light'
            className='cursor-pointer'
            onClick={handleNavigate}
          >
            IO.NET
          </Tag>
        </span>
      </Tooltip>
    </Space>
  );
};

const renderStatus = (status, channelInfo = undefined, t) => {
  if (channelInfo) {
    if (channelInfo.is_multi_key) {
      let keySize = channelInfo.multi_key_size;
      let enabledKeySize = keySize;
      if (channelInfo.multi_key_status_list) {
        enabledKeySize =
          keySize - Object.keys(channelInfo.multi_key_status_list).length;
      }
      return renderMultiKeyStatus(status, keySize, enabledKeySize, t);
    }
  }
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

const renderMultiKeyStatus = (status, keySize, enabledKeySize, t) => {
  switch (status) {
    case 1:
      return (
        <StatusPill variant={1}>
          {t('已启用')} {enabledKeySize}/{keySize}
        </StatusPill>
      );
    case 2:
      return (
        <StatusPill variant={2}>
          {t('已禁用')} {enabledKeySize}/{keySize}
        </StatusPill>
      );
    case 3:
      return (
        <StatusPill variant={3}>
          {t('自动禁用')} {enabledKeySize}/{keySize}
        </StatusPill>
      );
    default:
      return (
        <StatusPill variant={0}>
          {t('未知状态')} {enabledKeySize}/{keySize}
        </StatusPill>
      );
  }
};

const renderResponseTime = (responseTime, t) => {
  let time = responseTime / 1000;
  time = time.toFixed(2) + t(' 秒');
  if (responseTime === 0) {
    return <StatusPill variant='neutral'>{t('未测试')}</StatusPill>;
  }
  if (responseTime <= 1000) {
    return <StatusPill variant='success'>{time}</StatusPill>;
  }
  if (responseTime <= 3000) {
    return <StatusPill variant='lime'>{time}</StatusPill>;
  }
  if (responseTime <= 5000) {
    return <StatusPill variant='warning'>{time}</StatusPill>;
  }
  return <StatusPill variant='danger'>{time}</StatusPill>;
};

const isRequestPassThroughEnabled = (record) => {
  if (!record || record.children !== undefined) {
    return false;
  }
  const settingValue = record.setting;
  if (!settingValue) {
    return false;
  }
  if (typeof settingValue === 'object') {
    return settingValue.pass_through_body_enabled === true;
  }
  if (typeof settingValue !== 'string') {
    return false;
  }
  try {
    const parsed = JSON.parse(settingValue);
    return parsed?.pass_through_body_enabled === true;
  } catch (error) {
    return false;
  }
};

const getUpstreamUpdateMeta = (record) => {
  const supported =
    !!record &&
    record.children === undefined &&
    MODEL_FETCHABLE_CHANNEL_TYPES.has(record.type);
  if (!record || record.children !== undefined) {
    return {
      supported: false,
      enabled: false,
      pendingAddModels: [],
      pendingRemoveModels: [],
    };
  }
  const parsed =
    record?.upstreamUpdateMeta && typeof record.upstreamUpdateMeta === 'object'
      ? record.upstreamUpdateMeta
      : parseUpstreamUpdateMeta(record?.settings);
  return {
    supported,
    enabled: parsed?.enabled === true,
    pendingAddModels: Array.isArray(parsed?.pendingAddModels)
      ? parsed.pendingAddModels
      : [],
    pendingRemoveModels: Array.isArray(parsed?.pendingRemoveModels)
      ? parsed.pendingRemoveModels
      : [],
  };
};

const isChannelRequestRecordEnabled = (record) => {
  if (!record || record.children !== undefined || !record.setting) {
    return false;
  }
  try {
    return JSON.parse(record.setting)?.request_record_enabled === true;
  } catch (error) {
    return false;
  }
};

export const getChannelsColumns = ({
  t,
  COLUMN_KEYS,
  manageChannel,
  manageTag,
  submitTagEdit,
  testChannel,
  setCurrentTestChannel,
  setShowModelTestModal,
  setEditingChannel,
  setShowEdit,
  setShowEditTag,
  setEditingTag,
  copySelectedChannel,
  refresh,
  activePage,
  channels,
  checkOllamaVersion,
  setShowMultiKeyManageModal,
  setCurrentMultiKeyChannel,
  openUpstreamUpdateModal,
  detectChannelUpstreamUpdates,
}) => {
  return [
    {
      key: COLUMN_KEYS.ID,
      title: t('ID'),
      dataIndex: 'id',
      render: (text, record) => {
        if (record.children !== undefined) return text;
        const passThroughEnabled = isRequestPassThroughEnabled(record);
        if (!passThroughEnabled) return text;
        return (
          <Tooltip
            content={t(
              '该渠道已开启请求透传：参数覆写、模型重定向、渠道适配等 NewAPI 内置功能将失效，非最佳实践；如因此产生问题，请勿提交 issue 反馈。',
            )}
            trigger='hover'
            position='topLeft'
            {...HOVER_TOOLTIP_PROPS}
          >
            <span
              style={{
                color: 'var(--semi-color-primary)',
                borderBottom: '1px dotted var(--semi-color-primary)',
                cursor: 'help',
              }}
            >
              {text}
            </span>
          </Tooltip>
        );
      },
    },
    {
      key: COLUMN_KEYS.NAME,
      title: t('名称'),
      dataIndex: 'name',
      render: (text, record, index) => {
        const requestRecordEnabled = isChannelRequestRecordEnabled(record);
        const upstreamUpdateMeta = getUpstreamUpdateMeta(record);
        const pendingAddCount = upstreamUpdateMeta.pendingAddModels.length;
        const pendingRemoveCount =
          upstreamUpdateMeta.pendingRemoveModels.length;
        const showUpstreamUpdateTag =
          upstreamUpdateMeta.supported &&
          upstreamUpdateMeta.enabled &&
          (pendingAddCount > 0 || pendingRemoveCount > 0);
        const clawdInfoRaw =
          record.channel_info &&
          (typeof record.channel_info === 'object'
            ? record.channel_info
            : (() => {
                try {
                  return JSON.parse(record.channel_info);
                } catch {
                  return {};
                }
              })()) || {};
        const clawdGroup = clawdInfoRaw.clawd_group || '';
        const clawdScore = clawdInfoRaw.clawd_score || 0;
        let clawdBreakdown = null;
        if (clawdInfoRaw.clawd_score_breakdown) {
          try {
            clawdBreakdown =
              typeof clawdInfoRaw.clawd_score_breakdown === 'object'
                ? clawdInfoRaw.clawd_score_breakdown
                : JSON.parse(clawdInfoRaw.clawd_score_breakdown);
          } catch {
            clawdBreakdown = null;
          }
        }
        const clawdWatched = !!clawdGroup && String(clawdGroup) !== '0';
        const showClawdScore = clawdWatched;
        const clawdNameStyle = clawdWatched
          ? { color: '#DE886D', fontWeight: 600 }
          : undefined;

        const clawdTooltipContent = clawdWatched ? (
          <div style={{ maxWidth: 220, fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ color: 'var(--semi-color-text-2)', marginBottom: 4 }}>
              {t('样本')} {clawdBreakdown?.sample_count ?? 0}
            </div>
            {clawdBreakdown && (() => {
              const pw = (clawdBreakdown.price_weight ?? 0) * 100;
              const sw = (clawdBreakdown.success_weight ?? 0) * 100;
              const lw = (clawdBreakdown.latency_weight ?? 0) * 100;
              const priceContrib = (clawdBreakdown.price_score ?? 0) * (clawdBreakdown.price_weight ?? 0);
              const successContrib = (clawdBreakdown.success_score ?? 0) * (clawdBreakdown.success_weight ?? 0);
              const latencyContrib = (clawdBreakdown.latency_score ?? 0) * (clawdBreakdown.latency_weight ?? 0);
              const hasProfit = (clawdBreakdown.cost_ratio ?? 0) > 0;
              const hasLatency = (clawdBreakdown.min_use_time ?? 0) > 0 && (clawdBreakdown.avg_use_time ?? 0) > 0;
              const rawStyle = { color: 'var(--semi-color-text-2)' };
              const scoreStyle = { color: 'var(--semi-color-text-1)', paddingLeft: 8 };
              return (
                <div style={{ fontFamily: 'monospace' }}>
                  {hasProfit && (
                    <>
                      <div style={rawStyle}>
                        {t('利润')} {(clawdBreakdown.profit ?? 0).toFixed(3)} / {t('最高')} {(clawdBreakdown.max_profit ?? 0).toFixed(3)}
                      </div>
                      <div style={scoreStyle}>
                        → {(clawdBreakdown.price_score ?? 0).toFixed(0)} × {pw.toFixed(0)}% = {priceContrib.toFixed(1)}
                      </div>
                    </>
                  )}
                  <div style={rawStyle}>
                    {t('成功率')} {((clawdBreakdown.success_rate ?? 0) * 100).toFixed(1)}% / {t('最高')} {((clawdBreakdown.max_success_rate ?? 0) * 100).toFixed(1)}%
                  </div>
                  <div style={scoreStyle}>
                    → {(clawdBreakdown.success_score ?? 0).toFixed(0)} × {sw.toFixed(0)}% = {successContrib.toFixed(1)}
                  </div>
                  {hasLatency && (
                    <>
                      <div style={rawStyle}>
                        {t('耗时')} {(clawdBreakdown.avg_use_time ?? 0).toFixed(2)}s / {t('最快')} {(clawdBreakdown.min_use_time ?? 0).toFixed(2)}s
                      </div>
                      <div style={scoreStyle}>
                        → {(clawdBreakdown.latency_score ?? 0).toFixed(0)} × {lw.toFixed(0)}% = {latencyContrib.toFixed(1)}
                      </div>
                    </>
                  )}
                  <div style={{ borderTop: '1px solid var(--semi-color-border)', marginTop: 4, paddingTop: 4, color: 'var(--semi-color-text-1)' }}>
                    {t('总分')} {clawdScore.toFixed(1)}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : null;
        const innerNameNode =
          record.remark && record.remark.trim() !== '' ? (
            <Tooltip
              content={
                <div className='flex flex-col gap-2 max-w-xs'>
                  <div className='text-sm'>{record.remark}</div>
                  <Button
                    size='small'
                    type='primary'
                    theme='outline'
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard
                        .writeText(record.remark)
                        .then(() => {
                          showSuccess(t('复制成功'));
                        })
                        .catch(() => {
                          showError(t('复制失败'));
                        });
                    }}
                  >
                    {t('复制')}
                  </Button>
                </div>
              }
              trigger='click'
              position='topLeft'
            >
              <span style={clawdNameStyle}>{text}</span>
            </Tooltip>
          ) : (
            <span style={clawdNameStyle}>{text}</span>
          );
        const nameNode = clawdWatched ? (
          <Tooltip
            content={clawdTooltipContent}
            trigger='hover'
            position='topLeft'
            {...HOVER_TOOLTIP_PROPS}
          >
            {innerNameNode}
          </Tooltip>
        ) : (
          innerNameNode
        );

        if (!requestRecordEnabled && !showUpstreamUpdateTag && !showClawdScore) {
          return nameNode;
        }

        return (
          <Space spacing={6} align='center'>
            {nameNode}
            {showClawdScore && (
              <Tooltip
                content={clawdTooltipContent}
                trigger='hover'
                position='topLeft'
                {...HOVER_TOOLTIP_PROPS}
              >
                <Tag
                  size='small'
                  shape='circle'
                  type='light'
                  color={
                    clawdScore >= 80
                      ? 'green'
                      : clawdScore >= 50
                        ? 'orange'
                        : 'red'
                  }
                  className='cursor-default'
                >
                  {clawdScore.toFixed(1)}
                </Tag>
              </Tooltip>
            )}
            {requestRecordEnabled && (
              <span className='inline-flex items-center cursor-default'>
                <StatusPill variant='warning'>{t('正在记录')}</StatusPill>
              </span>
            )}
            {showUpstreamUpdateTag && (
              <Space spacing={4} align='center'>
                {pendingAddCount > 0 ? (
                  <Tooltip
                    content={t('点击处理新增模型')}
                    position='top'
                    {...HOVER_TOOLTIP_PROPS}
                  >
                    <Tag
                      color='green'
                      type='light'
                      size='small'
                      shape='circle'
                      className='cursor-pointer transition-all duration-150 hover:opacity-85 hover:-translate-y-px active:scale-95'
                      onClick={(e) => {
                        e.stopPropagation();
                        openUpstreamUpdateModal(
                          record,
                          upstreamUpdateMeta.pendingAddModels,
                          upstreamUpdateMeta.pendingRemoveModels,
                          'add',
                        );
                      }}
                    >
                      +{pendingAddCount}
                    </Tag>
                  </Tooltip>
                ) : null}
                {pendingRemoveCount > 0 ? (
                  <Tooltip
                    content={t('点击处理删除模型')}
                    position='top'
                    {...HOVER_TOOLTIP_PROPS}
                  >
                    <Tag
                      color='red'
                      type='light'
                      size='small'
                      shape='circle'
                      className='cursor-pointer transition-all duration-150 hover:opacity-85 hover:-translate-y-px active:scale-95'
                      onClick={(e) => {
                        e.stopPropagation();
                        openUpstreamUpdateModal(
                          record,
                          upstreamUpdateMeta.pendingAddModels,
                          upstreamUpdateMeta.pendingRemoveModels,
                          'remove',
                        );
                      }}
                    >
                      -{pendingRemoveCount}
                    </Tag>
                  </Tooltip>
                ) : null}
              </Space>
            )}
          </Space>
        );
      },
    },
    {
      key: COLUMN_KEYS.TYPE,
      title: t('类型'),
      dataIndex: 'type',
      render: (text, record, index) => {
        if (record.children === undefined) {
          return <>{renderType(text, record, t)}</>;
        } else {
          return null;
        }
      },
    },
    {
      key: COLUMN_KEYS.GROUPS,
      title: t('分组'),
      dataIndex: 'group',
      render: (text, record, index) => {
        if (record.children !== undefined) return null;
        const groupStr = record.group || '';
        if (!groupStr) {
          return <Typography.Text type='tertiary' size='small'>-</Typography.Text>;
        }
        const groupList = groupStr.split(',').filter(Boolean);
        return (
          <div className='flex flex-wrap gap-1'>
            {groupList.slice(0, 3).map((g) => (
              <Tag key={g} size='small' color={groupToColor(g)} shape='circle' type='solid'>
                {g}
              </Tag>
            ))}
            {groupList.length > 3 && (
              <Tag size='small' color='grey' shape='circle'>
                +{groupList.length - 3}
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      key: COLUMN_KEYS.STATUS,
      title: t('状态'),
      dataIndex: 'status',
      render: (text, record, index) => {
        const statusElement = renderStatus(text, record.channel_info, t);
        if (text === 3) {
          if (record.other_info === '') {
            record.other_info = '{}';
          }
          let otherInfo = JSON.parse(record.other_info);
          let reason = otherInfo['status_reason'];
          let time = otherInfo['status_time'];
          const tooltipContent = (
            <div className="max-w-[300px]">
              <div className="font-medium mb-1">{t('自动禁用详情')}</div>
              {reason && (
                <div className="mb-1">
                  <span className="text-semi-color-text-2">{t('原因：')}</span>
                  <span className="text-semi-color-danger">{reason}</span>
                </div>
              )}
              {time && (
                <div>
                  <span className="text-semi-color-text-2">{t('时间：')}</span>
                  <span>{timestamp2string(time)}</span>
                </div>
              )}
            </div>
          );
          return (
            <Tooltip content={tooltipContent} {...HOVER_TOOLTIP_PROPS}>
              <div className="cursor-help inline-block">
                {statusElement}
              </div>
            </Tooltip>
          );
        } else {
          return statusElement;
        }
      },
    },
    {
      key: COLUMN_KEYS.RESPONSE_TIME,
      title: t('响应时间'),
      dataIndex: 'response_time',
      render: (text, record, index) => <div>{renderResponseTime(text, t)}</div>,
    },
    {
      key: COLUMN_KEYS.BALANCE,
      title: t('已使用额度'),
      dataIndex: 'used_quota',
      render: (text, record, index) => {
        if (record.children === undefined) {
          return (
            <div>
              {record.type === 57 ? (
                <Tag color='light-blue' type='light' shape='circle'>
                  {t('帐号信息')}
                </Tag>
              ) : (
                <Tag color='white' type='ghost' shape='circle'>
                  {renderQuotaWithAmount(
                    quotaToDisplayAmount(record.used_quota),
                    2,
                  )}
                </Tag>
              )}
            </div>
          );
        } else {
          return (
            <Tag color='white' type='ghost' shape='circle'>
              {renderQuotaWithAmount(
                quotaToDisplayAmount(record.used_quota),
                2,
              )}
            </Tag>
          );
        }
      },
    },
    {
      key: COLUMN_KEYS.PRIORITY,
      title: t('优先级'),
      dataIndex: 'priority',
      render: (text, record, index) => {
        if (record.children === undefined) {
          return (
            <InlineChannelNumberInput
              value={record.priority}
              min={-999}
              onCommit={(nextValue) =>
                manageChannel(record.id, 'priority', record, nextValue)
              }
            />
          );
        } else {
          return (
            <InlineChannelNumberInput
              value={record.priority}
              min={-999}
              onCommit={(nextValue) => {
                Modal.warning({
                  title: t('修改子渠道优先级'),
                  content:
                    t('确定要修改所有子渠道优先级为 ') +
                    nextValue +
                    t(' 吗？'),
                  onOk: () => {
                    if (nextValue === '') {
                      return;
                    }
                    submitTagEdit('priority', {
                      tag: record.key,
                      priority: nextValue,
                    });
                  },
                });
              }}
            />
          );
        }
      },
    },
    {
      key: COLUMN_KEYS.WEIGHT,
      title: t('权重'),
      dataIndex: 'weight',
      render: (text, record, index) => {
        if (record.children === undefined) {
          return (
            <InlineChannelNumberInput
              value={record.weight}
              min={0}
              onCommit={(nextValue) =>
                manageChannel(record.id, 'weight', record, nextValue)
              }
            />
          );
        } else {
          return (
            <InlineChannelNumberInput
              value={record.weight}
              min={-999}
              onCommit={(nextValue) => {
                Modal.warning({
                  title: t('修改子渠道权重'),
                  content:
                    t('确定要修改所有子渠道权重为 ') +
                    nextValue +
                    t(' 吗？'),
                  onOk: () => {
                    if (nextValue === '') {
                      return;
                    }
                    submitTagEdit('weight', {
                      tag: record.key,
                      weight: nextValue,
                    });
                  },
                });
              }}
            />
          );
        }
      },
    },
    {
      key: COLUMN_KEYS.OPERATE,
      title: '',
      dataIndex: 'operate',
      fixed: 'right',
      render: (text, record, index) => {
        if (record.children === undefined) {
          const upstreamUpdateMeta = getUpstreamUpdateMeta(record);
          const moreMenuItems = [
            {
              node: 'item',
              name: t('删除'),
              type: 'danger',
              onClick: () => {
                Modal.confirm({
                  title: t('确定是否要删除此渠道？'),
                  content: t('此修改将不可逆'),
                  onOk: () => {
                    (async () => {
                      await manageChannel(record.id, 'delete', record);
                      await refresh();
                      setTimeout(() => {
                        if (channels.length === 0 && activePage > 1) {
                          refresh(activePage - 1);
                        }
                      }, 100);
                    })();
                  },
                });
              },
            },
            {
              node: 'item',
              name: t('复制'),
              type: 'tertiary',
              onClick: () => {
                Modal.confirm({
                  title: t('确定是否要复制此渠道？'),
                  content: t('复制渠道的所有信息'),
                  onOk: () => copySelectedChannel(record),
                });
              },
            },
          ];

          if (upstreamUpdateMeta.supported) {
            moreMenuItems.push({
              node: 'item',
              name: t('仅检测上游模型更新'),
              type: 'tertiary',
              onClick: () => {
                detectChannelUpstreamUpdates(record);
              },
            });
            moreMenuItems.push({
              node: 'item',
              name: t('处理上游模型更新'),
              type: 'tertiary',
              onClick: () => {
                if (!upstreamUpdateMeta.enabled) {
                  showInfo(t('该渠道未开启上游模型更新检测'));
                  return;
                }
                if (
                  upstreamUpdateMeta.pendingAddModels.length === 0 &&
                  upstreamUpdateMeta.pendingRemoveModels.length === 0
                ) {
                  showInfo(t('该渠道暂无可处理的上游模型更新'));
                  return;
                }
                openUpstreamUpdateModal(
                  record,
                  upstreamUpdateMeta.pendingAddModels,
                  upstreamUpdateMeta.pendingRemoveModels,
                  upstreamUpdateMeta.pendingAddModels.length > 0
                    ? 'add'
                    : 'remove',
                );
              },
            });
          }

          if (record.type === 4) {
            moreMenuItems.unshift({
              node: 'item',
              name: t('测活'),
              type: 'tertiary',
              onClick: () => checkOllamaVersion(record),
            });
          }

          return (
            <Space wrap>
              <SplitButtonGroup
                className='overflow-hidden'
                aria-label={t('测试单个渠道操作项目组')}
              >
                <Button
                  size='small'
                  type='tertiary'
                  onClick={() => testChannel(record, '')}
                >
                  {t('测试')}
                </Button>
                <Button
                  size='small'
                  type='tertiary'
                  icon={<IconTreeTriangleDown />}
                  onClick={() => {
                    setCurrentTestChannel(record);
                    setShowModelTestModal(true);
                  }}
                />
              </SplitButtonGroup>

              {record.status === 1 ? (
                <Button
                  type='danger'
                  size='small'
                  onClick={() => manageChannel(record.id, 'disable', record)}
                >
                  {t('禁用')}
                </Button>
              ) : (
                <Button
                  size='small'
                  onClick={() => manageChannel(record.id, 'enable', record)}
                >
                  {t('启用')}
                </Button>
              )}

              <SplitButtonGroup aria-label={t('渠道操作项目组')}>
                <Button
                  type='tertiary'
                  size='small'
                  onClick={() => {
                    setEditingChannel(record);
                    setShowEdit(true);
                  }}
                >
                  {t('编辑')}
                </Button>
                <Dropdown
                  trigger='click'
                  position='bottomRight'
                  menu={[
                    {
                      node: 'item',
                      name: t('密钥管理'),
                      onClick: () => {
                        setCurrentMultiKeyChannel(record);
                        setShowMultiKeyManageModal(true);
                      },
                    },
                  ]}
                >
                  <Button
                    type='tertiary'
                    size='small'
                    icon={<IconTreeTriangleDown />}
                  />
                </Dropdown>
              </SplitButtonGroup>

              <Dropdown
                trigger='click'
                position='bottomRight'
                menu={moreMenuItems}
              >
                <Button icon={<IconMore />} type='tertiary' size='small' />
              </Dropdown>
            </Space>
          );
        } else {
          // 标签操作按钮
          return (
            <Space wrap>
              <Button
                type='tertiary'
                size='small'
                onClick={() => manageTag(record.key, 'enable')}
              >
                {t('启用全部')}
              </Button>
              <Button
                type='tertiary'
                size='small'
                onClick={() => manageTag(record.key, 'disable')}
              >
                {t('禁用全部')}
              </Button>
              <Button
                type='tertiary'
                size='small'
                onClick={() => {
                  setShowEditTag(true);
                  setEditingTag(record.key);
                }}
              >
                {t('编辑')}
              </Button>
            </Space>
          );
        }
      },
    },
  ];
};
