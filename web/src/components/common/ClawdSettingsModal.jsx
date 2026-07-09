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

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Button,
  Switch,
  InputNumber,
  Select,
  Spin,
  Collapse,
  Tag,
  Checkbox,
} from '@douyinfe/semi-ui';
import { IconClose } from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../helpers';

const formatTime = (ts) => {
  if (!ts) return '-';
  const d = new Date(ts * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const DEFAULT_GROUP_CONFIG = {
  price_weight: 0.45,
  success_weight: 0.35,
  latency_weight: 0.20,
};

const ClawdSettingsModal = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [windowMinutes, setWindowMinutes] = useState(5);
  const [minSampleSize, setMinSampleSize] = useState(100);
  const [groupConfigs, setGroupConfigs] = useState({});
  const [watchedChannels, setWatchedChannels] = useState([]);
  const [allChannels, setAllChannels] = useState([]);
  const [events, setEvents] = useState([]);
  const [monitoredGroups, setMonitoredGroups] = useState([]);
  const [activeKey, setActiveKey] = useState([]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const [settingRes, watchedRes, allRes, eventsRes] = await Promise.all([
        API.get('/api/channel/clawd/setting'),
        API.get('/api/channel/clawd/watched'),
        API.get('/api/channel/?p=0&page_size=200'),
        API.get('/api/channel/clawd/events?limit=30'),
      ]);
      if (settingRes.data.success) {
        const cfg = settingRes.data.data;
        setEnabled(!!cfg.enabled);
        setWindowMinutes(Math.round((cfg.window_seconds || 300) / 60));
        setMinSampleSize(cfg.min_sample_size || 100);
        setGroupConfigs(cfg.group_configs || {});
      }
      const watched = watchedRes.data.success ? watchedRes.data.data || [] : [];
      setWatchedChannels(watched);
      if (allRes.data.success) {
        setAllChannels(allRes.data.data?.items || allRes.data.data || []);
      }
      if (eventsRes.data.success) {
        setEvents(eventsRes.data.data?.events || []);
      }
      const groups = Array.from(
        new Set(
          watched
            .map((c) => c.clawd_group)
            .filter((g) => g && g !== ''),
        ),
      ).sort();
      setMonitoredGroups(groups);
      setActiveKey(groups);
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) loadSettings();
  }, [visible, loadSettings]);

  const availableUserGroups = useMemo(() => {
    const set = new Set();
    for (const ch of allChannels) {
      if (ch.group) {
        for (const g of ch.group.split(',')) {
          const trimmed = g.trim();
          if (trimmed) set.add(trimmed);
        }
      }
    }
    return Array.from(set).sort();
  }, [allChannels]);

  const groupedEventsByClawdGroup = useMemo(() => {
    const byGroup = {};
    for (const ev of events) {
      const g = String(ev.clawd_group || '');
      if (!byGroup[g]) byGroup[g] = {};
      const key = ev.created_at;
      if (!byGroup[g][key]) byGroup[g][key] = [];
      byGroup[g][key].push(ev);
    }
    const result = {};
    for (const [g, tsMap] of Object.entries(byGroup)) {
      result[g] = Object.entries(tsMap)
        .sort((a, b) => Number(b[0]) - Number(a[0]))
        .map(([ts, evs]) => {
          const before = evs
            .map((ev) => `${ev.channel_name || '#' + ev.channel_id}: ${ev.old_priority}`)
            .join(', ');
          const after = evs
            .map((ev) => `${ev.channel_name || '#' + ev.channel_id}: ${ev.new_priority}`)
            .join(', ');
          return { created_at: Number(ts), before, after };
        });
    }
    return result;
  }, [events]);

  const unusedGroups = availableUserGroups.filter(
    (g) => !monitoredGroups.includes(g),
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await API.put('/api/channel/clawd/setting', {
        enabled,
        window_seconds: windowMinutes * 60,
        min_sample_size: minSampleSize,
        group_configs: groupConfigs,
      });
      showSuccess(t('已保存'));
      onClose();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  const handleAddGroup = (groupName) => {
    if (!groupName || monitoredGroups.includes(groupName)) return;
    setMonitoredGroups((prev) => [...prev, groupName].sort());
    if (!groupConfigs[groupName]) {
      setGroupConfigs((prev) => ({
        ...prev,
        [groupName]: { ...DEFAULT_GROUP_CONFIG },
      }));
    }
    setActiveKey((prev) => [...prev, groupName]);
    setAddGroupKey((k) => k + 1);
  };

  const handleRemoveGroup = async (groupName) => {
    const inGroup = watchedChannels.filter((c) => c.clawd_group === groupName);
    setMonitoredGroups((prev) => prev.filter((g) => g !== groupName));
    setActiveKey((prev) => prev.filter((k) => k !== groupName));
    setWatchedChannels((prev) =>
      prev.filter((c) => c.clawd_group !== groupName),
    );
    try {
      await Promise.all(
        inGroup.map((c) =>
          API.post(`/api/channel/clawd/watched/${c.id}`, {
            group: '',
            cost_ratio: 0,
          }),
        ),
      );
    } catch (e) {
      showError(e);
    }
  };

  const handleSetGroup = async (channelId, group) => {
    try {
      await API.post(`/api/channel/clawd/watched/${channelId}`, {
        group,
        cost_ratio: 0,
      });
      if (group) {
        const ch = allChannels.find((c) => c.id === channelId);
        if (ch) {
          setWatchedChannels((prev) => {
            const without = prev.filter((c) => c.id !== channelId);
            return [
              ...without,
              {
                id: ch.id,
                name: ch.name,
                group: ch.group,
                clawd_group: group,
                clawd_cost_ratio: 0,
                priority: ch.priority,
                clawd_score: 0,
                clawd_tune_reason: '',
                clawd_last_tune_at: 0,
                clawd_in_observation: false,
              },
            ];
          });
        }
      } else {
        setWatchedChannels((prev) => prev.filter((c) => c.id !== channelId));
      }
    } catch (e) {
      showError(e);
    }
  };

  const handleSetCostRatio = async (channelId, ratio) => {
    try {
      await API.post(`/api/channel/clawd/cost_ratio/${channelId}`, {
        cost_ratio: ratio,
      });
      setWatchedChannels((prev) =>
        prev.map((c) =>
          c.id === channelId ? { ...c, clawd_cost_ratio: ratio } : c,
        ),
      );
    } catch (e) {
      showError(e);
    }
  };

  const handleGroupConfigChange = (groupName, field, value) => {
    setGroupConfigs((prev) => ({
      ...prev,
      [groupName]: {
        ...(prev[groupName] || DEFAULT_GROUP_CONFIG),
        [field]: value,
      },
    }));
  };

  const handleResetBaseline = async () => {
    if (!window.confirm(t('确认清空调整记录, 以当前 priority 为新基线?')))
      return;
    try {
      await API.post('/api/channel/clawd/reset_baseline');
      showSuccess(t('已重置'));
      loadSettings();
    } catch (e) {
      showError(e);
    }
  };

  const channelsForUserGroup = (groupName) =>
    allChannels.filter((ch) => {
      if (!ch.group) return false;
      return ch.group
        .split(',')
        .map((g) => g.trim())
        .includes(groupName);
    });

  const channelsInGroup = (groupName) =>
    watchedChannels.filter((c) => c.clawd_group === groupName);

  const labelStyle = {
    fontSize: 11,
    color: 'var(--semi-color-text-2)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };

  return (
    <Modal
      title={t('Clawd')}
      visible={visible}
      onCancel={onClose}
      width={700}
      bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
      footer={
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Button
            type='tertiary'
            size='small'
            theme='borderless'
            onClick={handleResetBaseline}
          >
            {t('重置基线')}
          </Button>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={onClose} size='small'>
              {t('取消')}
            </Button>
            <Button
              type='primary'
              onClick={handleSave}
              loading={saving}
              size='small'
            >
              {t('保存')}
            </Button>
          </div>
        </div>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin />
        </div>
      ) : (
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          {/* ── 基础设置 ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0,
              }}
            >
              <span style={labelStyle}>{t('守护')}</span>
              <Switch checked={enabled} onChange={setEnabled} size='small' />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0,
              }}
            >
              <span style={labelStyle}>{t('周期')}</span>
              <InputNumber
                value={windowMinutes}
                onChange={setWindowMinutes}
                min={1}
                max={60}
                size='small'
                style={{ width: 68, minWidth: 68 }}
                suffix={
                  <span style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{t('分')}</span>
                }
                hideButtons
              />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0,
              }}
            >
              <span style={labelStyle}>{t('样本')}</span>
              <InputNumber
                value={minSampleSize}
                onChange={setMinSampleSize}
                min={1}
                size='small'
                style={{ width: 72, minWidth: 72 }}
                suffix={
                  <span style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{t('/组')}</span>
                }
                hideButtons
              />
            </div>
          </div>

          {/* ── 添加组别 ── */}
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid var(--semi-color-border)',
            }}
          >
            {unusedGroups.length > 0 ? (
              <Select
                key={addGroupKey}
                filter
                placeholder={t('+ 选择用户组加入监控')}
                style={{ width: '100%' }}
                size='small'
                onChange={(val) => handleAddGroup(val)}
              >
                {unusedGroups.map((g) => (
                  <Select.Option key={g} value={g}>
                    {g}
                  </Select.Option>
                ))}
              </Select>
            ) : null}
          </div>

          {/* ── 监控组别 ── */}
          {monitoredGroups.length > 0 && (
            <Collapse
              activeKey={activeKey}
              onChange={(keys) => setActiveKey(keys || [])}
              style={{ marginTop: 8 }}
            >
              {monitoredGroups.map((groupName) => {
                const inGroup = channelsInGroup(groupName);
                const availChannels = channelsForUserGroup(groupName);
                const gc =
                  groupConfigs[groupName] || DEFAULT_GROUP_CONFIG;
                const weightSum = Math.round(
                  (gc.price_weight +
                    gc.success_weight +
                    gc.latency_weight) *
                    100,
                );
                return (
                  <Collapse.Panel
                    key={groupName}
                    arrow={null}
                    header={
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          minWidth: 0,
                          width: '100%',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            flex: '1 1 auto',
                            minWidth: 0,
                          }}
                        >
                          {groupName}
                        </span>
                        <Button
                          size='small'
                          theme='borderless'
                          type='tertiary'
                          icon={<IconClose />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveGroup(groupName);
                          }}
                          style={{
                            padding: 0,
                            minWidth: 20,
                            height: 20,
                            flexShrink: 0,
                          }}
                        />
                      </div>
                    }
                  >
                    {/* 权重配置 */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        flexWrap: 'nowrap',
                        marginBottom: 8,
                      }}
                    >
                      <span style={labelStyle}>{t('权重')}</span>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--semi-color-primary)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t('价格')}
                        </span>
                        <InputNumber
                          value={Math.round(gc.price_weight * 100)}
                          onChange={(v) =>
                            handleGroupConfigChange(
                              groupName,
                              'price_weight',
                              (v || 0) / 100,
                            )
                          }
                          min={0}
                          max={100}
                          size='small'
                          style={{ width: 54 }}
                          suffix={
                            <span style={{ fontSize: 10 }}>%</span>
                          }
                          hideButtons
                        />
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--semi-color-success)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t('成功')}
                        </span>
                        <InputNumber
                          value={Math.round(gc.success_weight * 100)}
                          onChange={(v) =>
                            handleGroupConfigChange(
                              groupName,
                              'success_weight',
                              (v || 0) / 100,
                            )
                          }
                          min={0}
                          max={100}
                          size='small'
                          style={{ width: 54 }}
                          suffix={
                            <span style={{ fontSize: 10 }}>%</span>
                          }
                          hideButtons
                        />
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--semi-color-tertiary)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t('速度')}
                        </span>
                        <InputNumber
                          value={Math.round(gc.latency_weight * 100)}
                          onChange={(v) =>
                            handleGroupConfigChange(
                              groupName,
                              'latency_weight',
                              (v || 0) / 100,
                            )
                          }
                          min={0}
                          max={100}
                          size='small'
                          style={{ width: 54 }}
                          suffix={
                            <span style={{ fontSize: 10 }}>%</span>
                          }
                          hideButtons
                        />
                      </div>
                      {weightSum !== 100 && (
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--semi-color-danger)',
                            flexShrink: 0,
                          }}
                        >
                          Σ={weightSum}%
                        </span>
                      )}
                    </div>

                    {/* 渠道列表（多选+配置合并） */}
                    <div style={{ marginTop: 4 }}>
                      {availChannels.map((ch) => {
                        const watched = inGroup.find((c) => c.id === ch.id);
                        return (
                          <div
                            key={ch.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 0',
                              borderBottom: '1px solid var(--semi-color-fill-1)',
                            }}
                          >
                            <Checkbox
                              checked={!!watched}
                              onChange={(e) =>
                                handleSetGroup(ch.id, e.target.checked ? groupName : '')
                              }
                              size='small'
                              style={{ flexShrink: 0 }}
                            />
                            <span
                              style={{
                                flex: '1 1 auto',
                                minWidth: 0,
                                fontSize: 12,
                                color: 'var(--semi-color-text-1)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {ch.name}
                            </span>
                            {watched && (
                              <InputNumber
                                value={watched.clawd_cost_ratio || 0}
                                onChange={(v) => handleSetCostRatio(ch.id, v || 0)}
                                min={0}
                                max={10}
                                step={0.1}
                                precision={2}
                                size='small'
                                style={{ width: 56, flexShrink: 0 }}
                                suffix={<span style={{ fontSize: 10 }}>×</span>}
                                hideButtons
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {(() => {
                      const groupEvents = groupedEventsByClawdGroup[groupName] || [];
                      if (groupEvents.length === 0) return null;
                      return (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--semi-color-border)' }}>
                          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                            {t('调整记录')}
                          </div>
                          <div style={{ maxHeight: 100, overflowY: 'auto', fontSize: 11, lineHeight: 1.6 }}>
                            {groupEvents.map((grp) => (
                              <div
                                key={grp.created_at}
                                style={{
                                  padding: '2px 0',
                                  color: 'var(--semi-color-text-2)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {formatTime(grp.created_at)}{' '}
                                <span style={{ color: 'var(--semi-color-text-1)' }}>
                                  [{grp.before}] → [{grp.after}]
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </Collapse.Panel>
                );
              })}
            </Collapse>
          )}
        </div>
      )}
    </Modal>
  );
};

export default ClawdSettingsModal;
