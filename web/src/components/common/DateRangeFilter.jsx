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

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

const FORM_VALUE_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const ITEM_H = 36;
const WHEEL_H = ITEM_H * 5;
const TAP_SLOP = 16;
const IDLE_MS = 1200;
const DRAG_RATIO = 2.2;
const WHEEL_THRESHOLD = 72;

const MONTH_ITEMS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}月`,
}));

const DAY_ITEMS = Array.from({ length: 31 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}日`,
}));

const toDate = (v) => {
  if (v instanceof Date) return v;
  const parsed = dayjs(v);
  return parsed.isValid() ? parsed.toDate() : null;
};

const getDefaultRange = () => [
  dayjs().startOf('day').toDate(),
  dayjs().hour(23).minute(59).second(0).millisecond(0).toDate(),
];

const clampDate = (d) => {
  const max = dayjs().hour(23).minute(59).second(0).millisecond(0);
  const min = dayjs().subtract(10, 'year').startOf('day');
  if (d.isAfter(max)) return max;
  if (d.isBefore(min)) return min;
  return d;
};

const composeDate = (base, patch) => {
  let d = dayjs(base);
  if (patch.month != null) {
    d = d.date(1).month(patch.month - 1);
  }
  const dim = d.daysInMonth();
  const day = Math.min(patch.day != null ? patch.day : dayjs(base).date(), dim);
  d = d.date(day);
  if (patch.hour != null) d = d.hour(patch.hour);
  if (patch.minute != null) d = d.minute(patch.minute);
  d = d.second(0).millisecond(0);
  if (d.startOf('day').isAfter(dayjs().startOf('day'))) {
    d = d.subtract(1, 'year');
  }
  return clampDate(d);
};

const normalizeRange = (value) => {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const start = toDate(value[0]);
  const end = toDate(value[1]);
  if (!start || !end) return null;
  return start.getTime() <= end.getTime() ? [start, end] : [end, start];
};

const formatDay = (date, lang) => {
  const d = dayjs(date);
  if ((lang || '').startsWith('zh') || (lang || '').startsWith('ja')) {
    return d.format('M月D日');
  }
  return d.format('MMM D');
};

const formatTime = (date) => dayjs(date).format('HH:mm');

const rangeKey = (dates) => `${dates[0].getTime()}-${dates[1].getTime()}`;

const pad2 = (n) => String(n).padStart(2, '0');

const HOUR_ITEMS = Array.from({ length: 24 }, (_, h) => ({
  value: h,
  label: `${pad2(h)}时`,
}));

const MINUTE_ITEMS = Array.from({ length: 60 }, (_, m) => ({
  value: m,
  label: `${pad2(m)}分`,
}));

