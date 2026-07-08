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

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Button,
  Switch,
  InputNumber,
  Tag,
  Select,
  Spin,
  Typography,
  Input,
} from '@douyinfe/semi-ui';
import { IconPlus, IconClose } from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../helpers';

const { Text } = Typography;

const MAX_GROUPS = 3;

const formatTime = (ts) => {
  if (!ts) return '-';
  const d = new Date(ts * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const ClawdSettingsModal = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [windowMinutes, setWindowMinutes] = useState(5);
  const [minSampleSize, setMinSampleSize] = useState(100);
  const [watchedChannels, setWatchedChannels] = useState([]);
  const [allChannels, setAllChannels] = useState([]);
  const [groups, setGroups] = useState([]);
  const [pendingPicks, setPendingPicks] = useState({});
  const [events, setEvents] = useState([]);
  const [agentBaseURL, setAgentBaseURL] = useState('');
  const [agentAPIKey, setAgentAPIKey] = useState('');
  const [agentModel, setAgentModel] = useState('');

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
        setAgentBaseURL(cfg.agent_base_url || '');
        setAgentAPIKey(cfg.agent_api_key || '');
        setAgentModel(cfg.agent_model || '');
      }
      const watched = watchedRes.data.success ? watchedRes.data.data || [] : [];
      setWatchedChannels(watched);
      if (allRes.data.success) {
        setAllChannels(allRes.data.data?.items || allRes.data.data || []);
      }
      if (eventsRes.data.success) {
        setEvents(eventsRes.data.data?.events || []);
      }
      const used = Array.from(
        new Set(watched.map((c) => c.clawd_group).filter((g) => g > 0)),
      ).sort((a, b) => a - b);
      setGroups(used.map((g) => ({ id: g })));
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) loadSettings();
  }, [visible, loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await API.put('/api/channel/clawd/setting', {
        enabled,
        window_seconds: windowMinutes * 60,
        min_sample_size: minSampleSize,
        agent_base_url: agentBaseURL,
        agent_api_key: agentAPIKey,
        agent_model: agentModel,
      });
      showSuccess(t('已保存'));
      onClose();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  const handleSetGroup = async (channelId, group) => {
    try {
      await API.post(`/api/channel/clawd/watched/${channelId}`, { group });
      if (group > 0) {
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

  const handleAddToGroup = (groupId) => {
    const idStr = pendingPicks[groupId];
    if (!idStr) return;
    handleSetGroup(Number(idStr), groupId);
    setPendingPicks((prev) => ({ ...prev, [groupId]: '' }));
  };

  const handleAddGroup = () => {
    if (groups.length >= MAX_GROUPS) return;
    const used = new Set(groups.map((g) => g.id));
    let nextId = 1;
    for (let i = 1; i <= MAX_GROUPS; i++) {
      if (!used.has(i)) {
        nextId = i;
        break;
      }
    }
    setGroups((prev) => [...prev, { id: nextId }]);
  };

  const handleRemoveGroup = async (groupId) => {
    const inGroup = watchedChannels.filter((c) => c.clawd_group === groupId);
    await Promise.all(inGroup.map((c) => handleSetGroup(c.id, 0)));
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  };

  const handleResetBaseline = async () => {
    if (!window.confirm(t('确认清空调整记录, 以当前 priority 为新基线?'))) return;
    try {
      await API.post('/api/channel/clawd/reset_baseline');
      showSuccess(t('已重置'));
      loadSettings();
    } catch (e) {
      showError(e);
    }
  };

  const channelsInGroup = (g) => watchedChannels.filter((c) => c.clawd_group === g);
  const availableForGroup = (g) =>
    allChannels.filter((c) => {
      const w = watchedChannels.find((w) => w.id === c.id);
      return !w || w.clawd_group !== g;
    });

  const scoreColor = (s) => (s >= 80 ? 'green' : s >= 50 ? 'orange' : 'red');

  return (
    <Modal
      title={t('Clawd')}
      visible={visible}
      onCancel={onClose}
      width={560}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button type='tertiary' onClick={handleResetBaseline}>
            {t('重置基线')}
          </Button>
          <div>
            <Button onClick={onClose} style={{ marginRight: 8 }}>
              {t('取消')}
            </Button>
            <Button type='primary' onClick={handleSave} loading={saving}>
              {t('保存')}
            </Button>
          </div>
        </div>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : (
        <div style={{ fontSize: 13 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '0 0 8px',
              borderBottom: '1px solid var(--semi-color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
              <span style={{ color: 'var(--semi-color-text-2)' }}>{t('守护')}</span>
              <Switch checked={enabled} onChange={setEnabled} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
              <span style={{ color: 'var(--semi-color-text-2)' }}>{t('周期')}</span>
              <InputNumber
                value={windowMinutes}
                onChange={setWindowMinutes}
                min={1}
                max={60}
                style={{ width: 72 }}
              />
              <span style={{ color: 'var(--semi-color-text-2)', fontSize: 11 }}>
                {t('分')}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto', marginLeft: 'auto' }}>
              <span style={{ color: 'var(--semi-color-text-2)' }}>{t('样本')}</span>
              <InputNumber
                value={minSampleSize}
                onChange={setMinSampleSize}
                min={1}
                style={{ width: 72 }}
              />
              <span style={{ color: 'var(--semi-color-text-2)', fontSize: 11 }}>
                {t('/组')}
              </span>
            </div>
          </div>

          <div
            style={{
              padding: '8px 0',
              borderBottom: '1px solid var(--semi-color-border)',
            }}
          >
            <div
              style={{
                fontWeight: 600,
                marginBottom: 6,
                fontSize: 12,
                color: 'var(--semi-color-text-1)',
              }}
            >
              {t('Agent 配置')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Input
                value={agentBaseURL}
                onChange={setAgentBaseURL}
                placeholder={t('Base URL (如 https://api.openai.com/v1)')}
                size='small'
              />
              <Input
                value={agentAPIKey}
                onChange={setAgentAPIKey}
                placeholder={t('API Key')}
                size='small'
                mode='password'
              />
              <Input
                value={agentModel}
                onChange={setAgentModel}
                placeholder={t('模型 (如 gpt-4o)')}
                size='small'
              />
            </div>
          </div>

          <div style={{ padding: '8px 0 4px' }}>
            {groups.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '16px 0',
                  color: 'var(--semi-color-text-2)',
                  fontSize: 12,
                }}
              >
                {t('暂无监控组别')}
              </div>
            )}
            {groups.map((grp) => {
              const inGroup = channelsInGroup(grp.id);
              const avail = availableForGroup(grp.id);
              return (
                <div
                  key={grp.id}
                  style={{
                    marginBottom: 6,
                    padding: '6px 8px',
                    background: 'var(--semi-color-fill-0)',
                    borderRadius: 4,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: inGroup.length > 0 || avail.length > 0 ? 4 : 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Tag size='small' color='blue' shape='circle' type='ghost'>
                        {t('组')} {grp.id}
                      </Tag>
                      {inGroup.length > 0 && (
                        <span
                          style={{
                            color: 'var(--semi-color-text-2)',
                            fontSize: 11,
                          }}
                        >
                          {inGroup.length}
                        </span>
                      )}
                    </div>
                    <Button
                      size='small'
                      theme='borderless'
                      type='tertiary'
                      icon={<IconClose />}
                      onClick={() => handleRemoveGroup(grp.id)}
                      style={{ padding: 0, minWidth: 20, height: 20 }}
                    />
                  </div>

                  {inGroup.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 3,
                        marginBottom: 4,
                      }}
                    >
                      {inGroup.map((ch) => (
                        <Tag
                          key={ch.id}
                          size='small'
                          color={scoreColor(ch.clawd_score || 0)}
                          closable
                          onClose={() => handleSetGroup(ch.id, 0)}
                        >
                          {ch.id} · {ch.name}
                        </Tag>
                      ))}
                    </div>
                  )}

                  {avail.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <Select
                        value={pendingPicks[grp.id] || ''}
                        onChange={(v) =>
                          setPendingPicks((prev) => ({ ...prev, [grp.id]: v }))
                        }
                        placeholder={t('添加渠道')}
                        style={{ flex: 1, minWidth: 0 }}
                        filter
                        size='small'
                      >
                        {avail.map((c) => (
                          <Select.Option key={c.id} value={c.id}>
                            {c.id} · {c.name}
                          </Select.Option>
                        ))}
                      </Select>
                      <Button
                        size='small'
                        icon={<IconPlus />}
                        onClick={() => handleAddToGroup(grp.id)}
                        disabled={!pendingPicks[grp.id]}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {groups.length < MAX_GROUPS && (
              <Button
                size='small'
                theme='borderless'
                type='tertiary'
                icon={<IconPlus />}
                onClick={handleAddGroup}
                block
              >
                {t('添加组别')}
              </Button>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--semi-color-border)', paddingTop: 6 }}>
            <div
              style={{
                fontWeight: 600,
                marginBottom: 4,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 12 }}>{t('监控记录')}</span>
              <span
                style={{
                  color: 'var(--semi-color-text-2)',
                  fontSize: 11,
                  fontWeight: 400,
                }}
              >
                {events.length}
              </span>
            </div>
            {events.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '12px 0',
                  color: 'var(--semi-color-text-2)',
                  fontSize: 12,
                }}
              >
                {t('暂无记录')}
              </div>
            ) : (
              <div
                style={{
                  maxHeight: 160,
                  overflowY: 'auto',
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              >
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    style={{
                      padding: '2px 0',
                      borderBottom: '1px solid var(--semi-color-fill-1)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text strong style={{ fontSize: 11 }}>
                        {ev.channel_name || `#${ev.channel_id}`}
                      </Text>
                      <Text type='tertiary' size='small'>
                        {formatTime(ev.created_at)}
                      </Text>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Tag size='small' color='blue' type='ghost'>
                        {ev.old_priority} → {ev.new_priority}
                      </Tag>
                      {ev.clawd_group > 0 && (
                        <Tag size='small' color='cyan' type='ghost'>
                          {t('组')} {ev.clawd_group}
                        </Tag>
                      )}
                      <span
                        style={{
                          color: 'var(--semi-color-text-2)',
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ev.reason}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ClawdSettingsModal;