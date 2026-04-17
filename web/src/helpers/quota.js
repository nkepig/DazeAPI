import { getCurrencyConfig, cachedGetItem } from './render';

export const getQuotaPerUnit = () => {
  const raw = parseFloat(cachedGetItem('quota_per_unit') || '1');
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
};

export const getMicrodollarsPerDollar = () => 1_000_000;

export const quotaToDisplayAmount = (quota) => {
  const q = Number(quota || 0);
  if (!Number.isFinite(q) || q <= 0) return 0;
  const { type, rate } = getCurrencyConfig();
  if (type === 'TOKENS') return q;
  const usd = q / getMicrodollarsPerDollar();
  if (type === 'USD') return usd;
  return usd * (rate || 1);
};

export const displayAmountToQuota = (amount) => {
  const val = Number(amount || 0);
  if (!Number.isFinite(val) || val <= 0) return 0;
  const { type, rate } = getCurrencyConfig();
  if (type === 'TOKENS') return Math.round(val);
  const usd = type === 'USD' ? val : val / (rate || 1);
  return Math.round(usd * getMicrodollarsPerDollar());
};

export const formatDollarAmount = (quota) => {
  const amount = quotaToDisplayAmount(quota);
  if (amount === 0) return '$0';
  if (amount >= 1) {
    if (amount === Math.floor(amount)) return `$${amount.toFixed(0)}`;
    return `$${amount.toFixed(2)}`;
  }
  let formatted = `$${amount.toFixed(6)}`;
  formatted = formatted.replace(/0+$/, '').replace(/\.$/, '');
  return formatted;
};