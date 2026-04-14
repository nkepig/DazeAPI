import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Button, Typography, Spin } from '@douyinfe/semi-ui';
import { QRCodeSVG } from 'qrcode.react';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';
import { SiAlipay } from 'react-icons/si';
import { CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

function roundMoney(v) {
  const n = Math.round(Number(v) * 100) / 100;
  return Number.isFinite(n) ? n : 0;
}

const AlipayQRModal = ({
  visible,
  onCancel,
  onSuccess,
  minTopUp = 1,
  payAmount = 1,
  directPay = true,
}) => {
  const { t } = useTranslation();

  const [step, setStep] = useState('loading');
  const [amount, setAmount] = useState(minTopUp);
  const [loading, setLoading] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [tradeNo, setTradeNo] = useState('');
  const [displayMoney, setDisplayMoney] = useState(0);
  const [status, setStatus] = useState('pending');
  const [countdown, setCountdown] = useState('5:00');
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef(null);
  const timerRef = useRef(null);
  const expireRef = useRef(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  const resetState = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setStep('loading');
    setQrUrl('');
    setTradeNo('');
    setDisplayMoney(0);
    setStatus('pending');
    setCountdown('5:00');
    setRefreshing(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!visible) resetState();
  }, [visible, resetState]);

  useEffect(() => {
    const n = roundMoney(payAmount);
    const min = roundMoney(minTopUp);
    setAmount(Number.isFinite(n) && n >= min ? n : min);
  }, [payAmount, minTopUp]);

  const startCountdown = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    expireRef.current = Date.now() + 5 * 60 * 1000;
    timerRef.current = setInterval(() => {
      const diff = expireRef.current - Date.now();
      if (diff <= 0) {
        setCountdown('0:00');
        setStatus('expired');
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${m}:${s.toString().padStart(2, '0')}`);
    }, 1000);
  }, []);

  useEffect(() => {
    if (!visible || !directPay) return;
    const charge = (() => {
      const n = roundMoney(payAmount);
      const min = roundMoney(minTopUp);
      return Number.isFinite(n) && n >= min ? n : min;
    })();
    let cancelled = false;
    setLoading(true);
    setStep('loading');
    (async () => {
      try {
        const res = await API.post('/api/user/alipay/pay', { amount: charge });
        const { success, message, data } = res.data;
        if (cancelled) return;
        if (success && data) {
          setTradeNo(data.trade_no);
          setQrUrl(data.qr_url);
          setDisplayMoney(Number(data.money) || charge);
          setStatus('pending');
          setStep('qrcode');
          startCountdown();
        } else {
          showError(message || t('创建支付订单失败'));
          onCancelRef.current();
        }
      } catch (e) {
        if (!cancelled) {
          showError(t('支付请求失败'));
          onCancelRef.current();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, directPay, payAmount, minTopUp, startCountdown, t]);

  const pollStatus = useCallback(async () => {
    if (!tradeNo) return;
    try {
      const res = await API.get(`/api/user/alipay/status?trade_no=${encodeURIComponent(tradeNo)}`);
      const { success, data } = res.data;
      if (success && data) {
        if (data.status === 'success') {
          setStatus('success');
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          showSuccess(t('充值成功'));
          if (onSuccess) onSuccess();
          return;
        }
        if (data.status === 'failed') {
          setStatus('failed');
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          return;
        }
      }
    } catch (e) { /* ignore polling errors */ }
  }, [tradeNo, t, onSuccess]);

  useEffect(() => {
    if (step === 'qrcode' && tradeNo && status === 'pending') {
      const intervalMs = 3000;
      pollRef.current = setInterval(pollStatus, intervalMs);
      pollStatus();
      return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
    }
  }, [step, tradeNo, status, pollStatus]);

  const handleRefresh = async () => {
    if (refreshing || status !== 'pending') return;
    setRefreshing(true);
    try {
      const res = await API.post('/api/user/alipay/pay', { amount: roundMoney(amount) });
      const { success, message, data } = res.data;
      if (success && data) {
        setTradeNo(data.trade_no);
        setQrUrl(data.qr_url);
        setDisplayMoney(Number(data.money) || roundMoney(amount));
        setStatus('pending');
        startCountdown();
      } else {
        showError(message || t('刷新二维码失败'));
      }
    } catch (err) {
      showError(t('网络异常，请稍后重试'));
    } finally {
      setRefreshing(false);
    }
  };

  const handleClose = () => {
    resetState();
    onCancel();
  };

  const renderQRCodeStep = () => {
    if (status === 'success') {
      return (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, margin: '0 auto 16px', borderRadius: '50%', background: '#f6ffed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={32} color='#52c41a' />
          </div>
          <Typography.Title heading={4} style={{ color: '#52c41a', margin: '0 0 8px' }}>{t('充值成功')}</Typography.Title>
          <Typography.Text type='tertiary'>{t('额度已到账')}</Typography.Text>
          <div style={{ marginTop: 24 }}>
            <Button onClick={handleClose}>{t('关闭')}</Button>
          </div>
        </div>
      );
    }

    if (status === 'failed') {
      return (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, margin: '0 auto 16px', borderRadius: '50%', background: '#fff2f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={32} color='#ff4d4f' />
          </div>
          <Typography.Title heading={4} style={{ color: '#ff4d4f', margin: '0 0 8px' }}>{t('充值失败')}</Typography.Title>
          <div style={{ marginTop: 16 }}>
            <Button onClick={() => { resetState(); }}>{t('重新充值')}</Button>
          </div>
        </div>
      );
    }

    if (status === 'expired') {
      return (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <Typography.Text type='danger' style={{ fontSize: 16, display: 'block', marginBottom: 16 }}>{t('二维码已过期')}</Typography.Text>
          <div style={{ marginTop: 16 }}>
            <Button onClick={() => { resetState(); }}>{t('重新充值')}</Button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ padding: '24px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, margin: '0 auto 8px', borderRadius: 12, background: '#e6f4ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SiAlipay size={20} color='#1677FF' />
          </div>
          <Typography.Title heading={4} style={{ margin: 0 }}>{t('等待支付')}</Typography.Title>
          <Typography.Text type='tertiary' style={{ fontSize: 13 }}>
            {t('请在')} <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1677FF' }}>{countdown}</span> {t('内完成支付')}
          </Typography.Text>
        </div>

        <div style={{ background: '#f9fafb', borderRadius: 16, border: '1px solid #f0f0f0', padding: 16, marginBottom: 16, textAlign: 'center' }}>
          <Typography.Text type='tertiary' style={{ fontSize: 13 }}>{t('应付金额')}</Typography.Text>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#1677FF' }}>¥{displayMoney.toFixed(2)}</div>
        </div>

        {qrUrl && (
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ display: 'inline-block', padding: 16, background: '#fff', border: '1px solid #f0f0f0', borderRadius: 16 }}>
              <QRCodeSVG value={qrUrl} size={200} level='M' />
            </div>
            <Typography.Text type='tertiary' style={{ display: 'block', marginTop: 12, fontSize: 13 }}>
              {t('打开')} <span style={{ color: '#1677FF', fontWeight: 600 }}>{t('支付宝')}</span> {t('扫描二维码完成支付')}
            </Typography.Text>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button icon={<RefreshCw size={14} />} onClick={handleRefresh} loading={refreshing} block>
            {t('刷新二维码')}
          </Button>
        </div>
      </div>
    );
  };

  const showBootSpinner = visible && directPay && (step === 'loading' || loading) && !qrUrl;

  return (
    <Modal
      title={null}
      visible={visible}
      onCancel={handleClose}
      footer={null}
      centered
      width={420}
      closeOnEsc
      maskClosable
    >
      {showBootSpinner ? (
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <Spin size='large' />
          <Typography.Text type='tertiary' style={{ display: 'block', marginTop: 16 }}>
            {t('正在创建订单...')}
          </Typography.Text>
        </div>
      ) : (
        renderQRCodeStep()
      )}
    </Modal>
  );
};

export default AlipayQRModal;
