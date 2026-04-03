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
import { Switch, Typography, Select } from '@douyinfe/semi-ui';

const ChannelsActions = ({
  enableTagMode,
  setEnableTagMode,
  statusFilter,
  setStatusFilter,
  loadChannels,
  pageSize,
  setActivePage,
  t,
}) => {
  return (
    <>
      <div className='flex items-center gap-1.5'>
        <Typography.Text size='small' type='tertiary' className='whitespace-nowrap select-none'>
          {t('标签聚合')}
        </Typography.Text>
        <Switch
          size='small'
          checked={enableTagMode}
          onChange={(v) => {
            localStorage.setItem('enable-tag-mode', v + '');
            setEnableTagMode(v);
            setActivePage(1);
            loadChannels(1, pageSize, v);
          }}
        />
      </div>

      <div className='flex items-center gap-1.5'>
        <Typography.Text size='small' type='tertiary' className='whitespace-nowrap select-none'>
          {t('状态')}
        </Typography.Text>
        <Select
          size='small'
          value={statusFilter}
          onChange={(v) => {
            localStorage.setItem('channel-status-filter', v);
            setStatusFilter(v);
            setActivePage(1);
            loadChannels(1, pageSize, enableTagMode, undefined, v);
          }}
          style={{ minWidth: 72 }}
        >
          <Select.Option value='all'>{t('全部')}</Select.Option>
          <Select.Option value='enabled'>{t('已启用')}</Select.Option>
          <Select.Option value='disabled'>{t('已禁用')}</Select.Option>
        </Select>
      </div>
    </>
  );
};

export default ChannelsActions;
