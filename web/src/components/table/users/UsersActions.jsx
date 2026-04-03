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

import React, { useState } from 'react';
import { Button } from '@douyinfe/semi-ui';

const UsersActions = ({ setShowAddUser, syncModels, t }) => {
  const [syncing, setSyncing] = useState(false);

  const handleAddUser = () => {
    setShowAddUser(true);
  };

  const handleSyncModels = async () => {
    setSyncing(true);
    await syncModels();
    setSyncing(false);
  };

  return (
    <div className='flex items-center gap-2'>
      <Button onClick={handleAddUser} size='small' className='shrink-0'>
        {t('添加用户')}
      </Button>
      <Button
        onClick={handleSyncModels}
        size='small'
        className='shrink-0'
        loading={syncing}
        theme='light'
        type='tertiary'
      >
        {t('同步模型')}
      </Button>
    </div>
  );
};

export default UsersActions;
