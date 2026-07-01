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
import BubbleFilter from '../../common/BubbleFilter';

const ChannelsActions = ({
  statusFilter,
  setStatusFilter,
  groupFilter,
  setGroupFilter,
  groupOptions,
  loadChannels,
  pageSize,
  setActivePage,
  t,
}) => {
  const statusOptions = useMemo(
    () => [
      { value: 'all', label: '全部', color: '#94a3b8' },
      { value: 'enabled', label: '已启用', color: '#22c55e' },
      { value: 'disabled', label: '已禁用', color: '#ef4444' },
    ],
    [],
  );

  const groupFilterOptions = useMemo(
    () => [
      { value: 'all', label: '全部' },
      ...groupOptions.map((group) => ({ value: group, label: group })),
    ],
    [groupOptions],
  );

  return (
    <div className='flex items-center gap-3 flex-wrap'>
      <BubbleFilter
        size='small'
        label='状态'
        options={statusOptions}
        value={statusFilter}
        onChange={(nextValue) => {
          localStorage.setItem('channel-status-filter', nextValue);
          setStatusFilter(nextValue);
          setActivePage(1);
          loadChannels(1, pageSize, undefined, undefined, nextValue, groupFilter);
        }}
        t={t}
      />
      {groupOptions.length > 0 ? (
        <BubbleFilter
          size='small'
          label='分组'
          options={groupFilterOptions}
          value={groupFilter}
          onChange={(nextValue) => {
            localStorage.setItem('channel-group-filter', nextValue);
            setGroupFilter(nextValue);
            setActivePage(1);
            loadChannels(1, pageSize, undefined, undefined, statusFilter, nextValue);
          }}
          t={t}
        />
      ) : null}
    </div>
  );
};

export default ChannelsActions;
