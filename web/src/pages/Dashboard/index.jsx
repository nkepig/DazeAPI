import React, { useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Zap, Activity, Wallet, Building2 } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { API, isAdmin, renderQuota, goToRecharge } from '../../helpers';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import ChannelSuccessRatePanel from '../../components/dashboard/ChannelSuccessRatePanel';

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

function ChartTooltip({ active, payload, label, metric: metricType }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  const display = metricType === 'quota' ? renderQuota(val, 2) : `${val?.toLocaleString()} 次`;
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

const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [userState] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const [stats, setStats] = useState({ quota: 0, requests: 0, balance: 0, models: 0 });
  const [rawData, setRawData] = useState([]);
  const [chartRange, setChartRange] = useState(1);
  const [metric, setMetric] = useState('quota');
  const [selectedModel, setSelectedModel] = useState('all');
  const [showAllModels, setShowAllModels] = useState(false);
  const [loading, setLoading] = useState(true);

  const username = userState?.user?.display_name || userState?.user?.username || '';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const now = Math.floor(Date.now() / 1000);
      const todayStart = now - (now % 86400);
      const rangeStart = chartRange === 1 ? todayStart : todayStart - chartRange * 86400;

      const endpoint = isAdmin() ? '/api/data/' : '/api/data/self';
      const sep = endpoint.includes('?') ? '&' : '?';

      const [dataRes, pricingRes, statRes] = await Promise.all([
        API.get(`${endpoint}${sep}start_timestamp=${rangeStart}&end_timestamp=${now}`),
        API.get('/api/pricing'),
        API.get(`/api/log/self/stat?start_timestamp=${todayStart}&end_timestamp=${now}`),
      ]);

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

        setStats({
          quota: todayQuota,
          requests: todayCount,
          balance: userState?.user?.quota || 0,
          models: modelCount,
        });
      }
    } catch (e) {
      console.error('Dashboard load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [chartRange, userState?.user?.quota]);

  useEffect(() => { loadData(); }, [loadData]);

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
    const now = Math.floor(Date.now() / 1000);
    const todayStart = now - (now % 86400);
    const filtered = selectedModel === 'all' ? rawData : rawData.filter((r) => r.model_name === selectedModel);

    if (chartRange === 1) {
      // Hourly buckets for today (0–23)
      const hourMap = Array.from({ length: 24 }, (_, h) => ({
        date: `${h}:00`,
        count: 0,
        quota: 0,
      }));
      filtered.forEach((r) => {
        if (r.created_at >= todayStart) {
          const h = new Date(r.created_at * 1000).getHours();
          hourMap[h].count += r.count || 0;
          hourMap[h].quota += r.quota || 0;
        }
      });
      return hourMap;
    }

    // Daily buckets
    const rangeStart = todayStart - (chartRange - 1) * 86400;
    const dayMap = {};
    for (let d = 0; d < chartRange; d++) {
      const ts = rangeStart + d * 86400;
      const date = new Date(ts * 1000);
      const label = `${date.getMonth() + 1}/${date.getDate()}`;
      dayMap[label] = { date: label, count: 0, quota: 0 };
    }
    filtered.forEach((r) => {
      const date = new Date(r.created_at * 1000);
      const label = `${date.getMonth() + 1}/${date.getDate()}`;
      if (dayMap[label]) {
        dayMap[label].count += r.count || 0;
        dayMap[label].quota += r.quota || 0;
      }
    });
    return Object.values(dayMap);
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
    { icon: Zap, label: t('今日消耗额度'), value: stats.quota, formatter: (v) => renderQuota(v, 2) },
    { icon: Activity, label: t('今日请求次数'), value: stats.requests },
    { icon: Wallet, label: t('账户余额'), value: stats.balance, formatter: (v) => renderQuota(v, 2) },
    { icon: Building2, label: t('支持模型'), value: stats.models },
  ];

  const dataKey = metric;

  return (
    <div className='px-6 lg:px-10 py-8'>
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className='mb-8'>
        <h1 className='text-[22px] font-semibold text-[#1A1A1A]'>{t(getGreeting())}，{username}</h1>
        <p className='text-[13px] text-[#999] mt-1'>{today}</p>
      </motion.div>

      {/* Stats */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6 mb-10 pb-8 border-b border-[#F0F0F0]'>
        {statItems.map((item, i) => {
          const Icon = item.icon;
          const isBalance = item.label === t('账户余额');
          return (
            <motion.div key={i} custom={i} variants={fadeUp} initial='hidden' animate='show'>
              <div className='flex items-center gap-2 mb-2'>
                <Icon size={16} strokeWidth={1.5} color='#999' />
                <span className='text-[12px] text-[#999] font-medium'>{item.label}</span>
              </div>
              <div className='flex items-end gap-2'>
                <p className='text-[26px] font-semibold text-[#1A1A1A] leading-tight'>
                  {item.formatter
                    ? <CountUp end={item.value} formatter={item.formatter} />
                    : <CountUp end={item.value} />
                  }
                </p>
                {isBalance && (
                  <button
                    onClick={() =>
                      goToRecharge(navigate, statusState?.status)
                    }
                    className='mb-1 text-[11px] text-[#2563eb] hover:text-[#1d4ed8] font-medium cursor-pointer border-none bg-transparent p-0'
                  >
                    {t('去充值')}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Chart */}
      <motion.div custom={4} variants={fadeUp} initial='hidden' animate='show'>
        {/* Controls Row */}
        <div className='flex items-center justify-between mb-4 flex-wrap gap-3'>
          <h2 className='text-[15px] font-medium text-[#1A1A1A]'>{t('调用趋势')}</h2>
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
              <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 60, bottom: 24 }}>
                <defs>
                  <linearGradient id='fillGrad' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor='#E0E0E0' stopOpacity={0.3} />
                    <stop offset='100%' stopColor='#E0E0E0' stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey='date'
                  tick={{ fontSize: 11, fill: '#C8C8C8' }}
                  axisLine={false}
                  tickLine={false}
                  interval={chartRange === 1 ? 2 : 0}
                  angle={chartRange === 3 ? -30 : 0}
                  textAnchor={chartRange === 3 ? 'end' : 'middle'}
                  dy={chartRange === 3 ? 4 : 6}
                  tickCount={chartRange === 1 ? 12 : undefined}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#C8C8C8' }}
                  axisLine={false}
                  tickLine={false}
                  tickCount={8}
                  tickFormatter={metric === 'quota' ? (v) => renderQuota(v, 2) : undefined}
                  allowDecimals={true}
                  minTickGap={10}
                />
                <Tooltip content={<ChartTooltip metric={metric} />} />
                <Area
                  type='monotone'
                  dataKey={dataKey}
                  stroke={selectedModel === 'all' ? '#1A1A1A' : CHART_COLORS[modelNames.indexOf(selectedModel) % CHART_COLORS.length]}
                  strokeWidth={1.5}
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
