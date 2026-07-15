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
import { createPortal } from 'react-dom';
import { Tooltip } from '@douyinfe/semi-ui';
import { IconChevronDown } from '@douyinfe/semi-icons';

const STYLE_ID = 'dazeapi-bubble-filter-style';
const CLOSE_ANIMATION_DURATION = 480;
// After a bubble is opened by click, if no interaction touches it for this long,
// it auto-collapses. Multiple bubbles can stay open at once; each has its own
// idle timer.
const IDLE_TIMEOUT = 3000;

const ensureBubbleFilterStyles = () => {
  if (typeof document === 'undefined') {
    return;
  }

  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.innerHTML = `
    .bubble-filter360-root {
      position: relative;
      display: inline-flex;
      flex-shrink: 0;
    }

    .bubble-filter360-trigger {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 17px;
      min-height: 38px;
      border-radius: 999px;
      border: 1px solid var(--semi-color-border);
      background: var(--semi-color-bg-1);
      box-shadow: 0 2px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.12);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      color: var(--semi-color-text-0);
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
      transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.35s ease, border-color 0.35s ease, background 0.35s ease;
    }

    .bubble-filter360-root.small .bubble-filter360-trigger {
      gap: 6px;
      padding: 7px 14px;
      min-height: 32px;
    }

    .bubble-filter360-trigger:hover {
      border-color: var(--semi-color-primary);
      box-shadow: 0 4px 16px rgba(99,102,241,0.18), inset 0 1px 0 rgba(255,255,255,0.12);
      transform: translateY(-1px);
    }

    .bubble-filter360-trigger.active {
      background: var(--semi-color-primary-light-default);
      border-color: var(--semi-color-primary);
    }

    .bubble-filter360-trigger:focus-visible {
      outline: 2px solid rgba(99,102,241,0.45);
      outline-offset: 2px;
    }

    .bubble-filter360-label {
      font-size: 13px;
      font-weight: 500;
      color: var(--semi-color-text-2);
    }

    .bubble-filter360-root.small .bubble-filter360-label,
    .bubble-filter360-root.small .bubble-filter360-value {
      font-size: 12px;
    }

    .bubble-filter360-value {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: var(--semi-color-text-0);
    }

    .bubble-filter360-color-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      flex-shrink: 0;
      box-shadow: 0 0 10px rgba(99,102,241,0.28);
      background: var(--bubble-filter-color, #818cf8);
    }

    .bubble-filter360-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      border-radius: 999px;
      background: var(--semi-color-fill-0);
      border: 1px solid var(--semi-color-border);
      font-size: 11px;
      font-weight: 700;
      color: var(--semi-color-text-0);
    }

    .bubble-filter360-chevron {
      opacity: 0.72;
      transition: transform 0.3s ease;
    }

    .bubble-filter360-trigger.open .bubble-filter360-chevron {
      transform: rotate(180deg);
    }

    .bubble-filter360-cloud {
      position: fixed;
      width: 0;
      height: 0;
      transform: translateX(-50%);
      z-index: 1400;
      pointer-events: none;
    }

    .bubble-filter360-petal {
      position: absolute;
      top: 0;
      left: 0;
      opacity: 0;
      transform: translate(0, 0) scale(0);
      z-index: var(--bubble-filter-petal-z, 1);
      transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
    }

    .bubble-filter360-cloud.open .bubble-filter360-petal {
      opacity: 1;
      transform: translate(var(--bubble-filter-petal-x, 0px), var(--bubble-filter-petal-y, 0px)) scale(1);
    }

    .bubble-filter360-cloud:not(.open) .bubble-filter360-petal-button {
      pointer-events: none;
    }

    .bubble-filter360-petal-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: var(--bubble-filter-petal-min-w, 84px);
      padding: 8px 14px;
      border-radius: 999px;
      border: 1px solid var(--semi-color-border);
      background: var(--semi-color-bg-1);
      box-shadow: 0 4px 16px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.1);
      color: var(--semi-color-text-0);
      font-size: var(--bubble-filter-petal-font-size, 12px);
      font-weight: 600;
      line-height: 1.2;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      cursor: pointer;
      pointer-events: auto;
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease, border-color 0.25s ease, background 0.25s ease;
      animation: bubble-filter360-float 3s ease-in-out infinite;
    }

    .bubble-filter360-root.small .bubble-filter360-petal-button {
      min-width: var(--bubble-filter-petal-min-w, 72px);
      padding: 7px 12px;
      font-size: var(--bubble-filter-petal-font-size, 11px);
    }

    .bubble-filter360-petal-button.in-use {
      background: rgba(99, 102, 241, 0.10);
      border-color: rgba(99, 102, 241, 0.28);
    }

    .bubble-filter360-petal-button.idle {
      background: rgba(148, 156, 170, 0.08);
      border-color: rgba(148, 156, 170, 0.20);
      opacity: 0.88;
    }

    .bubble-filter360-petal-button.in-use:hover {
      background: rgba(99, 102, 241, 0.16);
      border-color: var(--semi-color-primary);
      box-shadow: 0 6px 20px rgba(99,102,241,0.2);
    }

    .bubble-filter360-petal-button.idle:hover {
      background: rgba(148, 156, 170, 0.14);
      border-color: rgba(148, 156, 170, 0.36);
      box-shadow: 0 6px 20px rgba(148,156,170,0.18);
    }

    .bubble-filter360-petal-button.selected {
      animation: none;
      color: #fff;
      border-color: var(--semi-color-primary);
      background: var(--semi-color-primary);
      box-shadow: 0 4px 16px rgba(99,102,241,0.3);
      opacity: 1;
    }

    .bubble-filter360-petal-label-text {
      white-space: nowrap;
    }

    .bubble-filter360-petal-label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }

    .bubble-filter360-petal-count {
      font-size: 10px;
      font-weight: 700;
      color: var(--semi-color-text-2);
      opacity: 0.76;
    }

    .bubble-filter360-petal-button.selected .bubble-filter360-petal-count {
      color: rgba(255,255,255,0.86);
      opacity: 1;
    }

    @keyframes bubble-filter360-float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-6px); }
    }

    @media (max-width: 768px) {
      .bubble-filter360-trigger {
        padding: 8px 14px;
      }

      .bubble-filter360-petal-button {
        min-width: 70px;
      }
    }
  `;
  document.head.appendChild(style);
};

