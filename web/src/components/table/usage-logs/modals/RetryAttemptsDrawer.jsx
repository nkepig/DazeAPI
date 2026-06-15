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

import React, { useMemo } from 'react';
import { Empty, SideSheet, Space, Tag, Typography } from '@douyinfe/semi-ui';

const { Text } = Typography;

const CARD_BASE = {
  position: 'relative',
  borderRadius: 10,
  padding: '12px 14px 12px 18px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  transition: 'box-shadow .18s ease, transform .18s ease',
  cursor: 'default',
};

const CARD_FAILED = {
  ...CARD_BASE,
  background: 'linear-gradient(135deg, var(--semi-color-bg-1) 0%, rgba(255,77,79,.04) 100%)',
  borderLeft: '3px solid #f93943',
  boxShadow: '0 1px 3px rgba(0,0,0,.06)',
};

const CARD_SUCCESS = {
  ...CARD_BASE,
  background: 'linear-gradient(135deg, var(--semi-color-bg-1) 0%, rgba(20,199,150,.04) 100%)',
  borderLeft: '3px solid #14c796',
  boxShadow: '0 1px 3px rgba(0,0,0,.06)',
};

const CARD_HOVER = {
  boxShadow: '0 4px 12px rgba(0,0,0,.10)',
  transform: 'translateY(-1px)',
};

const TIMELINE_DOT_FAILED = {
  width: 10,
  height: 10,
  borderRadius: '50%',
  background: '#f93943',
  border: '2px solid #fff',
  boxShadow: '0 0 0 2px rgba(249,57,67,.25)',
  flexShrink: 0,
};

const TIMELINE_DOT_SUCCESS = {
  width: 10,
  height: 10,
  borderRadius: '50%',
  background: '#14c796',
  border: '2px solid #fff',
  boxShadow: '0 0 0 2px rgba(20,199,150,.25)',
  flexShrink: 0,
};

const TIMELINE_LINE = {
  width: 2,
  flex: 1,
  minHeight: 12,
  background: 'var(--semi-color-border)',
  marginLeft: 4,
  borderRadius: 1,
};

const ERROR_BOX = {
  background: 'rgba(249,57,67,.06)',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 12,
  color: 'var(--semi-color-text-2)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  lineHeight: 1.6,
  borderLeft: '2px solid rgba(249,57,67,.3)',
};

