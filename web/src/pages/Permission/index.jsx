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

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Spin, Switch, RadioGroup, Radio, Select, Button, Empty } from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { API, showError, showSuccess } from '../../helpers';

const PAGE_SIZE = 100;
const MAX_PAGES = 200;

const fetchAllPages = async (path, { throwOnFirstPageFailure = false } = {}) => {
  const items = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    let pageItems = [];
    let total = 0;

    try {
      const res = await API.get(`${path}?p=${page}&page_size=${PAGE_SIZE}`);
      if (!res.data.success) {
        if (page === 1 && throwOnFirstPageFailure) {
          throw new Error(res.data.message || 'fetch failed');
        }
        break;
      }

      const data = res.data.data || {};
      pageItems = Array.isArray(data.items) ? data.items : [];
      total = typeof data.total === 'number' ? data.total : 0;
    } catch (e) {
      if (page === 1 && throwOnFirstPageFailure) {
        throw e;
      }
      break;
    }

    if (pageItems.length === 0) {
      break;
    }

    items.push(...pageItems);

    if (total > 0 && items.length >= total) {
      break;
    }

    if (pageItems.length < PAGE_SIZE) {
      break;
    }
  }

  return items;
};

// 默认权限（全部允许）
const DEFAULT_PERMISSIONS = {
  view_usage_logs: true,
  manage_users: 'all',
  manage_channels: 'all',
  view_group_success_rate: true,
  configure_operation_settings: true,
};