const toKey = (value) => `${value}`;

const getRingPositions = (totalCount, innerRadius, outerRadius) => {
  if (totalCount <= 0) {
    return [];
  }

  if (totalCount <= 6) {
    const step = 360 / totalCount;
    const startAngle = -90;
    const positions = [];
    for (let i = 0; i < totalCount; i += 1) {
      const angleRad = ((startAngle + step * i) * Math.PI) / 180;
      const normalizedY = (Math.sin(angleRad) + 1) / 2;
      positions.push({
        x: Math.cos(angleRad) * innerRadius,
        y: Math.sin(angleRad) * innerRadius,
        z: Math.round(8 + normalizedY * 8),
        ring: 0,
      });
    }
    return positions;
  }

  if (totalCount <= 12) {
    const innerCount = 5;
    const outerCount = totalCount - innerCount;

    const innerStep = 360 / innerCount;
    const outerStep = 360 / outerCount;
    const startAngle = -90;

    const positions = [];

    for (let i = 0; i < innerCount; i += 1) {
      const angleRad = ((startAngle + innerStep * i) * Math.PI) / 180;
      const normalizedY = (Math.sin(angleRad) + 1) / 2;
      positions.push({
        x: Math.cos(angleRad) * innerRadius,
        y: Math.sin(angleRad) * innerRadius,
        z: Math.round(10 + normalizedY * 8),
        ring: 0,
      });
    }

    const outerStart = startAngle + outerStep / 2;
    for (let i = 0; i < outerCount; i += 1) {
      const angleRad = ((outerStart + outerStep * i) * Math.PI) / 180;
      const normalizedY = (Math.sin(angleRad) + 1) / 2;
      positions.push({
        x: Math.cos(angleRad) * outerRadius,
        y: Math.sin(angleRad) * outerRadius,
        z: Math.round(4 + normalizedY * 6),
        ring: 1,
      });
    }

    return positions;
  }

  // Beyond two rings: distribute across concentric rings so every option stays
  // visible. Ring 0 holds 6, ring k (k >= 1) holds 6 * (k + 1) items, and each
  // ring's radius grows by (outerRadius - innerRadius). Outer rings are rotated
  // by half a step for visual stagger against the ring inside them.
  const ringSpacing = outerRadius - innerRadius;
  const rings = [];
  let remaining = totalCount;
  let ringIndex = 0;
  while (remaining > 0) {
    const capacity = ringIndex === 0 ? 6 : 6 * (ringIndex + 1);
    const count = Math.min(remaining, capacity);
    rings.push({ ringIndex, count });
    remaining -= count;
    ringIndex += 1;
  }

  const positions = [];
  for (const { ringIndex, count } of rings) {
    const radius = innerRadius + ringIndex * ringSpacing;
    const step = 360 / count;
    const startAngle = -90;
    const offset = ringIndex % 2 === 0 ? 0 : step / 2;
    for (let i = 0; i < count; i += 1) {
      const angleRad = ((startAngle + offset + step * i) * Math.PI) / 180;
      const normalizedY = (Math.sin(angleRad) + 1) / 2;
      positions.push({
        x: Math.cos(angleRad) * radius,
        y: Math.sin(angleRad) * radius,
        z: Math.max(1, Math.round(10 - ringIndex * 2 + normalizedY * 6)),
        ring: ringIndex,
      });
    }
  }

  return positions;
};