const SUCCESS_HINT = {
  fontSize: 12,
  color: 'var(--semi-color-text-2)',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const META_BADGE = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 32,
  height: 20,
  padding: '0 6px',
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

function AttemptCard({ attempt, index, isLast }) {
  const isSuccess = attempt?.success;
  const cardStyle = isSuccess ? CARD_SUCCESS : CARD_FAILED;
  const dotStyle = isSuccess ? TIMELINE_DOT_SUCCESS : TIMELINE_DOT_FAILED;
  const channelLabel = attempt?.channel_name
    ? `${attempt.channel_id} · ${attempt.channel_name}`
    : `${attempt?.channel_id ?? '-'}`;

  const [hovered, setHovered] = React.useState(false);

  return (
    <div style={{ display: 'flex', gap: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 18, flexShrink: 0 }}>
        <div style={dotStyle} />
        {!isLast && <div style={TIMELINE_LINE} />}
      </div>
      <div style={{ flex: 1, minWidth: 0, marginLeft: 8 }}>
        <div
          style={hovered ? { ...cardStyle, ...CARD_HOVER } : cardStyle}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <Space wrap size={4}>
              <Tag color={isSuccess ? 'green' : 'red'} size='small' style={{ fontWeight: 600 }}>
                {isSuccess ? '✓' : '✗'}
              </Tag>
              <Text strong size='small'>{channelLabel}</Text>
              {attempt?.multi_key_index != null && (
                <Tag size='small' style={{ fontWeight: 600, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                  K{attempt.multi_key_index}
                </Tag>
              )}
            </Space>
            <Space size={4}>
              {attempt?.retry_index != null && (
                <span style={{ ...META_BADGE, background: 'var(--semi-color-fill-1)', color: 'var(--semi-color-text-2)' }}>
                  #{attempt.retry_index}
                </span>
              )}
              {attempt?.status_code ? (
                <span style={{ ...META_BADGE, background: isSuccess ? 'rgba(20,199,150,.1)' : 'rgba(249,57,67,.1)', color: isSuccess ? '#14c796' : '#f93943' }}>
                  {attempt.status_code}
                </span>
              ) : null}
              {attempt?.use_time_seconds != null && attempt.use_time_seconds > 0 && (
                <Text type='tertiary' size='small'>{attempt.use_time_seconds}s</Text>
              )}
            </Space>
          </div>
          {attempt?.error ? (
            <div style={ERROR_BOX}>{attempt.error}</div>
          ) : (
            <div style={SUCCESS_HINT}>
              <span style={{ color: '#14c796', fontSize: 13, lineHeight: 1 }}>✓</span>
              <span>{'该次尝试成功'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const RetryAttemptsDrawer = ({
  t,
  showRetryAttemptsDrawer,
  setShowRetryAttemptsDrawer,
  retryAttemptsTarget,
}) => {
  const attempts = useMemo(() => {
    return Array.isArray(retryAttemptsTarget?.attempts)
      ? retryAttemptsTarget.attempts.filter(Boolean)
      : [];
  }, [retryAttemptsTarget]);

  const chainText = useMemo(() => {
    const chain = Array.isArray(retryAttemptsTarget?.useChannel)
      ? retryAttemptsTarget.useChannel.filter(Boolean)
      : [];
    return chain.join(' → ');
  }, [retryAttemptsTarget]);

  const isFinalError = retryAttemptsTarget?.finalStatus === 'error';

  return (
    <SideSheet
      placement='right'
      title={t('重试详情')}
      visible={showRetryAttemptsDrawer}
      onCancel={() => setShowRetryAttemptsDrawer(false)}
      width={560}
    >
      <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{
          background: isFinalError
            ? 'linear-gradient(135deg, rgba(249,57,67,.06), rgba(249,57,67,.02))'
            : 'linear-gradient(135deg, rgba(20,199,150,.06), rgba(20,199,150,.02))',
          borderRadius: 10,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          border: `1px solid ${isFinalError ? 'rgba(249,57,67,.15)' : 'rgba(20,199,150,.15)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 24, height: 24, borderRadius: '50%',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: isFinalError ? 'rgba(249,57,67,.12)' : 'rgba(20,199,150,.12)',
              fontSize: 14, fontWeight: 700, lineHeight: 1,
              color: isFinalError ? '#f93943' : '#14c796',
            }}>
              {isFinalError ? '✗' : '✓'}
            </span>
            <Text strong style={{ fontSize: 14 }}>{t('最终结果')}</Text>
            <Tag color={isFinalError ? 'red' : 'green'} size='small' style={{ fontWeight: 600 }}>
              {isFinalError ? t('最终失败') : t('最终成功')}
            </Tag>
          </div>
          {chainText && (
            <Text type='tertiary' size='small' style={{ marginLeft: 32 }}>
              {t('渠道链路')}: {chainText}
            </Text>
          )}
          <Space wrap size={8} style={{ marginLeft: 32 }}>
            {retryAttemptsTarget?.modelName && (
              <Text type='tertiary' size='small'>{t('模型')}: {retryAttemptsTarget.modelName}</Text>
            )}
            {retryAttemptsTarget?.requestId && (
              <Text type='tertiary' size='small'>Request ID: {retryAttemptsTarget.requestId}</Text>
            )}
          </Space>
        </div>

        {attempts.length === 0 ? (
          <Empty description={t('暂无重试明细')} style={{ padding: '24px 0' }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {attempts.map((attempt, index) => (
              <AttemptCard
                key={`${attempt?.retry_index ?? index}-${attempt?.channel_id ?? index}-K${attempt?.multi_key_index ?? ''}`}
                attempt={attempt}
                index={index}
                isLast={index === attempts.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </SideSheet>
  );
};

export default RetryAttemptsDrawer;