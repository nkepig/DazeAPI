import { getCurrencyConfig } from './render';

export const getMicrodollarsPerDollar = () => 1_000_000;

export const getQuotaPerUnit = () => {
  // QuotaPerUnit was 500000; all DB values are now microdollars (1USD=1M).
  // Returning 1 makes existing `x / getQuotaPerUnit()` a no-op.
  // Use quotaToDisplayAmount() for proper conversion.
  return 1;
};

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
  if (amount === 0) return '$0.000000';
  const { type, symbol } = getCurrencyConfig();
  if (type === 'TOKENS') return `${amount}`;
  if (type === 'CNY') return `¥${amount.toFixed(6)}`;
  if (type === 'CUSTOM') return `${symbol}${amount.toFixed(6)}`;
  return `$${amount.toFixed(6)}`;
};