function WheelColumn({ items, selectedValue, onSelect, onInteract, ariaLabel }) {
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.value === selectedValue),
  );
  const [drag, setDrag] = useState(0);
  const dragRef = useRef(0);
  const startYRef = useRef(null);
  const activeRef = useRef(false);
  const movedRef = useRef(false);
  const rootRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onInteractRef = useRef(onInteract);
  onInteractRef.current = onInteract;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const indexRef = useRef(selectedIndex);
  indexRef.current = selectedIndex;

  const wheelAccRef = useRef(0);
  const wheelResetRef = useRef(null);

  const bump = () => {
    if (typeof onInteractRef.current === 'function') onInteractRef.current();
  };

  const snapTo = useCallback((nextIndex) => {
    const list = itemsRef.current;
    const clamped = Math.max(0, Math.min(list.length - 1, nextIndex));
    dragRef.current = 0;
    setDrag(0);
    const item = list[clamped];
    if (item) onSelectRef.current(item.value);
    bump();
  }, []);

  const onPointerDown = (e) => {
    startYRef.current = e.clientY;
    dragRef.current = 0;
    movedRef.current = false;
    activeRef.current = true;
    bump();
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!activeRef.current || startYRef.current == null) return;
    const dy = e.clientY - startYRef.current;
    if (Math.abs(dy) > TAP_SLOP) movedRef.current = true;
    const visual = dy / DRAG_RATIO;
    dragRef.current = visual;
    setDrag(visual);
    bump();
  };

  const onPointerUp = (e) => {
    if (!activeRef.current) return;
    activeRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    const visual = dragRef.current;
    startYRef.current = null;
    if (!movedRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const slot = Math.round((y - WHEEL_H / 2) / ITEM_H);
      snapTo(indexRef.current + slot);
      return;
    }
    snapTo(indexRef.current - Math.round(visual / ITEM_H));
  };

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const onWheel = (ev) => {
      ev.preventDefault();
      const dy = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaY;
      wheelAccRef.current += dy;
      if (wheelResetRef.current) window.clearTimeout(wheelResetRef.current);
      wheelResetRef.current = window.setTimeout(() => {
        wheelAccRef.current = 0;
      }, 180);
      while (wheelAccRef.current >= WHEEL_THRESHOLD) {
        wheelAccRef.current -= WHEEL_THRESHOLD;
        snapTo(indexRef.current + 1);
      }
      while (wheelAccRef.current <= -WHEEL_THRESHOLD) {
        wheelAccRef.current += WHEEL_THRESHOLD;
        snapTo(indexRef.current - 1);
      }
      bump();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (wheelResetRef.current) window.clearTimeout(wheelResetRef.current);
    };
  }, [snapTo]);

  const pad = (WHEEL_H - ITEM_H) / 2;
  const y = pad - selectedIndex * ITEM_H + drag;

  return (
    <div
      ref={rootRef}
      className='drf-wheel'
      role='listbox'
      aria-label={ariaLabel}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          snapTo(selectedIndex - 1);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          snapTo(selectedIndex + 1);
        }
      }}
    >
      <div className='drf-wheel-highlight' aria-hidden='true' />
      <div className='drf-wheel-list' style={{ transform: `translate3d(0, ${y}px, 0)` }}>
        {items.map((item, i) => {
          const dist = Math.abs(i - selectedIndex - drag / ITEM_H);
          const dim = dist >= 1.6;
          return (
            <div
              key={`${item.value}`}
              className={`drf-wheel-item${i === selectedIndex && Math.abs(drag) < ITEM_H / 2 ? ' is-active' : ''}${dim ? ' is-dim' : ''}`}
              role='option'
              aria-selected={i === selectedIndex}
            >
              {item.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PickerPopover({ anchorEl, onClose, children }) {
  const popRef = useRef(null);
  const [pos, setPos] = useState(null);

  const place = useCallback(() => {
    if (!anchorEl || !popRef.current) return;
    const rect = anchorEl.getBoundingClientRect();
    const pop = popRef.current.getBoundingClientRect();
    let top = rect.bottom + 8;
    let left = rect.left + rect.width / 2 - pop.width / 2;
    if (top + pop.height > window.innerHeight - 10) {
      top = Math.max(8, rect.top - pop.height - 8);
    }
    if (left < 8) left = 8;
    if (left + pop.width > window.innerWidth - 8) {
      left = window.innerWidth - pop.width - 8;
    }
    setPos((prev) => {
      if (prev && prev.top === top && prev.left === left) return prev;
      return { top, left };
    });
  }, [anchorEl]);

  useLayoutEffect(() => {
    place();
  }, [place]);

  useEffect(() => {
    const onWin = () => place();
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [place]);

  useEffect(() => {
    const onDown = (e) => {
      if (e.target.closest('.drf-pop, .drf-chip')) return;
      onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchorEl, onClose]);

  return createPortal(
    <div
      ref={popRef}
      className='drf-pop'
      style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }}
    >
      {children}
    </div>,
    document.body,
  );
}

const DateRangeFilter = ({
  formApi,
  field = 'dateRange',
  value,
  onChange,
  t = (text) => text,
}) => {
  const { i18n } = useTranslation();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const debounceTimerRef = useRef(null);
  const [range, setRange] = useState(() => normalizeRange(value) || getDefaultRange());
  const latestRangeRef = useRef(range);
  latestRangeRef.current = range;
  const lastNotifiedRef = useRef(rangeKey(range));
  const [open, setOpen] = useState(null);
  const startDateRef = useRef(null);
  const startTimeRef = useRef(null);
  const endDateRef = useRef(null);
  const endTimeRef = useRef(null);

  const lang = i18n.language || 'zh-CN';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formApi, writeForm]);

  const notifyIfChanged = useCallback((dates) => {
    const key = rangeKey(dates);
    if (lastNotifiedRef.current === key) return;
    lastNotifiedRef.current = key;
    if (typeof onChangeRef.current === 'function') onChangeRef.current(dates);
  }, []);

  const bumpIdle = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      notifyIfChanged(latestRangeRef.current);
    }, IDLE_MS);
  }, [notifyIfChanged]);

  const flushOnChange = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    notifyIfChanged(latestRangeRef.current);
  }, [notifyIfChanged]);

  const applyRange = useCallback(
    (dates) => {
      latestRangeRef.current = dates;
      setRange(dates);
      writeForm(dates);
      bumpIdle();
    },
    [writeForm, bumpIdle],
  );

  const patch = useCallback(
    (which, next) => {
      const idx = which === 'start' ? 0 : 1;
      const dates = [...latestRangeRef.current];
      dates[idx] = next.second(0).millisecond(0).toDate();
      if (dates[0].getTime() <= dates[1].getTime()) {
        applyRange(dates);
        return;
      }
      if (which === 'start') applyRange([dates[0], dates[0]]);
      else applyRange([dates[1], dates[1]]);
    },
    [applyRange],
  );

  const closePop = useCallback(() => {
    setOpen(null);
    flushOnChange();
  }, [flushOnChange]);

  const resetToDefault = useCallback(() => {
    const next = getDefaultRange();
    latestRangeRef.current = next;
    setRange(next);
    writeForm(next);
    setOpen(null);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    notifyIfChanged(next);
  }, [writeForm, notifyIfChanged]);

  const current = (which) => dayjs(latestRangeRef.current[which === 'start' ? 0 : 1]);
  const datePart = (which) => current(which);

  const setMonth = (which, month) => {
    patch(which, composeDate(current(which), { month }));
  };

  const setDay = (which, day) => {
    patch(which, composeDate(current(which), { day }));
  };

  const setHour = (which, hour) => {
    patch(which, composeDate(current(which), { hour }));
  };

  const setMinute = (which, minute) => {
    patch(which, composeDate(current(which), { minute }));
  };

  const openKey = open;
  const anchor =
    openKey === 'start-date'
      ? startDateRef.current
      : openKey === 'start-time'
        ? startTimeRef.current
        : openKey === 'end-date'
          ? endDateRef.current
          : openKey === 'end-time'
            ? endTimeRef.current
            : null;

  const popWhich = openKey?.startsWith('end') ? 'end' : 'start';
  const popIsDate = openKey?.endsWith('date');

  const toggle = (key) => {
    setOpen((prev) => {
      if (prev === key) {
        flushOnChange();
        return null;
      }
      bumpIdle();
      return key;
    });
  };

  return (
    <div className='drf-pickers'>
      <div className='drf-pair'>
        <button
          ref={startDateRef}
          type='button'
          className={`drf-chip${openKey === 'start-date' ? ' is-open' : ''}`}
          aria-label={t('开始时间')}
          aria-expanded={openKey === 'start-date'}
          onClick={() => toggle('start-date')}
        >
          {formatDay(range[0], lang)}
        </button>
        <button
          ref={startTimeRef}
          type='button'
          className={`drf-chip${openKey === 'start-time' ? ' is-open' : ''}`}
          aria-label={t('开始时间')}
          aria-expanded={openKey === 'start-time'}
          onClick={() => toggle('start-time')}
        >
          {formatTime(range[0])}
        </button>
      </div>
      <span className='drf-dash' aria-hidden='true'>–</span>
      <div className='drf-pair'>
        <button
          ref={endDateRef}
          type='button'
          className={`drf-chip${openKey === 'end-date' ? ' is-open' : ''}`}
          aria-label={t('结束时间')}
          aria-expanded={openKey === 'end-date'}
          onClick={() => toggle('end-date')}
        >
          {formatDay(range[1], lang)}
        </button>
        <button
          ref={endTimeRef}
          type='button'
          className={`drf-chip${openKey === 'end-time' ? ' is-open' : ''}`}
          aria-label={t('结束时间')}
          aria-expanded={openKey === 'end-time'}
          onClick={() => toggle('end-time')}
        >
          {formatTime(range[1])}
        </button>
      </div>
      <button type='button' className='drf-today' onClick={resetToDefault}>
        {t('今天')}
      </button>

      {openKey && anchor && (
        <PickerPopover anchorEl={anchor} onClose={closePop}>
          <div className='drf-pop-cols'>
            {popIsDate ? (
              <>
                <WheelColumn
                  items={MONTH_ITEMS}
                  selectedValue={datePart(popWhich).month() + 1}
                  onSelect={(month) => setMonth(popWhich, month)}
                  onInteract={bumpIdle}
                  ariaLabel={t('月')}
                />
                <WheelColumn
                  items={DAY_ITEMS}
                  selectedValue={datePart(popWhich).date()}
                  onSelect={(day) => setDay(popWhich, day)}
                  onInteract={bumpIdle}
                  ariaLabel={t('日')}
                />
              </>
            ) : (
              <>
                <WheelColumn
                  items={HOUR_ITEMS}
                  selectedValue={datePart(popWhich).hour()}
                  onSelect={(hour) => setHour(popWhich, hour)}
                  onInteract={bumpIdle}
                  ariaLabel={t('时')}
                />
                <WheelColumn
                  items={MINUTE_ITEMS}
                  selectedValue={datePart(popWhich).minute()}
                  onSelect={(minute) => setMinute(popWhich, minute)}
                  onInteract={bumpIdle}
                  ariaLabel={t('分')}
                />
              </>
            )}
          </div>
        </PickerPopover>
      )}
    </div>
  );
};

export default DateRangeFilter;
