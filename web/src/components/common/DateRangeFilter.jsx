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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DatePicker } from '@douyinfe/semi-ui';
import dayjs from 'dayjs';

const FORM_VALUE_FORMAT = 'YYYY-MM-DD HH:mm:ss';

const toDate = (v) => {
  if (v instanceof Date) return v;
  const parsed = dayjs(v);
  return parsed.isValid() ? parsed.toDate() : null;
};

const getDefaultRange = () => [
  dayjs().startOf('day').toDate(),
  dayjs().hour(23).minute(59).second(59).millisecond(0).toDate(),
];

const normalizeRange = (value) => {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const start = toDate(value[0]);
  const end = toDate(value[1]);
  if (!start || !end) return null;
  return [start, end];
};

const isClearedValue = (dates) => {
  if (dates == null) return true;
  if (!Array.isArray(dates)) return true;
  if (dates.length === 0) return true;
  return dates.every((d) => d == null || d === '');
};

/**
 * Date + time range. Type in the inputs, or pick from the calendar.
 * Clearing the picker restores today's 00:00:00 – 23:59:59 and refreshes.
 */
const DateRangeFilter = ({
  formApi,
  field = 'dateRange',
  value,
  onChange,
  t = (text) => text,
}) => {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const debounceTimerRef = useRef(null);
  const [range, setRange] = useState(() => normalizeRange(value) || getDefaultRange());

  useEffect(
    () => () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    },
    [],
  );

  const writeForm = useCallback(
    (dates) => {
      if (!formApi) return;
      formApi.setValue(
        field,
        dates ? dates.map((d) => dayjs(d).format(FORM_VALUE_FORMAT)) : null,
      );
    },
    [formApi, field],
  );

  useEffect(() => {
    writeForm(range);
    // Seed the form when Form API becomes available; later edits go through applyRange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formApi, writeForm]);

  const fireOnChange = useCallback((dates) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (typeof onChangeRef.current === 'function') onChangeRef.current(dates);
    }, 200);
  }, []);

  const applyRange = useCallback(
    (dates) => {
      setRange(dates);
      writeForm(dates);
      fireOnChange(dates);
    },
    [writeForm, fireOnChange],
  );

  const resetToDefault = useCallback(() => {
    applyRange(getDefaultRange());
  }, [applyRange]);

  const handleChange = (dates) => {
    if (isClearedValue(dates)) {
      resetToDefault();
      return;
    }
    if (!Array.isArray(dates) || dates.length !== 2 || !dates[0] || !dates[1]) {
      return;
    }
    applyRange([toDate(dates[0]), toDate(dates[1])]);
  };

  const defaultPickerValue = useMemo(() => getDefaultRange(), []);

  return (
    <DatePicker
      type='dateTimeRange'
      size='small'
      density='compact'
      value={range || undefined}
      onChange={handleChange}
      onConfirm={handleChange}
      onClear={resetToDefault}
      needConfirm
      format='yyyy-MM-dd HH:mm:ss'
      placeholder={[t('开始时间'), t('结束时间')]}
      defaultPickerValue={defaultPickerValue}
      showClear
      insetInput
      dropdownClassName='daze-datepicker'
      timePickerOpts={{ format: 'HH:mm:ss' }}
      style={{ width: 420, maxWidth: '100%' }}
    />
  );
};

export default DateRangeFilter;
