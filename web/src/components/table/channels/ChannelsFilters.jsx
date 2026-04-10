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
import { Button, Form } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';

const ChannelsFilters = ({
  setEditingChannel,
  setShowEdit,
  refresh,
  formInitValues,
  setFormApi,
  searchChannels,
  enableTagMode,
  formApi,
  loading,
  searching,
  setShowColumnSelector,
  t,
}) => {
  return (
    <>
      <Button
        size='small'
        onClick={() => {
          setEditingChannel({ id: undefined });
          setShowEdit(true);
        }}
        className='shrink-0'
      >
        {t('添加渠道')}
      </Button>

      <Form
        initValues={formInitValues}
        getFormApi={(api) => setFormApi(api)}
        onSubmit={() => searchChannels(enableTagMode)}
        allowEmpty={true}
        autoComplete='off'
        layout='horizontal'
        trigger='change'
        stopValidateWithError={false}
        className='flex items-center gap-2 flex-wrap'
      >
        <div className='w-40'>
          <Form.Input
            size='small'
            field='searchKeyword'
            prefix={<IconSearch />}
            placeholder={t('搜索名称/密钥')}
            showClear
            pure
          />
        </div>
        <div className='w-32'>
          <Form.Input
            size='small'
            field='searchModel'
            prefix={<IconSearch />}
            placeholder={t('模型关键字')}
            showClear
            pure
          />
        </div>
        <Button
          size='small'
          htmlType='submit'
          loading={loading || searching}
        >
          {t('查询')}
        </Button>
      </Form>
    </>
  );
};

export default ChannelsFilters;