const PermissionManagement = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [perms, setPerms] = useState({ ...DEFAULT_PERMISSIONS });
  const [userOptions, setUserOptions] = useState([]);
  const [channelOptions, setChannelOptions] = useState([]);
  const [usersMode, setUsersMode] = useState('all');
  const [channelsMode, setChannelsMode] = useState('all');
  const [userWhitelist, setUserWhitelist] = useState([]);
  const [channelWhitelist, setChannelWhitelist] = useState([]);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/user/admins');
      if (res.data.success) {
        // 后端直接返回 role == 10 的管理员数组（非分页）
        const adminList = res.data.data || [];
        setAdmins(adminList);
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(t('加载管理员列表失败'));
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const [users, channels] = await Promise.all([
        fetchAllPages('/api/user/'),
        fetchAllPages('/api/channel/'),
      ]);
      setUserOptions(users.map((u) => ({ value: u.id, label: `${u.username} (#${u.id})` })));
      setChannelOptions(channels.map((c) => ({ value: c.id, label: `${c.name || '未命名'} (#${c.id})` })));
    } catch (e) {
      // 静默失败
    }
  };

  useEffect(() => {
    fetchAdmins();
    fetchOptions();
  }, []);

  const selectAdmin = async (admin) => {
    setSelectedId(admin.id);
    setSelectedAdmin(admin);
    setLoading(true);
    try {
      const res = await API.get(`/api/permission/user/${admin.id}`);
      if (res.data.success) {
        const p = res.data.data || { ...DEFAULT_PERMISSIONS };
        setPerms({
          view_usage_logs: p.view_usage_logs !== false,
          manage_users: p.manage_users,
          manage_channels: p.manage_channels,
          view_group_success_rate: p.view_group_success_rate !== false,
          configure_operation_settings: p.configure_operation_settings !== false,
        });
        if (Array.isArray(p.manage_users)) {
          setUsersMode('whitelist');
          setUserWhitelist(p.manage_users);
        } else {
          setUsersMode('all');
          setUserWhitelist([]);
        }
        if (Array.isArray(p.manage_channels)) {
          setChannelsMode('whitelist');
          setChannelWhitelist(p.manage_channels);
        } else {
          setChannelsMode('all');
          setChannelWhitelist([]);
        }
      }
    } catch (e) {
      showError(t('加载权限失败'));
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!selectedId) return;
    setSaving(true);
    const payload = {
      view_usage_logs: perms.view_usage_logs,
      manage_users: usersMode === 'all' ? 'all' : userWhitelist,
      manage_channels: channelsMode === 'all' ? 'all' : channelWhitelist,
      view_group_success_rate: perms.view_group_success_rate,
      configure_operation_settings: perms.configure_operation_settings,
    };
    try {
      const res = await API.put(`/api/permission/user/${selectedId}`, payload);
      if (res.data.success) {
        showSuccess(t('权限已保存'));
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(t('保存失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='px-6 lg:px-10 py-8'>
      {/* 标题区 — 与 Channel/User 页一致 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className='mb-6'
      >
        <h1 className='text-[22px] font-semibold text-[#1A1A1A]'>{t('权限管理')}</h1>
        <p className='text-[13px] text-[#999] mt-1'>
          {t('为每个管理员配置细粒度权限。默认全部允许；白名单模式下只能管理选中的用户/渠道。仅超级管理员可配置。')}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className='grid grid-cols-1 lg:grid-cols-3 gap-4'
      >
        {/* 左侧：管理员列表 */}
        <div className='lg:col-span-1'>
          <div className='bg-white rounded-xl border border-[#F0F0F0] overflow-hidden'>
            <div className='px-4 py-3 border-b border-[#F0F0F0]'>
              <span className='text-[14px] font-medium text-[#1A1A1A]'>{t('管理员列表')}</span>
            </div>
            <Spin spinning={loading && !selectedId}>
              <div className='max-h-[520px] overflow-y-auto'>
                {admins.length === 0 ? (
                  <div className='flex justify-center items-center py-10'>
                    <Empty
                      image={<IllustrationNoResult style={{ width: 120, height: 120 }} />}
                      darkModeImage={<IllustrationNoResultDark style={{ width: 120, height: 120 }} />}
                      title={t('暂无管理员')}
                    />
                  </div>
                ) : (
                  admins.map((admin) => {
                    const isActive = selectedId === admin.id;
                    return (
                      <div
                        key={admin.id}
                        onClick={() => selectAdmin(admin)}
                        className='flex items-center justify-between px-4 py-3 cursor-pointer transition-colors'
                        style={{
                          backgroundColor: isActive ? '#F5F5F5' : 'transparent',
                          borderLeft: isActive ? '3px solid #1A1A1A' : '3px solid transparent',
                        }}
                        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = '#FAFAFA'; }}
                        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <div className='flex items-center gap-3 min-w-0 flex-1'>
                          <div className='w-8 h-8 rounded-full bg-[#F5F5F5] flex items-center justify-center text-[12px] font-medium text-[#666] shrink-0'>
                            {(admin.display_name || admin.username || '?').slice(0, 1).toUpperCase()}
                          </div>
                          <div className='min-w-0'>
                            <div className='text-[13px] font-medium text-[#1A1A1A] truncate'>
                              {admin.display_name || admin.username}
                            </div>
                            <div className='text-[11px] text-[#999] truncate'>
                              {admin.username} · #{admin.id}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Spin>
          </div>
        </div>

        {/* 右侧：权限表单 */}
        <div className='lg:col-span-2'>
          <div className='bg-white rounded-xl border border-[#F0F0F0] overflow-hidden'>
            <div className='px-4 py-3 border-b border-[#F0F0F0] flex items-center justify-between'>
              <span className='text-[14px] font-medium text-[#1A1A1A]'>{t('权限配置')}</span>
              {selectedAdmin && (
                <span className='text-[12px] text-[#999]'>
                  {t('当前')}：{selectedAdmin.display_name || selectedAdmin.username} · #{selectedAdmin.id}
                </span>
              )}
            </div>

            {!selectedId ? (
              <div className='flex justify-center items-center py-16'>
                <Empty
                  image={<IllustrationNoResult style={{ width: 120, height: 120 }} />}
                  darkModeImage={<IllustrationNoResultDark style={{ width: 120, height: 120 }} />}
                  title={t('请从左侧选择一位管理员')}
                />
              </div>
            ) : (
              <Spin spinning={loading && !!selectedId}>
                <div className='p-5'>
                  {/* 1. 查看使用日志 */}
                  <PermRow
                    title={t('查看使用日志')}
                    desc={t('允许该管理员查看"使用日志"页面')}
                  >
                    <Switch
                      checked={perms.view_usage_logs}
                      onChange={(v) => setPerms({ ...perms, view_usage_logs: v })}
                    />
                  </PermRow>

                  {/* 2. 查看分组模型成功率 */}
                  <PermRow
                    title={t('查看分组模型成功率')}
                    desc={t('允许该管理员查看 Dashboard 上的"分组模型成功率"面板')}
                  >
                    <Switch
                      checked={perms.view_group_success_rate}
                      onChange={(v) => setPerms({ ...perms, view_group_success_rate: v })}
                    />
                  </PermRow>

                  {/* 3. 配置运营设置 */}
                  <PermRow
                    title={t('配置运营设置')}
                    desc={t('允许该管理员访问"运营设置"页面')}
                  >
                    <Switch
                      checked={perms.configure_operation_settings}
                      onChange={(v) => setPerms({ ...perms, configure_operation_settings: v })}
                    />
                  </PermRow>

                  {/* 4. 管理用户 */}
                  <PermRow
                    title={t('管理用户')}
                    desc={t('all = 管理所有用户；白名单 = 仅可管理选中的用户')}
                  >
                    <RadioGroup
                      value={usersMode}
                      onChange={(e) => setUsersMode(e.target.value)}
                    >
                      <Radio value='all'>{t('全部 (all)')}</Radio>
                      <Radio value='whitelist'>{t('白名单')}</Radio>
                    </RadioGroup>
                  </PermRow>
                  {usersMode === 'whitelist' && (
                    <div className='pb-4'>
                      <Select
                        multiple
                        placeholder={t('选择可管理的用户')}
                        optionList={userOptions}
                        value={userWhitelist}
                        onChange={setUserWhitelist}
                        style={{ width: '100%' }}
                        className='w-full'
                      />
                    </div>
                  )}

                  {/* 5. 管理渠道 */}
                  <PermRow
                    title={t('管理渠道')}
                    desc={t('all = 管理所有渠道；白名单 = 仅可管理选中的渠道')}
                    last
                  >
                    <RadioGroup
                      value={channelsMode}
                      onChange={(e) => setChannelsMode(e.target.value)}
                    >
                      <Radio value='all'>{t('全部 (all)')}</Radio>
                      <Radio value='whitelist'>{t('白名单')}</Radio>
                    </RadioGroup>
                  </PermRow>
                  {channelsMode === 'whitelist' && (
                    <div className='pb-4'>
                      <Select
                        multiple
                        placeholder={t('选择可管理的渠道')}
                        optionList={channelOptions}
                        value={channelWhitelist}
                        onChange={setChannelWhitelist}
                        style={{ width: '100%' }}
                        className='w-full'
                      />
                    </div>
                  )}

                  <div className='pt-4 border-t border-[#F0F0F0] mt-1'>
                    <Button
                      type='primary'
                      theme='solid'
                      loading={saving}
                      onClick={save}
                      disabled={!selectedId}
                      style={{ borderRadius: 8 }}
                    >
                      {t('保存')}
                    </Button>
                  </div>
                </div>
              </Spin>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// PermRow — 统一的"标题 + 描述 + 控件"行布局，带分隔线
const PermRow = ({ title, desc, children, last }) => (
  <div
    className={`flex items-center justify-between gap-4 py-4 ${last ? '' : 'border-b border-[#F0F0F0]'}`}
  >
    <div className='min-w-0 flex-1'>
      <div className='text-[13px] font-medium text-[#1A1A1A]'>{title}</div>
      {desc && <div className='text-[11px] text-[#999] mt-1'>{desc}</div>}
    </div>
    <div className='shrink-0 self-center'>{children}</div>
  </div>
);

export default PermissionManagement;
