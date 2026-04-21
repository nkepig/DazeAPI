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

import React from 'react';
import {
  Typography,
  Card,
  Button,
  Banner,
  Spin,
  InputNumber,
} from '@douyinfe/semi-ui';
import { SiAlipay } from 'react-icons/si';
import { Wallet, BarChart2, TrendingUp, Receipt } from 'lucide-react';
import { showError } from '../../helpers';

const { Text } = Typography;

const RechargeCard = ({
  t,
  enableAlipayTopUp,
  minTopUp,
  payAmount,
  onPayAmountChange,
  onOpenAlipay,
  userState,
  renderQuota,
  statusLoading,
  onOpenHistory,
}) => {
  const handleOpenQr = () => {
    const y = Math.round(Number(payAmount) * 100) / 100;
    if (!Number.isFinite(y) || y < minTopUp) {
      showError(t('金额不能低于最低充值限额'));
      return;
    }
    onOpenAlipay();
  };
  return (
    <Card className='!rounded-2xl shadow-sm border border-[var(--semi-color-border)]'>
      <div className='flex items-center justify-between mb-6'>
        <div className='flex items-center gap-3'>
          <div className='w-10 h-10 rounded-xl bg-[#e6f4ff] flex items-center justify-center'>
            <SiAlipay size={22} color='#1677FF' />
          </div>
          <div>
            <Typography.Text className='text-lg font-semibold block'>
              {t('支付宝充值')}
            </Typography.Text>
            <Text type='tertiary' style={{ fontSize: 12 }}>
              {t('点击生成付款码，使用支付宝扫码支付')}
            </Text>
          </div>
        </div>
        <Button
          icon={<Receipt size={16} />}
          theme='solid'
          type='tertiary'
          onClick={onOpenHistory}
        >
          {t('账单')}
        </Button>
      </div>

      <div className='grid grid-cols-3 gap-3 mb-6'>
        <div className='text-center rounded-xl bg-[var(--semi-color-fill-0)] py-3 px-2'>
          <div className='text-base font-bold mb-1'>
            {renderQuota(userState?.user?.quota, 2)}
          </div>
          <div className='flex items-center justify-center gap-1 text-xs text-[var(--semi-color-text-2)]'>
            <Wallet size={12} />
            {t('当前余额')}
          </div>
        </div>
        <div className='text-center rounded-xl bg-[var(--semi-color-fill-0)] py-3 px-2'>
          <div className='text-base font-bold mb-1'>
            {renderQuota(userState?.user?.used_quota, 2)}
          </div>
          <div className='flex items-center justify-center gap-1 text-xs text-[var(--semi-color-text-2)]'>
            <TrendingUp size={12} />
            {t('历史消耗')}
          </div>
        </div>
        <div className='text-center rounded-xl bg-[var(--semi-color-fill-0)] py-3 px-2'>
          <div className='text-base font-bold mb-1'>
            {userState?.user?.request_count || 0}
          </div>
          <div className='flex items-center justify-center gap-1 text-xs text-[var(--semi-color-text-2)]'>
            <BarChart2 size={12} />
            {t('请求次数')}
          </div>
        </div>
      </div>

      {statusLoading ? (
        <div className='py-12 flex justify-center'>
          <Spin size='large' />
        </div>
      ) : enableAlipayTopUp ? (
        <div>
          <div style={{ marginBottom: 12 }}>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>
              {t('充值金额（元）')}
            </Text>
            <div className='flex items-center gap-2 w-full'>
              <InputNumber
                value={payAmount}
                min={minTopUp}
                max={999999.99}
                step={1}
                precision={2}
                className='flex-1 min-w-0'
                onChange={(v) => onPayAmountChange(v == null ? minTopUp : v)}
              />
              <Text className='shrink-0 text-[var(--semi-color-text-1)]'>{t('元')}</Text>
            </div>
            <Text type='tertiary' style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
              {t('上下箭头每次增减 1 元；手动输入支持两位小数')}
            </Text>
          </div>
          <Button
            theme='solid'
            type='primary'
            size='large'
            block
            icon={<SiAlipay size={20} />}
            onClick={handleOpenQr}
            style={{ background: '#1677FF', borderColor: '#1677FF' }}
          >
            {t('生成付款码')}
          </Button>
        </div>
      ) : (
        <Banner
          type='info'
          description={t(
            '管理员未开启在线充值功能，请联系管理员在运营设置中配置支付方式。',
          )}
          className='!rounded-xl'
          closeIcon={null}
        />
      )}
    </Card>
  );
};

export default RechargeCard;
