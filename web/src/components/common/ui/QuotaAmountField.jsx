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
import { Form, Switch } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';

const QuotaAmountField = ({
  amountField = 'remain_quota',
  unlimited = true,
  onUnlimitedChange,
  label,
}) => {
  const { t } = useTranslation();
  const fieldLabel = label || t('额度');

  return (
    <Form.InputNumber
      field={amountField}
      label={fieldLabel}
      placeholder={unlimited ? t('无限') : '0.00'}
      disabled={unlimited}
      hideButtons
      precision={2}
      step={1}
      style={{ width: '100%' }}
      formatter={unlimited ? () => t('无限') : undefined}
      parser={unlimited ? () => 0 : undefined}
      rules={
        unlimited ? [] : [{ required: true, message: t('请输入额度') }]
      }
      suffix={
        <div
          className='quota-field-suffix'
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className='quota-field-suffix-label'>{t('无限')}</span>
          <Switch
            size='small'
            checked={unlimited}
            onChange={(checked) => onUnlimitedChange?.(checked)}
            aria-label={t('无限')}
          />
        </div>
      }
    />
  );
};

export default QuotaAmountField;
