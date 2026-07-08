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

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ClawdChatPanel from './ClawdChatPanel';

const MASCOT_W = 56;
const MASCOT_H = 42;

const WALK_RANGE = 120;
const WALK_MS = 4000;
const PAUSE_MIN = 7000;
const PAUSE_MAX = 8000;

const IDLE_MARGIN = 14;

const getBasePoint = () => {
  const x = Math.max(IDLE_MARGIN, window.innerWidth - IDLE_MARGIN - MASCOT_W);
  const y = Math.max(0, window.innerHeight - IDLE_MARGIN - MASCOT_H);
  return { x, y };
};

const ClawdMascot = () => {
  const [pos, setPos] = useState(() => getBasePoint());
  const [chatOpen, setChatOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const facingLeftRef = useRef(false);
  const stepTimerRef = useRef(null);

  const clearStep = () => {
    if (stepTimerRef.current) {
      clearTimeout(stepTimerRef.current);
      stepTimerRef.current = null;
    }
  };

  const walkStep = useCallback(() => {
    const base = getBasePoint();
    const goLeft = !facingLeftRef.current;
    facingLeftRef.current = goLeft;
    const targetX = goLeft
      ? Math.max(IDLE_MARGIN, base.x - WALK_RANGE)
      : base.x;
    setPos({ x: targetX, y: base.y });
    const pause = PAUSE_MIN + Math.random() * (PAUSE_MAX - PAUSE_MIN);
    stepTimerRef.current = setTimeout(walkStep, pause + WALK_MS);
  }, []);

  const startIdle = useCallback(() => {
    clearStep();
    const base = getBasePoint();
    setPos(base);
    facingLeftRef.current = false;
    stepTimerRef.current = setTimeout(walkStep, WALK_MS + 800);
  }, [walkStep]);

  useEffect(() => {
    const initTimer = setTimeout(() => startIdle(), 600);
    return () => {
      clearTimeout(initTimer);
      clearStep();
    };
  }, [startIdle]);

  useEffect(() => {
    const onResize = () => startIdle();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [startIdle]);

  useEffect(() => () => clearStep(), []);

  useEffect(() => {
    if (chatOpen) {
      clearStep();
    } else {
      const t = setTimeout(() => startIdle(), 300);
      return () => clearTimeout(t);
    }
  }, [chatOpen, startIdle]);

  const handleClickMascot = useCallback((e) => {
    e.stopPropagation();
    setChatOpen((prev) => !prev);
  }, []);

  const showHint = hovered && !chatOpen;

  const containerStyle = {
    position: 'fixed',
    left: 0,
    top: 0,
    width: `${MASCOT_W}px`,
    height: `${MASCOT_H}px`,
    transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
    transition: `transform ${WALK_MS}ms ease-in-out`,
    zIndex: 9999,
    pointerEvents: 'auto',
    cursor: 'pointer',
    userSelect: 'none',
    filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.15))',
  };

  return createPortal(
    <>
      <div
        data-clawd-mascot
        style={containerStyle}
        onClick={handleClickMascot}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        role='button'
        tabIndex={-1}
        title='点击跟 Clawd 聊天'
      >
        {showHint && (
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 2px)',
              right: '0',
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(222,136,109,0.2)',
              borderRadius: '12px',
              padding: '6px 12px',
              fontSize: 12,
              color: 'var(--semi-color-text-1)',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              pointerEvents: 'none',
              animation: 'clawd-hint-in 0.15s ease-out',
            }}
          >
            你可以向我了解关于本站的所有信息
            <div
              style={{
                position: 'absolute',
                bottom: '-5px',
                right: '12px',
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '5px solid rgba(255,255,255,0.92)',
              }}
            />
          </div>
        )}
        <svg
          xmlns='http://www.w3.org/2000/svg'
          viewBox='-3 3 21 15'
          width={MASCOT_W}
          height={MASCOT_H}
          style={{ imageRendering: 'pixelated', display: 'block' }}
        >
          <ellipse
            cx='7.5'
            cy='15.5'
            rx='7'
            ry='1.2'
            fill='#000'
            opacity='0.35'
            style={{
              transformOrigin: '7.5px 15.5px',
              animation: 'clawd-shadow 2.6s ease-in-out infinite',
            }}
          />
          <g
            style={{
              transformOrigin: '7.5px 10px',
              animation: 'clawd-walk 1.4s ease-in-out infinite',
            }}
          >
            <rect x='2' y='6' width='11' height='7' rx='1' fill='#DE886D' />
            <rect x='3' y='5' width='9' height='2' fill='#DE886D' />
            <rect x='4' y='7' width='7' height='1' fill='#c97560' opacity='0.4' />
            <rect x='4' y='9' width='7' height='1' fill='#c97560' opacity='0.3' />
            <rect x='3' y='13' width='2' height='2' fill='#DE886D' />
            <rect x='5' y='13' width='2' height='2' fill='#DE886D' />
            <rect x='9' y='13' width='2' height='2' fill='#DE886D' />
            <rect x='11' y='13' width='2' height='2' fill='#DE886D' />
            <rect x='0' y='9' width='2' height='3' fill='#DE886D' />
            <rect x='13' y='9' width='2' height='3' fill='#DE886D' />
            <rect x='-1' y='8' width='2' height='2' fill='#DE886D' />
            <rect x='14' y='8' width='2' height='2' fill='#DE886D' />
          </g>
          <g
            style={{
              transformOrigin: '7.5px 9px',
              animation: 'clawd-blink 3.2s infinite ease-in-out',
            }}
          >
            <rect x='4' y='8' width='1' height='2' fill='#000' />
            <rect x='10' y='8' width='1' height='2' fill='#000' />
          </g>
          <rect x='6.4' y='10.8' width='2.2' height='1' rx='0.5' fill='#7a2230' />
        </svg>
        <style>{`
          @keyframes clawd-walk {
            0%, 100% { transform: translateY(0); }
            50%      { transform: translateY(-0.8px); }
          }
          @keyframes clawd-shadow {
            0%, 100% { transform: scaleX(1); opacity: 0.35; }
            50%      { transform: scaleX(0.97); opacity: 0.3; }
          }
          @keyframes clawd-blink {
            0%, 46%, 54%, 100% { transform: scaleY(1); }
            50%                { transform: scaleY(0.1); }
          }
          @keyframes clawd-hint-in {
            from { opacity: 0; transform: translateY(4px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
      {createPortal(
        <ClawdChatPanel visible={chatOpen} onClose={() => setChatOpen(false)} />,
        document.body,
      )}
    </>,
    document.body,
  );
};

export default ClawdMascot;
