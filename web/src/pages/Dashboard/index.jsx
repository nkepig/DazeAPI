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

import React, { useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Zap, Activity, Wallet, Building2, Copy, Check, X, Terminal } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { API, isAdmin, renderQuota, goToRecharge, getTodayStartTimestamp, copy, showSuccess, setUserData } from '../../helpers';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import ChannelSuccessRatePanel from '../../components/dashboard/GroupSuccessRatePanel';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: 'easeOut' },
  }),
};

function CountUp({ end, duration = 1200, prefix = '', suffix = '', formatter }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (end === 0) { setVal(0); return; }
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * end));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [end, duration]);
  if (formatter) return <>{formatter(val)}</>;
  return <>{prefix}{val.toLocaleString()}{suffix}</>;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return '早上好';
  if (h < 18) return '下午好';
  return '晚上好';
}

function ChartTooltip({ active, payload, label, metric: metricType, t }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  const display = metricType === 'quota' ? renderQuota(val, 2) : `${val?.toLocaleString()} ${t('次')}`;
  return (
    <div className='bg-white border border-[#EBEBEB] rounded-lg shadow-sm px-3 py-2'>
      <p className='text-[11px] text-[#999] mb-0.5'>{label}</p>
      <p className='text-sm font-semibold text-[#1A1A1A]'>{display}</p>
    </div>
  );
}

const CHART_COLORS = [
  '#1A1A1A', '#6366f1', '#0891b2', '#16a34a', '#ea580c',
  '#e11d48', '#9333ea', '#d97706', '#0d9488', '#2563eb',
];

const TOP_MODEL_COUNT = 5;

// Quickstart: short labels, abbreviated curl, tokenised for syntax colour
const QS_SCENARIOS = [
  {
    key: 'openai',
    label: 'OpenAI',
    tokens: (base) => [
      { t: 'curl ', c: 'tk-cmd' },
      { t: `${base}/v1/chat/completions`, c: 'tk-str' },
      { t: ' \\\n  -H ', c: 'tk-flag' },
      { t: '"Authorization: Bearer sk-..."', c: 'tk-str' },
      { t: ' \\\n  -d ', c: 'tk-flag' },
      { t: '\'{"model":"gpt-5","messages":[{"role":"user","content":"Hi"}]}\'', c: 'tk-str' },
    ],
  },
  {
    key: 'gemini',
    label: 'Gemini',
    tokens: (base) => [
      { t: 'curl ', c: 'tk-cmd' },
      { t: `${base}/v1beta/models/gemini-3-flash-preview:generateContent`, c: 'tk-str' },
      { t: ' \\\n  -H ', c: 'tk-flag' },
      { t: '"Authorization: Bearer sk-..."', c: 'tk-str' },
      { t: ' \\\n  -d ', c: 'tk-flag' },
      { t: '\'{"contents":[{"parts":[{"text":"Hi"}]}]}\'', c: 'tk-str' },
    ],
  },
  {
    key: 'claude',
    label: 'Claude',
    tokens: (base) => [
      { t: 'curl ', c: 'tk-cmd' },
      { t: `${base}/v1/messages`, c: 'tk-str' },
      { t: ' \\\n  -H ', c: 'tk-flag' },
      { t: '"Authorization: Bearer sk-..."', c: 'tk-str' },
      { t: ' \\\n  -H ', c: 'tk-flag' },
      { t: '"anthropic-version: 2023-06-01"', c: 'tk-str' },
      { t: ' \\\n  -d ', c: 'tk-flag' },
      { t: '\'{"model":"claude-sonnet-4-5","max_tokens":1024,"messages":[{"role":"user","content":"Hi"}]}\'', c: 'tk-str' },
    ],
  },
  {
    key: 'image',
    label: '生图',
    tokens: (base) => [
      { t: 'curl ', c: 'tk-cmd' },
      { t: `${base}/v1/images/generations`, c: 'tk-str' },
      { t: ' \\\n  -H ', c: 'tk-flag' },
      { t: '"Authorization: Bearer sk-..."', c: 'tk-str' },
      { t: ' \\\n  -d ', c: 'tk-flag' },
      { t: '\'{"model":"gpt-image-2","prompt":"A cat playing piano"}\'', c: 'tk-str' },
    ],
  },
];

