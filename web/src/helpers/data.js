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

import { invalidateQuotaCache } from './render';

export function setStatusData(data) {
  localStorage.setItem('status', JSON.stringify(data));
  localStorage.setItem('system_name', data.system_name);
  localStorage.setItem('logo', data.logo);
  localStorage.setItem('quota_per_unit', data.quota_per_unit);
  localStorage.setItem('display_in_currency', data.display_in_currency);
  localStorage.setItem('quota_display_type', data.quota_display_type || 'USD');
  localStorage.setItem(
    'default_collapse_sidebar',
    data.default_collapse_sidebar,
  );
  invalidateQuotaCache();

  // cleanup removed features
  localStorage.removeItem('footer_html');
  localStorage.removeItem('chats');
  localStorage.removeItem('chat_link');
  localStorage.removeItem('chat_link2');
}

export function setUserData(data) {
  localStorage.setItem('user', JSON.stringify(data));
  // 缓存细粒度管理员权限（5项）— 由后端 GetSelf 返回 admin_permissions
  // 缺省视为全部允许（root 或未配置的 admin）
  if (data && data.admin_permissions) {
    localStorage.setItem('admin_permissions', JSON.stringify(data.admin_permissions));
  } else {
    localStorage.removeItem('admin_permissions');
  }
}
