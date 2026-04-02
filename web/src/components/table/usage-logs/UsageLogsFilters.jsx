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

import { DATE_RANGE_PRESETS } from '../../../constants/console.constants';

const LogsFilters = ({
  formInitValues,
  setFormApi,
  refresh,
  formApi,
  setLogType,
  loading,
  isAdminUser,
  t,
}) => {
  return (
    <div className='usage-logs-filters'>
      <Form
        initValues={formInitValues}
        getFormApi={(api) => setFormApi(api)}
        onSubmit={refresh}
        allowEmpty={true}
        autoComplete='off'
        layout='vertical'
        trigger='change'
        stopValidateWithError={false}
        className='!bg-transparent'
      >
        <div className='flex items-center gap-2 flex-wrap'>
        <div className='w-full md:w-auto md:min-w-[280px]'>
          <Form.DatePicker
            field='dateRange'
            className='w-full'
            type='dateTimeRange'
            placeholder={[t('开始时间'), t('结束时间')]}
            showClear
            pure
            size='small'
            presets={DATE_RANGE_PRESETS.map((preset) => ({
              text: t(preset.text),
              start: preset.start(),
              end: preset.end(),
            }))}
          />
        </div>

        <div className='w-28'>
          <Form.Input
            field='model_name'
            prefix={<IconSearch />}
            placeholder={t('模型名称')}
            showClear
            pure
            size='small'
          />
        </div>

        {isAdminUser && (
          <>
            <div className='w-24'>
              <Form.Input
                field='channel'
                prefix={<IconSearch />}
                placeholder={t('渠道 ID')}
                showClear
                pure
                size='small'
              />
            </div>
            <div className='w-24'>
              <Form.Input
                field='username'
                prefix={<IconSearch />}
                placeholder={t('用户名称')}
                showClear
                pure
                size='small'
              />
            </div>
          </>
        )}

        <Form.Select
          field='logType'
          placeholder={t('类型')}
          style={{ minWidth: 80 }}
          showClear
          pure
          onChange={() => {
            setTimeout(() => { refresh(); }, 0);
          }}
          size='small'
        >
          <Form.Select.Option value='0'>{t('全部')}</Form.Select.Option>
          <Form.Select.Option value='1'>{t('充值')}</Form.Select.Option>
          <Form.Select.Option value='2'>{t('消费')}</Form.Select.Option>
          <Form.Select.Option value='3'>{t('管理')}</Form.Select.Option>
          <Form.Select.Option value='4'>{t('系统')}</Form.Select.Option>
          <Form.Select.Option value='5'>{t('错误')}</Form.Select.Option>
          <Form.Select.Option value='6'>{t('退款')}</Form.Select.Option>
        </Form.Select>

        <Button
          size='small'
          htmlType='submit'
          loading={loading}
        >
          {t('查询')}
        </Button>
        <Button
          size='small'
          onClick={() => {
            if (formApi) {
              formApi.reset();
              setLogType(0);
              setTimeout(() => { refresh(); }, 100);
            }
          }}
        >
          {t('重置')}
        </Button>
        </div>
      </Form>
    </div>
  );
};

export default LogsFilters;
