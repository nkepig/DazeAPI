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

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getLucideIcon } from '../../helpers/render';
import { ChevronLeft } from 'lucide-react';
import { useSidebarCollapsed } from '../../hooks/common/useSidebarCollapsed';
import { isAdmin, isRoot } from '../../helpers';
import SkeletonWrapper from './components/SkeletonWrapper';

import { Nav, Divider, Button } from '@douyinfe/semi-ui';

const routerMap = {
  home: '/',
  token: '/console/token',
  log: '/console/log',
  topup: '/console/topup',
  channel: '/console/channel',
  user: '/console/user',
  setting: '/console/setting',
};

const SiderBar = ({ onNavigate = () => {} }) => {
  const { t } = useTranslation();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  const [selectedKeys, setSelectedKeys] = useState(['home']);
  const location = useLocation();

  const consoleItems = useMemo(
    () => [
      { text: t('令牌管理'), itemKey: 'token' },
      { text: t('使用日志'), itemKey: 'log' },
      { text: t('钱包管理'), itemKey: 'topup' },
    ],
    [t],
  );

  const adminItems = useMemo(() => {
    const items = [
      {
        text: t('渠道管理'),
        itemKey: 'channel',
        className: isAdmin() ? '' : 'tableHiddle',
      },
      {
        text: t('用户管理'),
        itemKey: 'user',
        className: isAdmin() ? '' : 'tableHiddle',
      },
      {
        text: t('系统设置'),
        itemKey: 'setting',
        className: isRoot() ? '' : 'tableHiddle',
      },
    ];
    return items;
  }, [isAdmin(), isRoot(), t]);

  useEffect(() => {
    const currentPath = location.pathname;
    const matchingKey = Object.keys(routerMap).find(
      (key) => routerMap[key] === currentPath,
    );
    if (matchingKey) {
      setSelectedKeys([matchingKey]);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (collapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  }, [collapsed]);

  const SELECTED_COLOR = 'var(--semi-color-primary)';

  const renderNavItem = (item) => {
    if (item.className === 'tableHiddle') return null;
    const isSelected = selectedKeys.includes(item.itemKey);
    const textColor = isSelected ? SELECTED_COLOR : 'inherit';
    return (
      <Nav.Item
        key={item.itemKey}
        itemKey={item.itemKey}
        text={
          <span
            className='truncate font-medium text-sm'
            style={{ color: textColor }}
          >
            {item.text}
          </span>
        }
        icon={
          <div className='sidebar-icon-container flex-shrink-0'>
            {getLucideIcon(item.itemKey, isSelected)}
          </div>
        }
        className={item.className}
      />
    );
  };

  return (
    <div
      className='sidebar-container'
      style={{ width: 'var(--sidebar-current-width)' }}
    >
      <SkeletonWrapper
        loading={false}
        type='sidebar'
        className=''
        collapsed={collapsed}
        showAdmin={isAdmin()}
      >
        <Nav
          className='sidebar-nav'
          defaultIsCollapsed={collapsed}
          isCollapsed={collapsed}
          onCollapseChange={toggleCollapsed}
          selectedKeys={selectedKeys}
          itemStyle='sidebar-nav-item'
          hoverStyle='sidebar-nav-item:hover'
          selectedStyle='sidebar-nav-item-selected'
          renderWrapper={({ itemElement, props }) => {
            const to = routerMap[props.itemKey];
            if (!to) return itemElement;
            return (
              <Link
                style={{ textDecoration: 'none' }}
                to={to}
                onClick={onNavigate}
              >
                {itemElement}
              </Link>
            );
          }}
          onSelect={(key) => setSelectedKeys([key.itemKey])}
        >
          <div>
            {!collapsed && (
              <div className='sidebar-group-label'>{t('控制台')}</div>
            )}
            {consoleItems.map((item) => renderNavItem(item))}
          </div>

          {isAdmin() && (
            <>
              <Divider className='sidebar-divider' />
              <div>
                {!collapsed && (
                  <div className='sidebar-group-label'>{t('管理员')}</div>
                )}
                {adminItems.map((item) => renderNavItem(item))}
              </div>
            </>
          )}
        </Nav>
      </SkeletonWrapper>

      <div className='sidebar-collapse-button'>
        <Button
          theme='outline'
          type='tertiary'
          size='small'
          icon={
            <ChevronLeft
              size={16}
              strokeWidth={2.5}
              color='var(--semi-color-text-2)'
              style={{
                transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          }
          onClick={toggleCollapsed}
          icononly={collapsed}
          style={
            collapsed
              ? { width: 36, height: 24, padding: 0 }
              : { padding: '4px 12px', width: '100%' }
          }
        >
          {!collapsed ? t('收起侧边栏') : null}
        </Button>
      </div>
    </div>
  );
};

export default SiderBar;
