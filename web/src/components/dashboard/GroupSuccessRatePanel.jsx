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

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { API, isAdmin, isRoot, getAdminPermissions } from '../../helpers';

const TIME_RANGES = [
  { key: '1m', label: '1分钟', seconds: 60 },
  { key: '10m', label: '10分钟', seconds: 600 },
  { key: '1h', label: '1小时', seconds: 3600 },
];

const RATE_TIERS = [
  { min: 95, color: '#16a34a', bg: '#f0fdf4', dot: '#22c55e' },
  { min: 80, color: '#65a30d', bg: '#f7fee0', dot: '#84cc16' },
  { min: 60, color: '#d97706', bg: '#fffbeb', dot: '#f59e0b' },
  { min: 0, color: '#dc2626', bg: '#fef2f2', dot: '#ef4444' },
];

const rateTier = (rate) => RATE_TIERS.find((t) => rate >= t.min) || RATE_TIERS[RATE_TIERS.length - 1];

const fmt = (n) => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
};

const fmtUseTime = (sec) => {
  if (!sec || sec <= 0) return '–';
  if (sec < 1) return `${(sec).toFixed(1)}s`;
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s === 0 ? `${m}m` : `${m}m${s}s`;
};

const ClockIcon = ({ className = '' }) => (
  <svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
    <circle cx='12' cy='12' r='9' />
    <path d='M12 7v5l3 2' />
  </svg>
);

