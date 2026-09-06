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

const PRESS_SEL = [
  'button:not(:disabled)',
  'a[href]',
  '[role="button"]',
  '.semi-button:not(:disabled):not(.semi-button-disabled)',
  '.semi-page-item',
  '.semi-page-prev',
  '.semi-page-next',
  '.semi-page-rest',
  '.semi-tag',
  '.daze-nav a',
  '.daze-nav button',
  '.daze-segment button',
  '.daze-menu a',
  '.daze-menu button',
  '.dash-qs-tabs button',
  '.drf-chip',
  '.drf-today',
  '.bubble-filter360-trigger',
  '.model-card',
].join(',');

const SKIP_SEL =
  'input, textarea, select, .semi-input, .semi-input-wrapper, .drf-wheel, [contenteditable="true"]';

export function installPressFeedback() {
  if (typeof document === 'undefined') return;
  if (window.__dazePressAbort) {
    window.__dazePressAbort.abort();
  }
  const ac = new AbortController();
  window.__dazePressAbort = ac;

  const clear = (el) => {
    // Drop the class on the same frame as pointerup so CSS press-out can ease
    // back. Holding the pressed state after a fast response makes the UI blink.
    el.classList.remove('is-pressed');
  };

  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button != null && e.button !== 0) return;
      if (e.target.closest(SKIP_SEL)) return;
      const el = e.target.closest(PRESS_SEL);
      if (!el) return;
      el.classList.add('is-pressed');
      const onUp = () => clear(el);
      document.addEventListener('pointerup', onUp, { once: true, signal: ac.signal });
      document.addEventListener('pointercancel', onUp, { once: true, signal: ac.signal });
    },
    { passive: true, signal: ac.signal },
  );
}
