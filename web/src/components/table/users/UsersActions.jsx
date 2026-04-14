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
import { Button, Dropdown } from '@douyinfe/semi-ui';
import { ChevronDown } from 'lucide-react';
import DefaultVendorRatioModal from './modals/DefaultVendorRatioModal';

const UsersActions = ({ setShowAddUser, syncModels, t }) => {
  const [syncing, setSyncing] = useState(false);
  const [vendorModalOpen, setVendorModalOpen] = useState(false);

  const handleAddUser = () => {
    setShowAddUser(true);
  };

  const handleDeleteUnavailable = async () => {
    setSyncing(true);
    await syncModels();
    setSyncing(false);
  };

  return (
    <div className='flex items-center gap-2 flex-wrap'>
      <Button onClick={handleAddUser} size='small' className='shrink-0'>
        {t('添加用户')}
      </Button>
      <Dropdown
        trigger='click'
        position='bottomLeft'
        render={
          <Dropdown.Menu>
            <Dropdown.Item onClick={handleDeleteUnavailable}>
              {t('删除不可用模型')}
            </Dropdown.Item>
            <Dropdown.Item onClick={() => setVendorModalOpen(true)}>
              {t('默认供应商倍率')}
            </Dropdown.Item>
          </Dropdown.Menu>
        }
      >
        <Button
          size='small'
          className='shrink-0'
          loading={syncing}
          theme='light'
          type='tertiary'
          iconPosition='right'
          icon={<ChevronDown size={14} />}
        >
          {t('同步模型')}
        </Button>
      </Dropdown>
      <DefaultVendorRatioModal
        visible={vendorModalOpen}
        onClose={() => setVendorModalOpen(false)}
        t={t}
      />
    </div>
  );
};

export default UsersActions;
