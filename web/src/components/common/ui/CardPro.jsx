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

import React, { useState } from 'react';
import { Card, Button } from '@douyinfe/semi-ui';
import PropTypes from 'prop-types';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { IconChevronDown, IconChevronUp } from '@douyinfe/semi-icons';

const CardPro = ({
  type = 'type1',
  className = '',
  children,
  statsArea,
  descriptionArea,
  tabsArea,
  actionsArea,
  searchArea,
  paginationArea,
  shadows = '',
  bordered = true,
  style,
  t = (key) => key,
  ...props
}) => {
  const isMobile = useIsMobile();
  const [showMobileActions, setShowMobileActions] = useState(false);

  const hasMobileHideableContent = actionsArea || searchArea;

  const renderHeader = () => {
    const hasContent =
      statsArea || descriptionArea || tabsArea || actionsArea || searchArea;
    if (!hasContent) return null;

    const sections = [];

    if (type === 'type2' && statsArea) sections.push(statsArea);
    if ((type === 'type1' || type === 'type3') && descriptionArea) sections.push(descriptionArea);
    if (type === 'type3' && tabsArea) sections.push(tabsArea);

    return (
      <div className='flex flex-col w-full gap-4'>
        {sections.map((section, idx) => (
          <div key={idx} className='w-full'>{section}</div>
        ))}

        {isMobile && hasMobileHideableContent && (
          <div className='w-full'>
            <button
              onClick={() => setShowMobileActions(!showMobileActions)}
              className='w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-[#999] bg-transparent border border-[#f0f0f0] rounded-lg cursor-pointer hover:bg-[#fafafa] transition-colors'
            >
              {showMobileActions ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
              {showMobileActions ? t('收起') : t('筛选')}
            </button>
          </div>
        )}

        <div className={`flex flex-col gap-3 ${isMobile && !showMobileActions ? 'hidden' : ''}`}>
          {(type === 'type1' || type === 'type3') && actionsArea && (
            <div className='w-full'>{actionsArea}</div>
          )}
          {searchArea && <div className='w-full'>{searchArea}</div>}
        </div>
      </div>
    );
  };

  const headerContent = renderHeader();

  const renderFooter = () => {
    if (!paginationArea) return null;
    return (
      <div
        className={`flex w-full pt-4 ${isMobile ? 'justify-center' : 'justify-between items-center'}`}
        style={{ borderTop: '1px solid #f0f0f0' }}
      >
        {paginationArea}
      </div>
    );
  };

  const footerContent = renderFooter();

  return (
    <Card
      className={`table-scroll-card ${className}`}
      title={headerContent}
      footer={footerContent}
      shadows={shadows}
      bordered={bordered}
      style={style}
      {...props}
    >
      {children}
    </Card>
  );
};

CardPro.propTypes = {
  type: PropTypes.oneOf(['type1', 'type2', 'type3']),
  className: PropTypes.string,
  style: PropTypes.object,
  shadows: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
  bordered: PropTypes.bool,
  statsArea: PropTypes.node,
  descriptionArea: PropTypes.node,
  tabsArea: PropTypes.node,
  actionsArea: PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.arrayOf(PropTypes.node),
  ]),
  searchArea: PropTypes.node,
  paginationArea: PropTypes.node,
  children: PropTypes.node,
  t: PropTypes.func,
};

export default CardPro;