const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const [stats, setStats] = useState({ quota: 0, requests: 0, balance: 0, models: 0 });
  const [runwayDays, setRunwayDays] = useState(null);
  const [rawData, setRawData] = useState([]);
  const [chartRange, setChartRange] = useState(1);
  const [metric, setMetric] = useState('quota');
  const [selectedModel, setSelectedModel] = useState('all');
  const [showAllModels, setShowAllModels] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tokenCount, setTokenCount] = useState(null);
  const [qsScenario, setQsScenario] = useState('openai');
  const [copied, setCopied] = useState(false);
  const [guideDismissed, setGuideDismissed] = useState(
    () => localStorage.getItem('daze_guide_dismissed') || '',
  );

  const qsTokens = useMemo(() => {
    const s = QS_SCENARIOS.find((x) => x.key === qsScenario) || QS_SCENARIOS[0];
    return s.tokens(window.location.origin);
  }, [qsScenario]);
  const snippet = useMemo(() => qsTokens.map((x) => x.t).join(''), [qsTokens]);

  const username = userState?.user?.display_name || userState?.user?.username || '';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const now = Math.floor(Date.now() / 1000);
      const todayStart = getTodayStartTimestamp();
      const chartStart = chartRange === 1 ? todayStart : todayStart - (chartRange - 1) * 86400;
      const sevenDayStart = todayStart - 6 * 86400;
      const rangeStart = Math.min(chartStart, sevenDayStart);

      const endpoint = isAdmin() ? '/api/data/' : '/api/data/self';
      const sep = endpoint.includes('?') ? '&' : '?';

      const [selfRes, dataRes, pricingRes, statRes] = await Promise.all([
        API.get('/api/user/self'),
        API.get(`${endpoint}${sep}start_timestamp=${rangeStart}&end_timestamp=${now}`),
        API.get('/api/pricing'),
        API.get(`/api/log/self/stat?start_timestamp=${todayStart}&end_timestamp=${now}`),
      ]);

      if (selfRes.data?.success && selfRes.data.data) {
        userDispatch({ type: 'login', payload: selfRes.data.data });
        setUserData(selfRes.data.data);
      }

      if (dataRes.data.success) {
        const records = dataRes.data.data || [];
        setRawData(records);

        let modelCount = 0;
        if (pricingRes.data.success) {
          const models = pricingRes.data.data || [];
          modelCount = models.length;
        }

        let todayQuota = 0;
        let todayCount = 0;
        if (statRes.data.success && statRes.data.data) {
          todayQuota = Math.abs(statRes.data.data.quota || 0);
          const cachedCount = records
            .filter((r) => r.created_at >= todayStart)
            .reduce((sum, r) => sum + (r.count || 0), 0);
          todayCount = cachedCount;
        } else {
          records.forEach((r) => {
            if (r.created_at >= todayStart) {
              todayQuota += r.quota || 0;
              todayCount += r.count || 0;
            }
          });
        }

        const balance = selfRes.data?.data?.quota ?? userState?.user?.quota ?? 0;
        const sevenDayQuota = records
          .filter((r) => r.created_at >= sevenDayStart)
          .reduce((sum, r) => sum + (r.quota || 0), 0);
        const avgDaily = sevenDayQuota / 7;
        setRunwayDays(avgDaily > 0 ? Math.floor(balance / avgDaily) : null);

        setStats({
          quota: todayQuota,
          requests: todayCount,
          balance,
          models: modelCount,
        });
      }
    } catch (e) {
      console.error('Dashboard load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [chartRange]);

  // Initial load
  useEffect(() => { loadData(); }, [loadData]);

  // Auto refresh every 5 minutes
  useEffect(() => {
    const intervalId = setInterval(() => {
      loadData();
    }, 300000);
    return () => clearInterval(intervalId);
  }, [loadData]);

  // Refresh when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadData]);

  // Token count (for the smart guide card) — silent, one-shot
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await API.get('/api/token/?p=0&size=1');
        if (cancelled || !res?.data?.success) return;
        const d = res.data.data;
        const total = d?.total ?? (Array.isArray(d) ? d.length : null);
        if (total != null) setTokenCount(total);
      } catch {
        /* silent */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleCopySnippet = async () => {
    const ok = await copy(snippet);
    if (ok) {
      setCopied(true);
      showSuccess(t('已复制到剪贴板'));
      setTimeout(() => setCopied(false), 1600);
    }
  };

  const dismissGuide = (key) => {
    localStorage.setItem('daze_guide_dismissed', key);
    setGuideDismissed(key);
  };

  // Smart guide: surfaces only when the user actually needs it
  const guide = useMemo(() => {
    if (loading) return null;
    if (stats.balance <= 0 && guideDismissed !== 'balance') {
      return {
        key: 'balance',
        text: t('账户余额不足，充值后即可继续调用 API'),
        action: t('去充值'),
        onClick: () => goToRecharge(navigate, statusState?.status),
      };
    }
    if (tokenCount === 0 && guideDismissed !== 'token') {
      return {
        key: 'token',
        text: t('还没有 API 密钥，创建一个即可开始调用'),
        action: t('创建密钥'),
        onClick: () => navigate('/console/token'),
      };
    }
    return null;
  }, [loading, stats.balance, tokenCount, guideDismissed, navigate, statusState?.status, t]);

  const modelNames = useMemo(() => {
    const totals = {};
    rawData.forEach((r) => {
      if (!r.model_name) return;
      totals[r.model_name] = (totals[r.model_name] || 0) + (r.quota || 0);
    });
    return Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
  }, [rawData]);

  // Pills shown: top 5 or all
  const visibleModelNames = showAllModels ? modelNames : modelNames.slice(0, TOP_MODEL_COUNT);
  const hiddenCount = modelNames.length - TOP_MODEL_COUNT;

  const handleCollapseModels = () => {
    setShowAllModels(false);
    // If the currently selected model is no longer visible, reset to 'all'
    if (modelNames.indexOf(selectedModel) >= TOP_MODEL_COUNT) {
      setSelectedModel('all');
    }
  };

  const chartData = useMemo(() => {
    const todayStart = getTodayStartTimestamp();
    const rangeStart = todayStart - (chartRange - 1) * 86400;
    const hourCount = chartRange * 24;
    const filtered = selectedModel === 'all' ? rawData : rawData.filter((r) => r.model_name === selectedModel);
    const pad2 = (n) => String(n).padStart(2, '0');

    const hourMap = Array.from({ length: hourCount }, (_, i) => {
      const ts = rangeStart + i * 3600;
      const d = new Date(ts * 1000);
      const hm = `${pad2(d.getHours())}:00`;
      return {
        date: chartRange === 1 ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`,
        count: 0,
        quota: 0,
      };
    });

    filtered.forEach((r) => {
      if (r.created_at < rangeStart) return;
      const idx = Math.floor((r.created_at - rangeStart) / 3600);
      if (idx >= 0 && idx < hourMap.length) {
        hourMap[idx].count += r.count || 0;
        hourMap[idx].quota += r.quota || 0;
      }
    });
    return hourMap;
  }, [rawData, chartRange, selectedModel]);

  const today = new Date().toLocaleDateString(
    i18n.language === 'zh' || i18n.language === 'zh-CN' ? 'zh-CN' :
    i18n.language === 'zh-TW' ? 'zh-TW' :
    i18n.language === 'ja' ? 'ja-JP' :
    i18n.language === 'vi' ? 'vi-VN' :
    i18n.language === 'fr' ? 'fr-FR' :
    i18n.language === 'ru' ? 'ru-RU' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }
  );

  const statItems = [
    { key: 'quota', icon: Zap, label: t('今日消耗额度'), value: stats.quota, formatter: (v) => renderQuota(v, 2), isMoney: true },
    { key: 'requests', icon: Activity, label: t('今日请求次数'), value: stats.requests },
    { key: 'balance', icon: Wallet, label: t('账户余额'), value: stats.balance, formatter: (v) => renderQuota(v, 2), isMoney: true },
    { key: 'models', icon: Building2, label: t('支持模型'), value: stats.models, href: '/console/models' },
  ];

  const dataKey = metric;

  return (
    <div className='px-6 lg:px-10 py-8 page-fade'>
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className='mb-8'>
        <h1 className='text-[22px] font-semibold text-[#1A1A1A]'>{t(getGreeting())}, {username}</h1>
        <p className='text-[13px] text-[#999] mt-1'>{today}</p>
      </motion.div>

      {/* Stats */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6 mb-8'>
        {statItems.map((item, i) => {
          const Icon = item.icon;
          const isBalance = item.key === 'balance';
          const displayValue = item.isMoney
            ? (item.formatter ? item.formatter(item.value) : item.value)
            : (item.formatter
              ? <CountUp end={item.value} formatter={item.formatter} />
              : <CountUp end={item.value} />);
          return (
            <motion.div
              key={item.key}
              custom={i}
              variants={fadeUp}
              initial='hidden'
              animate='show'
              className={item.href ? 'cursor-pointer' : undefined}
              onClick={item.href ? () => navigate(item.href) : undefined}
            >
              <div className='flex items-center gap-2 mb-2'>
                <Icon size={15} strokeWidth={1.5} color='#9AA0B0' />
                <span className='daze-micro-label'>{item.label}</span>
              </div>
              <div className='flex items-end gap-2'>
                <p className={`mono text-[28px] font-semibold text-[#1A1A1A] leading-tight tracking-tight ${item.href ? 'hover:underline' : ''}`}>
                  {displayValue}
                </p>
                {isBalance && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      goToRecharge(navigate, statusState?.status);
                    }}
                    className='mb-1 text-[11px] text-[#2563eb] hover:text-[#1d4ed8] font-medium cursor-pointer border-none bg-transparent p-0'
                  >
                    {t('去充值')}
                  </button>
                )}
              </div>
              {isBalance && !loading && (
                <p className='text-[11px] text-[#999] mt-1'>
                  {runwayDays == null
                    ? t('近 7 日无消耗')
                    : t('按近 7 日均耗还可撑 {{days}} 天', { days: runwayDays })}
                </p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Smart guide banner */}
      {guide && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className='dash-guide'
        >
          <span className='dash-guide-text'>{guide.text}</span>
          <button className='dash-guide-action' onClick={guide.onClick}>
            {guide.action} →
          </button>
          <button
            className='dash-guide-close'
            onClick={() => dismissGuide(guide.key)}
            aria-label={t('关闭')}
          >
            <X size={13} />
          </button>
        </motion.div>
      )}

      {/* API quickstart */}
      <motion.div custom={4} variants={fadeUp} initial='hidden' animate='show' className='dash-quickstart'>
        <div className='dash-qs-head'>
          <div className='flex items-center gap-2 shrink-0'>
            <Terminal size={14} strokeWidth={1.8} color='#9AA0B0' />
            <h2 className='daze-micro-label'>{t('API 快速接入')}</h2>
          </div>
          <div className='dash-qs-tabs'>
            {QS_SCENARIOS.map((s) => (
              <button
                key={s.key}
                className={qsScenario === s.key ? 'active' : ''}
                onClick={() => setQsScenario(s.key)}
              >
                {s.key === 'image' ? t('生图') : s.label}
              </button>
            ))}
          </div>
        </div>
        <div className='dash-code-wrap'>
          <pre className='dash-code'>
            {qsTokens.map((tok, i) => (
              <span key={i} className={tok.c}>{tok.t}</span>
            ))}
          </pre>
          <button className='dash-copy-btn' onClick={handleCopySnippet}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? t('已复制') : t('复制')}
          </button>
        </div>
      </motion.div>

      {/* Chart */}
      <motion.div custom={6} variants={fadeUp} initial='hidden' animate='show' className='daze-card'>
        {/* Controls Row */}
        <div className='flex items-center justify-between mb-4 flex-wrap gap-3'>
          <h2 className='daze-micro-label'>{t('调用趋势')}</h2>
          <div className='flex items-center gap-3'>
            {/* Metric toggle: 次数 / 花费 */}
            <div className='flex rounded-lg overflow-hidden border border-[#ebebeb]'>
              {[
                { key: 'count', label: t('次数') },
                { key: 'quota', label: t('花费') },
              ].map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMetric(m.key)}
                  style={{
                    padding: '4px 14px',
                    fontSize: '12px',
                    fontWeight: metric === m.key ? 600 : 400,
                    background: metric === m.key ? '#1A1A1A' : '#fff',
                    color: metric === m.key ? '#fff' : '#999',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {/* Day range */}
            <div className='flex gap-1'>
              {[1, 3, 7].map((d) => (
                <button
                  key={d}
                  onClick={() => setChartRange(d)}
                  className='cursor-pointer transition-colors border-0 outline-none'
                  style={{
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: chartRange === d ? 600 : 400,
                    background: chartRange === d ? '#f5f5f5' : 'transparent',
                    color: chartRange === d ? '#1A1A1A' : '#ccc',
                  }}
                >
                  {d}{t('日')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Model pills */}
        {modelNames.length > 0 && (
          <div className='flex gap-1.5 flex-wrap mb-4 pb-4 border-b border-[#f5f5f5] items-center'>
            <button
              onClick={() => setSelectedModel('all')}
              className='transition-all duration-150 cursor-pointer border-0 outline-none'
              style={{
                padding: '3px 10px',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: selectedModel === 'all' ? 600 : 400,
                background: selectedModel === 'all' ? '#1A1A1A' : '#f5f5f5',
                color: selectedModel === 'all' ? '#fff' : '#888',
              }}
            >
              {t('全部模型')}
            </button>
            {visibleModelNames.map((name, i) => (
              <button
                key={name}
                onClick={() => setSelectedModel(name)}
                className='transition-all duration-150 cursor-pointer border-0 outline-none'
                style={{
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: selectedModel === name ? 600 : 400,
                  background: selectedModel === name ? (CHART_COLORS[i % CHART_COLORS.length]) : '#f5f5f5',
                  color: selectedModel === name ? '#fff' : '#888',
                }}
              >
                {name}
              </button>
            ))}
            {!showAllModels && hiddenCount > 0 && (
              <button
                onClick={() => setShowAllModels(true)}
                className='transition-all duration-150 cursor-pointer border-0 outline-none'
                style={{
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: 400,
                  background: 'transparent',
                  color: '#aaa',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                }}
              >
                +{hiddenCount} {t('更多')}
              </button>
            )}
            {showAllModels && hiddenCount > 0 && (
              <button
                onClick={handleCollapseModels}
                className='transition-all duration-150 cursor-pointer border-0 outline-none'
                style={{
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: 400,
                  background: 'transparent',
                  color: '#aaa',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                }}
              >
                {t('收起')}
              </button>
            )}
          </div>
        )}

        {/* Chart area — extra bottom padding so XAxis labels aren't clipped */}
        <div className='h-[300px]'>
          {!loading && (
            <ResponsiveContainer width='100%' height='100%'>
              <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 60, bottom: chartRange === 1 ? 20 : 36 }}>
                <defs>
                  <linearGradient id='fillGrad' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor='#6366f1' stopOpacity={0.16} />
                    <stop offset='100%' stopColor='#6366f1' stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey='date'
                  tick={{ fontSize: 10, fill: '#C8C8C8' }}
                  axisLine={false}
                  tickLine={false}
                  interval={chartRange === 1 ? 0 : chartRange === 3 ? 3 : 5}
                  angle={chartRange === 1 ? 0 : -35}
                  textAnchor={chartRange === 1 ? 'middle' : 'end'}
                  dy={chartRange === 1 ? 6 : 4}
                  minTickGap={4}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#C8C8C8' }}
                  axisLine={false}
                  tickLine={false}
                  tickCount={8}
                  tickFormatter={metric === 'quota' ? (v) => renderQuota(v, 2) : undefined}
                  allowDecimals={true}
                  minTickGap={8}
                />
                <Tooltip content={<ChartTooltip metric={metric} t={t} />} />
                <Area
                  type='monotone'
                  dataKey={dataKey}
                  stroke={selectedModel === 'all' ? '#6366f1' : CHART_COLORS[modelNames.indexOf(selectedModel) % CHART_COLORS.length]}
                  strokeWidth={1.8}
                  fill='url(#fillGrad)'
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
          {loading && (
            <div className='flex items-center justify-center h-full text-[#C8C8C8] text-sm'>
              {t('加载中')}...
            </div>
          )}
          {!loading && !chartData.some((d) => d[dataKey] > 0) && (
            <div className='flex items-center justify-center h-full text-[#C8C8C8] text-sm'>
              {t('暂无数据')}
            </div>
          )}
        </div>
      </motion.div>

      {/* Channel Success Rate - Admin only */}
      <ChannelSuccessRatePanel />
    </div>
  );
};

export default Dashboard;
