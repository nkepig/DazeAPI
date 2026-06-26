/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by the
Free Software Foundation, either version 3 of the License, or (at your option)
any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useState, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API, showError, renderQuota } from '../../helpers';
import { useTranslation } from 'react-i18next';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';

import RechargeCard from './RechargeCard';
import TopupHistoryModal from './modals/TopupHistoryModal';
import AlipayQRModal from './modals/AlipayQRModal';

const TopUp = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);

  const [minTopUp, setMinTopUp] = useState(statusState?.status?.min_topup || 1);
	const [payAmount, setPayAmount] = useState(10);
  const [enableAlipayTopUp, setEnableAlipayTopUp] = useState(false);
  const [enableEpayTopUp, setEnableEpayTopUp] = useState(false);
  const [epayPayTypes, setEpayPayTypes] = useState([]);
  const [alipayQRVisible, setAlipayQRVisible] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);

  const [openHistory, setOpenHistory] = useState(false);
  const [epayLoading, setEpayLoading] = useState(false);

  const getUserQuota = async () => {
    const res = await API.get(`/api/user/self`);
    const { success, message, data } = res.data;
    if (success) {
      userDispatch({ type: 'login', payload: data });
    } else {
      showError(message);
    }
  };

  const getTopupInfo = async () => {
    try {
      const res = await API.get('/api/user/topup/info');
      const { data, success } = res.data;
      if (success) {
        setEnableAlipayTopUp(data.enable_alipay_topup || false);
        setEnableEpayTopUp(data.enable_epay_topup || false);
        setEpayPayTypes(Array.isArray(data.epay_pay_types) ? data.epay_pay_types : []);
        const minVal = Math.max(1, Number(data.min_topup) || 1);
        setMinTopUp(minVal);
      } else {
        showError(data || t('获取充值配置失败'));
      }
    } catch (error) {
      showError(t('获取充值配置异常'));
    }
  };

  useEffect(() => {
    if (searchParams.get('show_history') !== 'true') return;
    setOpenHistory(true);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('show_history');
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    getUserQuota().then();
  }, []);

  useEffect(() => {
    getTopupInfo().then();
  }, []);

  useEffect(() => {
    const m = Math.max(1, Number(minTopUp) || 1);
    setPayAmount((prev) => {
      const p = Math.round(Number(prev) * 100) / 100;
      return p < m ? m : p;
    });
  }, [minTopUp]);

  useEffect(() => {
    if (statusState?.status) {
      setStatusLoading(false);
    }
  }, [statusState?.status]);

  const handleOpenEpay = async (type) => {
    const y = Math.round(Number(payAmount) * 100) / 100;
    if (!Number.isFinite(y) || y < minTopUp) {
      showError(t('金额不能低于最低充值限额'));
      return;
    }
    if (epayLoading) return;
    setEpayLoading(true);
    try {
      const res = await API.post('/api/user/epay/pay', { amount: y, type });
      const { success, message, data } = res.data;
      if (success && data?.pay_url) {
        window.location.href = data.pay_url;
        return;
      }
      showError(message || t('创建支付订单失败'));
    } catch (error) {
      showError(t('支付请求失败'));
    } finally {
      setEpayLoading(false);
    }
  };

  return (
    <div className='w-full max-w-xl mx-auto relative min-h-screen lg:min-h-0 px-3 pb-10'>
      <TopupHistoryModal
        visible={openHistory}
        onCancel={() => setOpenHistory(false)}
        t={t}
      />

      <AlipayQRModal
        visible={alipayQRVisible}
        onCancel={() => setAlipayQRVisible(false)}
        onSuccess={getUserQuota}
        minTopUp={minTopUp}
        payAmount={payAmount}
        directPay
      />

      <RechargeCard
        t={t}
        enableAlipayTopUp={enableAlipayTopUp}
        enableEpayTopUp={enableEpayTopUp}
        epayPayTypes={epayPayTypes}
        minTopUp={minTopUp}
        payAmount={payAmount}
        onPayAmountChange={setPayAmount}
        onOpenAlipay={() => setAlipayQRVisible(true)}
        onOpenEpay={handleOpenEpay}
        epayLoading={epayLoading}
        userState={userState}
        renderQuota={renderQuota}
        statusLoading={statusLoading}
        onOpenHistory={() => setOpenHistory(true)}
      />
    </div>
  );
};

export default TopUp;
