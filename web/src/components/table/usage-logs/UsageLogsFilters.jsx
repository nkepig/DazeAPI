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
import { Button, Form, Select, Space, TagInput } from '@douyinfe/semi-ui';
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
  groupFilter,
  setGroupFilter,
  groupOptions,
  t,
}) => {
  return (
    <div className='usage-logs-filters mb-4'>
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
        <div className='flex flex-col gap-3'>
          <div className='flex flex-wrap items-end gap-3'>
            <div className='flex-1 min-w-[260px] max-w-lg'>
              <Form.DatePicker
                field='dateRange'
                className='w-full'
                type='dateTimeRange'
                placeholder={[t('开始时间'), t('结束时间')]}
                showClear
                pure
                presets={DATE_RANGE_PRESETS.map((preset) => ({
                  text: t(preset.text),
                  start: preset.start(),
                  end: preset.end(),
                }))}
              />
            </div>

            <Form.Select
              field='logType'
              placeholder={t('类型')}
              style={{ width: 120 }}
              showClear
              pure
              onChange={() => {
                setTimeout(() => { refresh(); }, 0);
              }}
            >
              <Form.Select.Option value='0'>{t('全部')}</Form.Select.Option>
              <Form.Select.Option value='1'>{t('充值')}</Form.Select.Option>
              <Form.Select.Option value='2'>{t('消费')}</Form.Select.Option>
              <Form.Select.Option value='3'>{t('管理')}</Form.Select.Option>
              <Form.Select.Option value='4'>{t('系统')}</Form.Select.Option>
              <Form.Select.Option value='5'>{t('错误')}</Form.Select.Option>
              <Form.Select.Option value='6'>{t('退款')}</Form.Select.Option>
            </Form.Select>

            {groupOptions.length > 0 && (
              <Select
                value={groupFilter}
                placeholder={t('分组')}
                style={{ width: 130 }}
                showClear
                onChange={(v) => {
                  setGroupFilter(v || 'all');
                  setTimeout(() => { refresh(); }, 0);
                }}
              >
                <Select.Option value='all'>{t('全部分组')}</Select.Option>
                {groupOptions.map((g) => (
                  <Select.Option key={g} value={g}>{g}</Select.Option>
                ))}
              </Select>
            )}

            <Button
              htmlType='submit'
              loading={loading}
              theme='solid'
              type='primary'
            >
              {t('查询')}
            </Button>
          </div>

          <div className='flex flex-wrap items-center gap-3'>
            <div className='flex-1 min-w-[180px] max-w-xs'>
              <Form.Input
                field='model_name'
                prefix={<IconSearch />}
                placeholder={t('模型名称')}
                showClear
                pure
              />
            </div>

            {isAdminUser && (
              <>
                <div className='flex-1 min-w-[160px] max-w-xs'>
                  <Form.Input
                    field='channel'
                    prefix={<IconSearch />}
                    placeholder={t('渠道 ID')}
                    showClear
                    pure
                  />
                </div>
                <div className='flex-1 min-w-[180px] max-w-xs'>
                  <Form.Input
                    field='username'
                    prefix={<IconSearch />}
                    placeholder={t('用户名称')}
                    showClear
                    pure
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </Form>
    </div>
  );
};

export default LogsFilters;
