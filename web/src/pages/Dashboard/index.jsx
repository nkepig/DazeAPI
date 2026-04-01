import React, { useContext, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Zap, Activity, Wallet, Layers, Clock, CheckCircle2, XCircle,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { API, isAdmin } from '../../helpers';
import { UserContext } from '../../context/User';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: 'easeOut' },
  }),
};

function CountUp({ end, duration = 1200, prefix = '', suffix = '' }) {
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
  return <>{prefix}{val.toLocaleString()}{suffix}</>;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return '早上好';
  if (h < 18) return '下午好';
  return '晚上好';
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className='bg-white border border-[#EBEBEB] rounded-lg shadow-sm px-3 py-2'>
      <p className='text-[11px] text-[#999] mb-0.5'>{label}</p>
      <p className='text-sm font-semibold text-[#1A1A1A]'>{payload[0].value?.toLocaleString()} 次</p>
    </div>
  );
}

const Dashboard = () => {
  const { t } = useTranslation();
  const [userState] = useContext(UserContext);
  const [stats, setStats] = useState({ tokens: 0, requests: 0, balance: 0, models: 0 });
  const [chartData, setChartData] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [chartRange, setChartRange] = useState(7);
  const [loading, setLoading] = useState(true);

  const username = userState?.user?.display_name || userState?.user?.username || '';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = isAdmin() ? '/api/data/' : '/api/data/self/';
      const [dataRes, logRes] = await Promise.all([
        API.get(endpoint),
        API.get(isAdmin() ? '/api/log/?p=0&page_size=8' : '/api/log/self/?p=0&page_size=8'),
      ]);
      if (dataRes.data.success) {
        const d = dataRes.data.data;
        setStats({
          tokens: d?.token_used_today || d?.totalTokens || 0,
          requests: d?.request_count_today || d?.totalCount || 0,
          balance: userState?.user?.quota || 0,
          models: d?.model_count || 0,
        });
        if (d?.chart_data || d?.chartData) {
          setChartData((d.chart_data || d.chartData || []).slice(-chartRange));
        }
      }
      if (logRes.data.success) {
        setRecentLogs((logRes.data.data || []).slice(0, 8));
      }
    } catch (e) {
      console.error('Dashboard load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [chartRange, userState?.user?.quota]);

  useEffect(() => { loadData(); }, [loadData]);

  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  const statItems = [
    { icon: Zap, label: t('今日 Token 消耗'), value: stats.tokens },
    { icon: Activity, label: t('今日请求次数'), value: stats.requests },
    { icon: Wallet, label: t('账户余额'), value: stats.balance, prefix: '$' },
    { icon: Layers, label: t('可用模型数量'), value: stats.models },
  ];

  return (
    <div className='px-6 lg:px-10 py-8'>
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className='mb-8'>
        <h1 className='text-[22px] font-semibold text-[#1A1A1A]'>{t(getGreeting())}，{username}</h1>
        <p className='text-[13px] text-[#999] mt-1'>{today}</p>
      </motion.div>

      {/* Stats — flat, no card container */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6 mb-10 pb-8 border-b border-[#F0F0F0]'>
        {statItems.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div key={i} custom={i} variants={fadeUp} initial='hidden' animate='show'>
              <div className='flex items-center gap-2 mb-2'>
                <Icon size={16} strokeWidth={1.5} color='#999' />
                <span className='text-[12px] text-[#999] font-medium'>{item.label}</span>
              </div>
              <p className='text-[26px] font-semibold text-[#1A1A1A] leading-tight'>
                <CountUp end={item.value} prefix={item.prefix || ''} />
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Chart — flat, no card */}
      <motion.div custom={4} variants={fadeUp} initial='hidden' animate='show' className='mb-10 pb-8 border-b border-[#F0F0F0]'>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='text-[15px] font-medium text-[#1A1A1A]'>{t('调用趋势')}</h2>
          <div className='flex gap-1'>
            {[7, 30].map((d) => (
              <button
                key={d}
                onClick={() => setChartRange(d)}
                className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer transition-colors border ${
                  chartRange === d ? 'text-[#1A1A1A] border-[#1A1A1A] bg-white' : 'text-[#C8C8C8] border-[#EBEBEB] bg-white hover:bg-[#F5F5F5]'
                }`}
              >
                {d}{t('日')}
              </button>
            ))}
          </div>
        </div>
        <div className='h-[240px]'>
          {chartData.length > 0 ? (
            <ResponsiveContainer width='100%' height='100%'>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id='fillGrad' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor='#E0E0E0' stopOpacity={0.3} />
                    <stop offset='100%' stopColor='#E0E0E0' stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray='3 3' stroke='#F0F0F0' />
                <XAxis dataKey='date' tick={{ fontSize: 11, fill: '#C8C8C8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#C8C8C8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type='monotone' dataKey='count' stroke='#1A1A1A' strokeWidth={1.5} fill='url(#fillGrad)' />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className='flex items-center justify-center h-full text-[#C8C8C8] text-sm'>
              {loading ? <div className='skeleton w-full h-full' /> : t('暂无数据')}
            </div>
          )}
        </div>
      </motion.div>

      {/* Recent Logs — flat table */}
      <motion.div custom={5} variants={fadeUp} initial='hidden' animate='show'>
        <h2 className='text-[15px] font-medium text-[#1A1A1A] mb-4'>{t('最近调用')}</h2>
        {loading ? (
          <div className='space-y-3'>{[...Array(4)].map((_, i) => <div key={i} className='skeleton h-10 w-full' />)}</div>
        ) : recentLogs.length > 0 ? (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b border-[#F0F0F0]'>
                  <th className='text-left py-2.5 text-[11px] font-medium text-[#C8C8C8] uppercase tracking-wider'>{t('模型')}</th>
                  <th className='text-left py-2.5 text-[11px] font-medium text-[#C8C8C8] uppercase tracking-wider'>{t('时间')}</th>
                  <th className='text-right py-2.5 text-[11px] font-medium text-[#C8C8C8] uppercase tracking-wider'>Tokens</th>
                  <th className='text-right py-2.5 text-[11px] font-medium text-[#C8C8C8] uppercase tracking-wider'>{t('状态')}</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log, i) => (
                  <tr key={log.id || i} className='border-b border-[#F0F0F0] last:border-0 hover:bg-[#FAFAFA] transition-colors'>
                    <td className='py-3 font-medium text-[#1A1A1A]'>{log.model_name || log.model || '-'}</td>
                    <td className='py-3 text-[#999]'>
                      <span className='flex items-center gap-1'>
                        <Clock size={12} strokeWidth={1.5} />
                        {log.created_at ? new Date(log.created_at * 1000).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </span>
                    </td>
                    <td className='py-3 text-right text-[#1A1A1A] tabular-nums'>
                      {(log.prompt_tokens || 0) + (log.completion_tokens || 0)}
                    </td>
                    <td className='py-3 text-right'>
                      {log.code === 200 || log.type === 2 ? (
                        <span className='inline-flex items-center gap-1 text-[11px] font-medium text-[#1A1A1A]'>
                          <CheckCircle2 size={12} strokeWidth={1.5} /> {t('成功')}
                        </span>
                      ) : (
                        <span className='inline-flex items-center gap-1 text-[11px] font-medium text-[#C8C8C8]'>
                          <XCircle size={12} strokeWidth={1.5} /> {t('失败')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className='flex flex-col items-center justify-center py-16 text-[#C8C8C8]'>
            <Activity size={36} strokeWidth={1} className='mb-3' />
            <p className='text-sm text-[#999]'>{t('暂无调用记录')}</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Dashboard;