const BubbleFilter = ({
  options = [],
  value,
  onChange,
  label,
  t,
  size = 'default',
}) => {
  const translate = t || ((text) => text);
  const rootRef = useRef(null);
  const cloudRef = useRef(null);
  const closeDelayRef = useRef(null);
  const closeAnimationRef = useRef(null);
  const idleTimerRef = useRef(null);
  const rafRef = useRef(null);
  const instanceRef = useRef({ closeImmediate: () => {} });

  const [isRendered, setIsRendered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  const isSmall = size === 'small';
  const innerRadius = isSmall ? 96 : 112;
  const outerRadius = isSmall ? 176 : 206;

  const normalizedOptions = useMemo(
    () =>
      options.map((option) => ({
        ...option,
        key: toKey(option.value),
        inUse: option.inUse !== undefined ? option.inUse : option.count !== undefined ? option.count > 0 : true,
      })),
    [options],
  );

  const selectedOption = useMemo(() => {
    const matched = normalizedOptions.find((option) => option.key === toKey(value));
    return matched || normalizedOptions[0] || null;
  }, [normalizedOptions, value]);

  const defaultOption = normalizedOptions[0] || null;
  const isFiltered =
    defaultOption && selectedOption
      ? defaultOption.key !== selectedOption.key
      : false;

  const sortedOptions = useMemo(() => {
    const withLengths = normalizedOptions.map((option) => {
      const text = String(translate(option.label) || '');
      return { ...option, _labelText: text, _labelLen: text.length };
    });
    return withLengths.sort((a, b) => a._labelLen - b._labelLen);
  }, [normalizedOptions, translate]);

  const petalPositions = useMemo(
    () => getRingPositions(sortedOptions.length, innerRadius, outerRadius),
    [sortedOptions.length, innerRadius, outerRadius],
  );

  const perPetalMetrics = useMemo(() => {
    return sortedOptions.map((option) => {
      const len = option._labelLen;
      let fontSize = isSmall ? 11 : 12;
      if (len > 6) fontSize = isSmall ? 10 : 11;
      if (len > 10) fontSize = isSmall ? 9 : 10;
      if (len > 14) fontSize = isSmall ? 8 : 9;
      if (len > 20) fontSize = isSmall ? 7 : 8;
      const charWidth = fontSize * 0.62;
      const padding = 42;
      const minW = Math.max(isSmall ? 64 : 76, Math.ceil(len * charWidth + padding));
      return { fontSize, minW };
    });
  }, [sortedOptions, isSmall]);

  const updatePosition = useCallback(() => {
    if (!rootRef.current) {
      return;
    }

    const rect = rootRef.current.getBoundingClientRect();
    setPosition({
      left: rect.left + rect.width / 2,
      top: rect.bottom + 10,
    });
  }, []);

  const clearCloseDelay = useCallback(() => {
    if (closeDelayRef.current) {
      clearTimeout(closeDelayRef.current);
      closeDelayRef.current = null;
    }
  }, []);

  const clearCloseAnimation = useCallback(() => {
    if (closeAnimationRef.current) {
      clearTimeout(closeAnimationRef.current);
      closeAnimationRef.current = null;
    }
  }, []);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const closeImmediate = useCallback(() => {
    clearCloseDelay();
    clearCloseAnimation();
    clearIdleTimer();
    setIsOpen(false);
    setIsRendered(false);
  }, [clearCloseAnimation, clearCloseDelay, clearIdleTimer]);

  const openFilter = useCallback(() => {
    clearCloseDelay();
    clearCloseAnimation();
    clearIdleTimer();
    updatePosition();
    setIsRendered(true);

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      setIsOpen(true);
    });
  }, [clearCloseAnimation, clearCloseDelay, clearIdleTimer, updatePosition]);

  const closeFilter = useCallback(() => {
    clearCloseDelay();
    clearIdleTimer();
    setIsOpen(false);
    clearCloseAnimation();
    closeAnimationRef.current = setTimeout(() => {
      setIsRendered(false);
    }, CLOSE_ANIMATION_DURATION);
  }, [clearCloseAnimation, clearCloseDelay, clearIdleTimer]);

  const resetIdleTimer = useCallback(() => {
    if (!isOpen) {
      return;
    }
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      closeFilter();
    }, IDLE_TIMEOUT);
  }, [clearIdleTimer, closeFilter, isOpen]);

  const handleTriggerClick = useCallback(() => {
    if (isOpen) {
      closeFilter();
      return;
    }

    openFilter();
  }, [closeFilter, isOpen, openFilter]);

  const handleSelect = useCallback(
    (nextValue) => {
      onChange(nextValue);
      closeFilter();
    },
    [closeFilter, onChange],
  );

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleTriggerClick();
      }

      if (event.key === 'Escape') {
        closeFilter();
      }
    },
    [closeFilter, handleTriggerClick],
  );

  useEffect(() => {
    ensureBubbleFilterStyles();
  }, []);

  useEffect(() => {
    instanceRef.current.closeImmediate = closeImmediate;
  }, [closeImmediate]);

  useEffect(() => {
    if (!isRendered) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (rootRef.current?.contains(event.target)) {
        return;
      }

      if (cloudRef.current?.contains(event.target)) {
        return;
      }

      closeFilter();
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        closeFilter();
      }
    };

    const handleViewportChange = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [closeFilter, isRendered, updatePosition]);

  useEffect(() => {
    return () => {
      clearCloseDelay();
      clearCloseAnimation();
      clearIdleTimer();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [clearCloseAnimation, clearCloseDelay, clearIdleTimer]);

  useEffect(() => {
    if (isOpen) {
      clearIdleTimer();
      idleTimerRef.current = setTimeout(() => {
        closeFilter();
      }, IDLE_TIMEOUT);
    }
    return () => clearIdleTimer();
  }, [clearIdleTimer, closeFilter, isOpen]);

  const translatedSelectedLabel = selectedOption
    ? translate(selectedOption.label)
    : '';

  return (
    <div
      ref={rootRef}
      className={`bubble-filter360-root ${isSmall ? 'small' : ''}`}
      onMouseEnter={resetIdleTimer}
      onMouseMove={resetIdleTimer}
    >
      <button
        type='button'
        className={`bubble-filter360-trigger ${isFiltered ? 'active' : ''} ${isOpen ? 'open' : ''}`}
        onClick={handleTriggerClick}
        onKeyDown={handleKeyDown}
        aria-haspopup='menu'
        aria-expanded={isOpen}
      >
        {label ? <span className='bubble-filter360-label'>{translate(label)}</span> : null}
        <span className='bubble-filter360-value'>
          {selectedOption?.icon ? selectedOption.icon : null}
          {!selectedOption?.icon && selectedOption?.color ? (
            <span
              className='bubble-filter360-color-dot'
              style={{ '--bubble-filter-color': selectedOption.color }}
            />
          ) : null}
          {translatedSelectedLabel}
        </span>
        {selectedOption?.count !== undefined ? (
          <span className='bubble-filter360-count'>{selectedOption.count}</span>
        ) : null}
        <IconChevronDown className='bubble-filter360-chevron' size={14} />
      </button>

      {isRendered && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={cloudRef}
              className={`bubble-filter360-cloud ${isOpen ? 'open' : ''} ${isSmall ? 'small' : ''}`}
              style={{
                left: `${position.left}px`,
                top: `${position.top}px`,
              }}
            >
              {sortedOptions.map((option, index) => {
                const petalPosition = petalPositions[index] || { x: 0, y: 0, z: 1, ring: 0 };
                const translatedLabel = option._labelText || translate(option.label);
                const isSelected = selectedOption?.key === option.key;
                const usageClass = option.inUse ? 'in-use' : 'idle';
                const metrics = perPetalMetrics[index] || { fontSize: 12, minW: 84 };

                return (
                  <div
                    key={option.key}
                    className='bubble-filter360-petal'
                    style={{
                      '--bubble-filter-petal-x': `${petalPosition.x}px`,
                      '--bubble-filter-petal-y': `${petalPosition.y}px`,
                      '--bubble-filter-petal-z': petalPosition.z,
                      transitionDelay: `${Math.min(index, 11) * 28}ms`,
                    }}
                  >
                    <Tooltip content={translatedLabel} position='top'>
                      <button
                        type='button'
                        className={`bubble-filter360-petal-button ${isSelected ? 'selected' : usageClass}`}
                        style={{
                          '--bubble-filter-petal-x': `${petalPosition.x}px`,
                          '--bubble-filter-petal-y': `${petalPosition.y}px`,
                          '--bubble-filter-petal-z': petalPosition.z,
                          '--bubble-filter-petal-font-size': `${metrics.fontSize}px`,
                          '--bubble-filter-petal-min-w': `${metrics.minW}px`,
                          transitionDelay: `${Math.min(index, 11) * 28}ms`,
                        }}
                        onClick={() => handleSelect(option.value)}
                        onMouseEnter={resetIdleTimer}
                        onMouseMove={resetIdleTimer}
                      >
                        <span className='bubble-filter360-petal-label'>
                          {option.icon ? option.icon : null}
                          {!option.icon && option.color ? (
                            <span
                              className='bubble-filter360-color-dot'
                              style={{ '--bubble-filter-color': option.color }}
                            />
                          ) : null}
                          <span className='bubble-filter360-petal-label-text'>{translatedLabel}</span>
                        </span>
                        {option.count !== undefined ? (
                          <span className='bubble-filter360-petal-count'>
                            {option.count}
                          </span>
                        ) : null}
                      </button>
                    </Tooltip>
                  </div>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
};

export default BubbleFilter;
