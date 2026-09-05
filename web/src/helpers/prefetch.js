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

const loaders = {
  '/console/dashboard': () => import('../pages/Dashboard'),
  '/console/models': () => import('../pages/Models'),
  '/console/channel': () => import('../pages/Channel'),
  '/console/token': () => import('../pages/Token'),
  '/console/log': () => import('../pages/Log'),
  '/console/user': () => import('../pages/User'),
  '/console/setting': () => import('../pages/Setting'),
  '/console/permission': () => import('../pages/Permission'),
  '/console/personal': () => import('../components/settings/PersonalSetting'),
  '/console/topup': () => import('../components/topup'),
};

const inflight = new Map();

export const prefetchConsolePage = (path) => {
  const loader = loaders[path];
  if (!loader) return;
  if (!inflight.has(path)) {
    inflight.set(path, loader().catch(() => {
      inflight.delete(path);
    }));
  }
};

export const prefetchConsolePages = () => {
  const paths = Object.keys(loaders);
  let i = 0;
  const next = () => {
    if (i >= paths.length) return;
    prefetchConsolePage(paths[i]);
    i += 1;
    if (typeof window !== 'undefined' && window.requestIdleCallback) {
      window.requestIdleCallback(next, { timeout: 500 });
    } else {
      setTimeout(next, 90);
    }
  };
  next();
};
