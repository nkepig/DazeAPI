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
import BubbleFilter from '../../common/BubbleFilter';

const LogsFilters = ({
  formInitValues,
  setFormApi,
  refresh,
  formApi,
  logType,
  setLogType,
  loading,
  isAdminUser,
  groupFilter,
  groupOptions,
  t,
}) => {
  const logTypeOptions = [
    { value: '0', label: '全部', color: '#94a3b8' },
    { value: '1', label: '充值', color: '#22c55e' },
    { value: '2', label: '消费', color: '#6366f1' },
    { value: '3', label: '管理', color: '#38bdf8' },
    { value: '4', label: '系统', color: '#f59e0b' },
    { value: '5', label: '错误', color: '#ef4444' },
    { value: '6', label: '退款', color: '#a855f7' },
  ];

  const groupFilterOptions = [
    { value: 'all', label: '全部分组' },
    ...groupOptions.map((group) => ({ value: group, label: group })),
  ];

  return (
    <div className='usage-logs-filters mb-4'>
      <Form
        initValues={formInitValues}
        getFormApi={(api) => setFormApi(api)}
        onSubmit={() => refresh()}
        allowEmpty={true}
        autoComplete='off'
        layout='vertical'
        trigger='change'
        stopValidateWithError={false}
        className='!bg-transparent'
      >
        <div className='flex flex-col gap-3'>
          <div className='flex flex-wrap items-center gap-3'>
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

            <BubbleFilter
              size='small'
              label='类型'
              options={logTypeOptions}
              value={String(logType ?? formInitValues.logType ?? '0')}
              onChange={(nextValue) => {
                formApi?.setValue('logType', String(nextValue));
                setLogType(Number(nextValue));
                refresh();
              }}
              t={t}
            />

            {isAdminUser && (
              <BubbleFilter
                size='small'
                label='分组'
                options={groupFilterOptions}
                value={groupFilter}
                onChange={(nextValue) => {
                  refresh(nextValue || 'all');
                }}
                t={t}
              />
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

            <div className='flex-1 min-w-[180px] max-w-xs'>
              <Form.Input
                field='token_name'
                prefix={<IconSearch />}
                placeholder={t('令牌名称')}
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
