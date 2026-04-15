import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { API, isAdmin } from '../../helpers';

const TIME_RANGES = [
  { key: '1m', label: '1分钟', seconds: 60 },
  { key: '1h', label: '1小时', seconds: 3600 },
  { key: '1d', label: '1天', seconds: 86400 },
];

const ChannelSuccessRatePanel = () => {
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedChannels, setExpandedChannels] = useState({});
  const [timeRange, setTimeRange] = useState('1d');

  const fetchData = async (range) => {
    if (!isAdmin()) return;
    setLoading(true);
    try {
      const now = Math.floor(Date.now() / 1000);
      const rangeConfig = TIME_RANGES.find((r) => r.key === range);
      const startTimestamp = now - rangeConfig.seconds;
      const res = await API.get(`/api/log/channel_success_rate?start_timestamp=${startTimestamp}&end_timestamp=${now}`);
      if (res.data.success) {
        setData(res.data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch channel success rate:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(timeRange);
  }, [timeRange]);

  const groupedByChannel = useMemo(() => {
    const channelMap = {};
    for (const item of data) {
      const channelKey = `${item.channel_id}`;
      if (!channelMap[channelKey]) {
        channelMap[channelKey] = {
          channelId: item.channel_id,
          channelName: item.channel_name || `#${item.channel_id}`,
          models: [],
        };
      }
      channelMap[channelKey].models.push(item);
    }
    for (const key of Object.keys(channelMap)) {
      channelMap[key].models.sort((a, b) => b.total_count - a.total_count);
    }
    return Object.values(channelMap).sort((a, b) => {
      const totalA = a.models.reduce((s, x) => s + x.total_count, 0);
      const totalB = b.models.reduce((s, x) => s + x.total_count, 0);
      return totalB - totalA;
    });
  }, [data]);

  const getRateColor = (rate) => {
    if (rate >= 80) return '#16a34a';
    if (rate >= 60) return '#d97706';
    return '#dc2626';
  };

  const getRateBg = (rate) => {
    if (rate >= 80) return '#f0fdf4';
    if (rate >= 60) return '#fffbeb';
    return '#fef2f2';
  };

  const fmt = (n) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  };

  const toggleChannel = (id) => {
    setExpandedChannels((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!isAdmin()) return null;

  return (
    <div className='mt-6'>
      <div className='flex items-center justify-between mb-4'>
        <h2 className='text-[15px] font-medium text-[#1A1A1A]'>{t('模型渠道成功率')}</h2>
        <div className='flex items-center gap-1 bg-[#F5F5F5] rounded-lg p-0.5'>
          {TIME_RANGES.map((r) => (
            <button
              key={r.key}
              className={`px-3 py-1 text-[12px] rounded-md transition-all ${
                timeRange === r.key
                  ? 'bg-white text-[#1A1A1A] font-medium shadow-sm'
                  : 'text-[#999] hover:text-[#666]'
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
        <div className='bg-white rounded-xl border border-[#F0F0F0] p-6 text-center text-[#C8C8C8] text-sm'>{t('加载中')}...</div>
      ) : data.length === 0 ? (
        <div className='bg-white rounded-xl border border-[#F0F0F0] p-6 text-center text-[#C8C8C8] text-sm'>{t('暂无数据')}</div>
      ) : (
      <div className='space-y-2'>
        {groupedByChannel.map((ch) => {
          const isExpanded = expandedChannels[ch.channelId];
          const totalReqs = ch.models.reduce((s, x) => s + x.total_count, 0);
          const totalSuccess = ch.models.reduce((s, x) => s + x.success_count, 0);
          const overallRate = totalReqs > 0 ? (totalSuccess / totalReqs * 100) : 0;
          const topModels = isExpanded ? ch.models : ch.models.slice(0, 3);
          const hasMore = ch.models.length > 3;

          return (
            <div key={ch.channelId} className='bg-white rounded-xl border border-[#F0F0F0] overflow-hidden'>
              <div
                className='flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#FAFAFA] transition-colors'
                onClick={() => toggleChannel(ch.channelId)}
              >
                <div className='flex items-center gap-2 min-w-0 flex-1'>
                  <svg
                    className={`w-3.5 h-3.5 text-[#999] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                    viewBox='0 0 24 24' fill='currentColor'
                  >
                    <path d='m20.56 9.66-7.8 8.97a1 1 0 0 1-1.51 0L3.44 9.66A1 1 0 0 1 4.19 8h15.62a1 1 0 0 1 .75 1.66Z' />
                  </svg>
                  <span className='text-[13px] font-medium truncate text-[#1A1A1A]'>
                    <span className='text-[#999]'>#{ch.channelId}</span> {ch.channelName}
                  </span>
                </div>
                <div className='flex items-center gap-3 flex-shrink-0 ml-4'>
                  <div className='flex items-center gap-1.5'>
                    <div
                      className='w-2 h-2 rounded-full flex-shrink-0'
                      style={{ backgroundColor: getRateColor(overallRate) }}
                    />
                    <span className='text-[13px] font-semibold min-w-[40px] text-right' style={{ color: getRateColor(overallRate) }}>
                      {overallRate.toFixed(1)}%
                    </span>
                  </div>
                  <span className='text-[11px] text-[#999] min-w-[50px] text-right'>
                    {fmt(totalSuccess)}/{fmt(totalReqs)}
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className='border-t border-[#F0F0F0]'>
                  {topModels.map((m) => {
                    const rate = m.total_count > 0 ? (m.success_count / m.total_count * 100) : 0;
                    return (
                      <div
                        key={`${m.model_name}-${m.channel_id}`}
                        className='flex items-center justify-between px-4 py-2.5 hover:bg-[#FAFAFA]'
                      >
                        <div className='flex items-center gap-2 min-w-0 flex-1'>
                          <span className='text-[12px] text-[#555] truncate'>{m.model_name}</span>
                        </div>
                        <div className='flex items-center gap-3 flex-shrink-0 ml-4'>
                          <div className='w-24 h-2 bg-[#F0F0F0] rounded-full overflow-hidden'>
                            <div
                              className='h-full rounded-full transition-all duration-500'
                              style={{
                                width: `${Math.max(rate, 1)}%`,
                                backgroundColor: getRateColor(rate),
                              }}
                            />
                          </div>
                          <div
                            className='text-[12px] font-semibold min-w-[42px] text-right px-1.5 py-0.5 rounded'
                            style={{ color: getRateColor(rate), backgroundColor: getRateBg(rate) }}
                          >
                            {rate.toFixed(1)}%
                          </div>
                          <span className='text-[11px] text-[#999] min-w-[50px] text-right'>
                            {fmt(m.success_count)}/{fmt(m.total_count)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {hasMore && !isExpanded && (
                    <div
                      className='text-[11px] text-[#2563eb] text-center py-1.5 cursor-pointer hover:underline'
                      onClick={(e) => { e.stopPropagation(); toggleChannel(ch.channelId); }}
                    >
                      {t('更多')} {ch.models.length - 3} {t('个模型')}
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

export default ChannelSuccessRatePanel;