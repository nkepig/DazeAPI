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

import React from 'react';
import { Skeleton } from '@douyinfe/semi-ui';
import { renderQuota } from '../../../helpers';
import { useMinimumLoadingTime } from '../../../hooks/common/useMinimumLoadingTime';

const StatItem = ({ label, value }) => (
  <div className='flex items-baseline gap-1.5'>
    <span className='text-[11px] font-medium text-[#bbb] uppercase tracking-wider'>{label}</span>
    <span className='text-[14px] font-semibold text-[#1A1A1A] tabular-nums'>{value}</span>
  </div>
);

const LogsActions = ({
  stat,
  loadingStat,
  showStat,
  t,
}) => {
  const showSkeleton = useMinimumLoadingTime(loadingStat);
  const needSkeleton = !showStat || showSkeleton;

  const placeholder = (
    <div className='flex items-center gap-6'>
      <Skeleton.Title style={{ width: 100, height: 16, borderRadius: 4 }} />
      <Skeleton.Title style={{ width: 60, height: 16, borderRadius: 4 }} />
      <Skeleton.Title style={{ width: 60, height: 16, borderRadius: 4 }} />
    </div>
  );

  return (
    <div className='w-full'>
      <Skeleton loading={needSkeleton} active placeholder={placeholder}>
        <div className='flex items-center gap-6 flex-wrap'>
          <StatItem label={t('消耗额度')} value={renderQuota(stat.quota)} />
          <div className='w-px h-3 bg-[#e8e8e8]' />
          <StatItem label='RPM' value={stat.rpm} />
          <div className='w-px h-3 bg-[#e8e8e8]' />
          <StatItem label='TPM' value={stat.tpm} />
        </div>
      </Skeleton>
    </div>
  );
};

export default LogsActions;
