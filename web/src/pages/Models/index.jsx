import React, { useEffect, useState, useMemo, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Search, Layers } from 'lucide-react';
import { API, showError, getLobeHubIcon } from '../../helpers';
import { StatusContext } from '../../context/Status';

const CARD_COLORS = [
  { accent: 'text-blue-600', tag: 'bg-blue-100 text-blue-700' },
  { accent: 'text-violet-600', tag: 'bg-violet-100 text-violet-700' },
  { accent: 'text-emerald-600', tag: 'bg-emerald-100 text-emerald-700' },
  { accent: 'text-amber-600', tag: 'bg-amber-100 text-amber-700' },
  { accent: 'text-rose-600', tag: 'bg-rose-100 text-rose-700' },
  { accent: 'text-cyan-600', tag: 'bg-cyan-100 text-cyan-700' },
  { accent: 'text-orange-600', tag: 'bg-orange-100 text-orange-700' },
  { accent: 'text-teal-600', tag: 'bg-teal-100 text-teal-700' },
];

const getCardColor = (vendorName) => {
  if (!vendorName) return CARD_COLORS[0];
  let hash = 0;
  for (let i = 0; i < vendorName.length; i++) {
    hash = vendorName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CARD_COLORS[Math.abs(hash) % CARD_COLORS.length];
};

const Models = () => {
  const { t } = useTranslation();
  const [models, setModels] = useState([]);
  const [vendorsMap, setVendorsMap] = useState({});
  const [groupRatio, setGroupRatio] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterVendor, setFilterVendor] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 24;

  const [statusState] = useContext(StatusContext);

  const priceRate = useMemo(() => statusState?.status?.price ?? 1, [statusState]);
  const usdExchangeRate = useMemo(() => statusState?.status?.usd_exchange_rate ?? priceRate, [statusState, priceRate]);
  const siteDisplayType = useMemo(() => statusState?.status?.quota_display_type || 'USD', [statusState]);
  const customExchangeRate = useMemo(() => statusState?.status?.custom_currency_exchange_rate ?? 1, [statusState]);
  const customCurrencySymbol = useMemo(() => statusState?.status?.custom_currency_symbol ?? '¤', [statusState]);

  const displayPrice = (usdPrice) => {
    if (siteDisplayType === 'CNY') return `¥${(usdPrice * usdExchangeRate).toFixed(4)}`;
    if (siteDisplayType === 'CUSTOM') return `${customCurrencySymbol}${(usdPrice * customExchangeRate).toFixed(4)}`;
    return `$${usdPrice.toFixed(4)}`;
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await API.get('/api/pricing');
        const { success, message, data, vendors, group_ratio } = res.data;
        if (success) {
          setGroupRatio(group_ratio || {});
          const vMap = {};
          if (Array.isArray(vendors)) {
            vendors.forEach((v) => { vMap[v.id] = v; });
          }
          setVendorsMap(vMap);
          const formatted = (data || []).map((m) => ({
            ...m,
            key: m.model_name,
            vendor_name: m.vendor_id && vMap[m.vendor_id] ? vMap[m.vendor_id].name : null,
          }));
          formatted.sort((a, b) => a.model_name.localeCompare(b.model_name));
          setModels(formatted);
        } else {
          showError(message);
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, []);

  const vendorOptions = useMemo(() => {
    const byName = new Map();
    models.forEach((m) => {
      if (!m.vendor_name) return;
      if (!byName.has(m.vendor_name)) {
        const v = m.vendor_id ? vendorsMap[m.vendor_id] : null;
        byName.set(m.vendor_name, {
          value: m.vendor_name,
          label: m.vendor_name,
          icon: v?.icon || 'Layers',
        });
      }
    });
    return [...byName.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [models, vendorsMap]);

  const filteredModels = useMemo(() => {
    let result = models;
    if (filterVendor !== 'all') {
      if (filterVendor === 'unknown') {
        result = result.filter((m) => !m.vendor_name);
      } else {
        result = result.filter((m) => m.vendor_name === filterVendor);
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((m) =>
        m.model_name.toLowerCase().includes(q) ||
        (m.vendor_name && m.vendor_name.toLowerCase().includes(q))
      );
    }
    return result;
  }, [models, filterVendor, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterVendor, search]);

  const totalPages = Math.ceil(filteredModels.length / pageSize);
  const paginatedModels = filteredModels.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getUsedGroupRatio = (model) => {
    let minRatio = Infinity;
    if (Array.isArray(model.enable_groups)) {
      model.enable_groups.forEach((g) => {
        if (groupRatio[g] !== undefined && groupRatio[g] < minRatio) {
          minRatio = groupRatio[g];
        }
      });
    }
    return minRatio === Infinity ? 1 : minRatio;
  };

  const getPriceInfo = (model) => {
    const gr = model.user_multiplier != null ? model.user_multiplier : getUsedGroupRatio(model);
    if (model.quota_type === 1) {
      const priceUSD = parseFloat(model.model_price) * gr;
      return { type: 'fixed', price: displayPrice(priceUSD), groupRatio: gr, hasUserMultiplier: model.user_multiplier != null };
    }
    const inputPriceUSD = model.model_ratio * 2 * gr;
    const outputPriceUSD = inputPriceUSD * model.completion_ratio;
    const cachePriceUSD = model.cache_ratio != null ? inputPriceUSD * model.cache_ratio : null;
    return {
      type: 'token',
      inputPrice: displayPrice(inputPriceUSD),
      outputPrice: displayPrice(outputPriceUSD),
      cachePrice: cachePriceUSD != null ? displayPrice(cachePriceUSD) : null,
      groupRatio: gr,
      hasUserMultiplier: model.user_multiplier != null,
    };
  };

  return (
    <div className='px-6 lg:px-10 py-8'>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className='mb-8'>
        <h1 className='text-[22px] font-semibold text-[#1A1A1A]'>{t('模型列表')}</h1>
        <p className='text-[13px] text-[#999] mt-1'>{t('浏览所有可以通过 API 调用的模型')}</p>
      </motion.div>

      {/* Search bar */}
      <div className='mb-4 relative max-w-[400px]'>
        <Search size={15} strokeWidth={1.5} className='absolute left-3 top-1/2 -translate-y-1/2 text-[#C8C8C8]' />
        <input
          type='text' value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t('搜索模型名称...')}
          className='w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-[#EBEBEB] rounded-lg focus:outline-none focus:border-[#999] transition-colors'
        />
      </div>

      {/* Vendor pills */}
      {vendorOptions.length > 0 && (
        <div className='mb-5'>
          <p className='text-[11px] text-[#bbb] font-medium uppercase tracking-wider mb-2'>{t('供应商')}</p>
          <div className='flex gap-1.5 flex-wrap'>
            {[
              { value: 'all', label: t('全部'), icon: 'Layers' },
              ...vendorOptions,
              { value: 'unknown', label: t('未知'), icon: 'Layers' },
            ].map((opt) => (
              <button
                key={opt.value}
                type='button'
                onClick={() => setFilterVendor(opt.value)}
                className='transition-all duration-150 cursor-pointer border-0 outline-none inline-flex items-center gap-1.5'
                style={{
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: filterVendor === opt.value ? 600 : 400,
                  background: filterVendor === opt.value ? '#1A1A1A' : '#f5f5f5',
                  color: filterVendor === opt.value ? '#fff' : '#666',
                }}
              >
                <span className='flex shrink-0 items-center justify-center [&_img]:rounded-sm opacity-90'>
                  {getLobeHubIcon(opt.icon || 'Layers', 14)}
                </span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className='mb-4 text-[12px] text-[#999]'>
        {!loading && `${t('共')} ${filteredModels.length} ${t('个模型')}`}
      </div>

      {loading ? (
        <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
          {[...Array(6)].map((_, i) => (
            <div key={i} className='rounded-xl p-5 animate-pulse bg-white border border-[#EBEBEB]'>
              <div className='h-5 bg-gray-200 rounded w-2/3 mb-4' />
              <div className='space-y-2'>
                <div className='h-3 bg-gray-100 rounded w-full' />
                <div className='h-3 bg-gray-100 rounded w-3/4' />
              </div>
            </div>
          ))}
        </div>
      ) : filteredModels.length === 0 ? (
        <div className='flex flex-col items-center justify-center py-20 text-[#C8C8C8]'>
          <Layers size={40} strokeWidth={1} className='mb-3' />
          <p className='text-sm text-[#999]'>{t('未找到模型')}</p>
        </div>
      ) : (
        <>
          <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
            <AnimatePresence mode='popLayout'>
              {paginatedModels.map((model) => {
                const priceInfo = getPriceInfo(model);
                const color = getCardColor(model.vendor_name);
                return (
                  <motion.div
                    key={model.model_name}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                    className='bg-white border border-[#EBEBEB] rounded-xl p-5 hover:shadow-md transition-all'
                  >
                    <div className='flex items-start justify-between mb-3'>
                      <div className='flex-1 min-w-0'>
                        <h3 className='text-[14px] font-semibold text-[#1A1A1A] font-mono truncate'>{model.model_name}</h3>
                        <div className='flex items-center gap-2 mt-1.5'>
                          {model.vendor_name && (
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 max-w-full ${color.tag}`}
                            >
                              <span className='flex shrink-0 items-center [&_img]:rounded-sm'>
                                {getLobeHubIcon(
                                  vendorsMap[model.vendor_id]?.icon || 'Layers',
                                  14,
                                )}
                              </span>
                              <span className='truncate'>{model.vendor_name}</span>
                            </span>
                          )}
                          <span className='text-[11px] text-[#999]'>
                            {model.quota_type === 0 ? t('按量计费') : t('按次计费')}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`ml-3 shrink-0 text-[11px] px-2 py-0.5 rounded-full font-mono font-semibold ${
                          priceInfo.groupRatio === 1
                            ? 'bg-gray-100 text-gray-500'
                            : priceInfo.groupRatio < 1
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        ×{priceInfo.groupRatio}
                      </span>
                    </div>

                    {priceInfo.type === 'token' ? (
                      <div className='space-y-1.5'>
                        <div className='grid grid-cols-2 gap-x-4 gap-y-1'>
                          <div>
                            <span className='text-[11px] text-[#888]'>{t('输入价格')}</span>
                            <p className={`text-[13px] font-semibold font-mono ${color.accent}`}>{priceInfo.inputPrice}<span className='text-[10px] text-[#999] ml-0.5 font-normal'>/ 1M</span></p>
                          </div>
                          <div>
                            <span className='text-[11px] text-[#888]'>{t('输出价格')}</span>
                            <p className={`text-[13px] font-semibold font-mono ${color.accent}`}>{priceInfo.outputPrice}<span className='text-[10px] text-[#999] ml-0.5 font-normal'>/ 1M</span></p>
                          </div>
                          {priceInfo.cachePrice && (
                            <div className='col-span-2'>
                              <span className='text-[11px] text-[#888]'>{t('缓存价格')}</span>
                              <p className={`text-[13px] font-semibold font-mono ${color.accent}`}>{priceInfo.cachePrice}<span className='text-[10px] text-[#999] ml-0.5 font-normal'>/ 1M</span></p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className='text-[11px] text-[#888]'>{t('每次调用')}</span>
                        <p className={`text-[14px] font-semibold font-mono ${color.accent}`}>{priceInfo.price}</p>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {totalPages > 1 && (
            <div className='flex justify-center items-center gap-2 mt-8'>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className='px-3 py-1.5 text-sm border border-[#EBEBEB] rounded-lg bg-white hover:bg-[#FAFAFA] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer'
              >
                {t('上一页')}
              </button>
              <span className='text-[13px] text-[#999] px-2'>
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className='px-3 py-1.5 text-sm border border-[#EBEBEB] rounded-lg bg-white hover:bg-[#FAFAFA] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer'
              >
                {t('下一页')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Models;