const GroupSuccessRatePanel = () => {
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [timeRange, setTimeRange] = useState('10m');

  const visible = isRoot() || (isAdmin() && getAdminPermissions().view_group_success_rate);

  const fetchData = async (range) => {
    if (!visible) return;
    setLoading(true);
    try {
      const now = Math.floor(Date.now() / 1000);
      const rangeConfig = TIME_RANGES.find((r) => r.key === range);
      const startTimestamp = now - rangeConfig.seconds;
      const res = await API.get(`/api/log/group_success_rate?start_timestamp=${startTimestamp}&end_timestamp=${now}`);
      if (res.data.success) {
        setData(res.data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch group success rate:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(timeRange);
  }, [timeRange]);

  const groupedByGroup = useMemo(() => {
    const groupMap = {};
    for (const item of data) {
      const groupKey = String(item.group || 'default');
      if (!groupMap[groupKey]) {
        groupMap[groupKey] = { group: groupKey, models: [] };
      }
      groupMap[groupKey].models.push(item);
    }
    for (const key of Object.keys(groupMap)) {
      groupMap[key].models.sort((a, b) => b.total_count - a.total_count);
    }
    return Object.values(groupMap).sort((a, b) => {
      const totalA = a.models.reduce((s, x) => s + x.total_count, 0);
      const totalB = b.models.reduce((s, x) => s + x.total_count, 0);
      return totalB - totalA;
    });
  }, [data]);

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!visible) return null;

  return (
    <div className='mt-8'>
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-baseline gap-2'>
          <h2 className='text-[15px] font-semibold text-[#1A1A1A]'>{t('分组模型成功率')}</h2>
          <span className='text-[11px] text-[#bbb] font-normal'>{t('按分组 × 模型聚合')}</span>
        </div>
        <div className='flex items-center gap-0.5 bg-[#F2F2F2] rounded-[10px] p-[3px]'>
          {TIME_RANGES.map((r) => (
            <button
              key={r.key}
              className={`px-3 py-[5px] text-[12px] rounded-[7px] transition-all duration-150 ${
                timeRange === r.key
                  ? 'bg-white text-[#1A1A1A] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                  : 'text-[#999] hover:text-[#666] font-medium'
              }`}
              onClick={() => setTimeRange(r.key)}
              disabled={loading}
            >
              {t(r.label)}
            </button>
          ))}
        </div>
      </div>

      {loading && data.length === 0 ? (
        <div className='bg-white rounded-2xl border border-[#F0F0F0] p-10 text-center text-[#C8C8C8] text-[13px]'>
          <div className='inline-block w-4 h-4 border-2 border-[#E0E0E0] border-t-[#999] rounded-full animate-spin mb-2' />
          <div>{t('加载中')}...</div>
        </div>
      ) : data.length === 0 ? (
        <div className='bg-white rounded-2xl border border-[#F0F0F0] p-10 text-center'>
          <div className='text-[13px] text-[#C8C8C8]'>{t('暂无数据')}</div>
        </div>
      ) : (
        <div className='space-y-2.5'>
          {groupedByGroup.map((g) => {
            const groupKey = g.group;
            const isExpanded = expandedGroups[groupKey];
            const totalReqs = g.models.reduce((s, x) => s + x.total_count, 0);
            const totalSuccess = g.models.reduce((s, x) => s + x.success_count, 0);
            const overallRate = totalReqs > 0 ? (totalSuccess / totalReqs * 100) : 0;
            const tier = rateTier(overallRate);
            const topModels = isExpanded ? g.models : g.models.slice(0, 3);
            const hasMore = g.models.length > 3;

            return (
              <div
                key={groupKey}
                className='bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden transition-shadow hover:shadow-[0_2px_12px_rgba(0,0,0,0.04)]'
              >
                <div
                  className='flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-[#FAFAFA] transition-colors'
                  onClick={() => toggleGroup(groupKey)}
                >
                  <div className='flex items-center gap-2.5 min-w-0 flex-1'>
                    <svg
                      className={`w-3 h-3 text-[#bbb] transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                      viewBox='0 0 24 24' fill='currentColor'
                    >
                      <path d='m20.56 9.66-7.8 8.97a1 1 0 0 1-1.51 0L3.44 9.66A1 1 0 0 1 4.19 8h15.62a1 1 0 0 1 .75 1.66Z' />
                    </svg>
                    <span className='text-[13px] font-semibold truncate text-[#1A1A1A]'>
                      {groupKey}
                    </span>
                    <span className='text-[11px] text-[#bbb] flex-shrink-0'>
                      {g.models.length} {t('个模型')}
                    </span>
                  </div>
                  <div className='flex items-center gap-3 flex-shrink-0 ml-4'>
                    <span className='text-[11px] text-[#999] tabular-nums min-w-[55px] text-right'>
                      {fmt(totalSuccess)}/{fmt(totalReqs)}
                    </span>
                    <div
                      className='flex items-center gap-1.5 px-2 py-1 rounded-md'
                      style={{ backgroundColor: tier.bg }}
                    >
                      <div className='w-1.5 h-1.5 rounded-full flex-shrink-0' style={{ backgroundColor: tier.dot }} />
                      <span className='text-[12px] font-semibold tabular-nums' style={{ color: tier.color }}>
                        {overallRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className='border-t border-[#F5F5F5] bg-[#FBFBFB]/50'>
                    <div className='grid grid-cols-[1fr_auto] gap-2 px-4 py-1.5 text-[10px] text-[#bbb] font-medium uppercase tracking-wide border-b border-[#F5F5F5]'>
                      <span>{t('模型')}</span>
                      <div className='flex items-center gap-3'>
                        <span className='min-w-[40px] text-right'>{t('平均耗时')}</span>
                        <span className='min-w-[50px] text-right'>{t('成功/总')}</span>
                        <span className='min-w-[88px] text-right'>{t('成功率')}</span>
                      </div>
                    </div>
                    {topModels.map((m) => {
                      const rate = m.total_count > 0 ? (m.success_count / m.total_count * 100) : 0;
                      const mTier = rateTier(rate);
                      return (
                        <div
                          key={`${m.group}-${m.model_name}`}
                          className='grid grid-cols-[1fr_auto] gap-2 px-4 py-2.5 items-center hover:bg-white transition-colors border-b border-[#F5F5F5] last:border-b-0'
                        >
                          <span className='text-[12px] text-[#333] truncate font-medium' title={m.model_name}>
                            {m.model_name}
                          </span>
                          <div className='flex items-center gap-3 flex-shrink-0'>
                            <span className='text-[11px] text-[#999] tabular-nums min-w-[40px] text-right flex items-center justify-end gap-0.5'>
                              <ClockIcon className='w-2.5 h-2.5 opacity-60' />
                              {fmtUseTime(m.avg_use_time)}
                            </span>
                            <span className='text-[11px] text-[#999] tabular-nums min-w-[50px] text-right'>
                              {fmt(m.success_count)}/{fmt(m.total_count)}
                            </span>
                            <div className='flex items-center gap-2 min-w-[88px] justify-end'>
                              <div className='w-14 h-[5px] bg-[#F0F0F0] rounded-full overflow-hidden'>
                                <div
                                  className='h-full rounded-full transition-all duration-500'
                                  style={{ width: `${Math.max(rate, 1)}%`, backgroundColor: mTier.dot }}
                                />
                              </div>
                              <span
                                className='text-[11px] font-semibold tabular-nums min-w-[42px] text-right px-1.5 py-0.5 rounded'
                                style={{ color: mTier.color, backgroundColor: mTier.bg }}
                              >
                                {rate.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {hasMore && !isExpanded && (
                      <div
                        className='text-[11px] text-[#2563eb] text-center py-1.5 cursor-pointer hover:underline'
                        onClick={(e) => { e.stopPropagation(); toggleGroup(groupKey); }}
                      >
                        {t('更多')} {g.models.length - 3} {t('个模型')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GroupSuccessRatePanel;
