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
import { Modal, Button } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { Calendar } from 'lucide-react';
import { MarkdownContent } from '../common/markdown/MarkdownRenderer';

const AnnouncementModal = ({ visible, content, version, onClose, isMobile }) => {
  const { t } = useTranslation();

  return (
    <Modal
      title={<span className='flex items-center gap-2'>{t('系统公告')}</span>}
      visible={visible}
      onCancel={onClose}
      footer={
        <div className='flex justify-end'>
          <Button type='primary' onClick={onClose}>
            {t('关闭')}
          </Button>
        </div>
      }
      size={isMobile ? 'full-width' : 'large'}
    >
      <div className='max-h-[55vh] overflow-y-auto pr-2'>
        {content ? (
          <div>
            {version && (
              <div className='flex items-center gap-1 text-xs text-gray-500 mb-2'>
                <Calendar size={12} />
                <span>{t('发布时间')}: {version}</span>
              </div>
            )}
            <MarkdownContent content={content} />
          </div>
        ) : (
          <div className='py-12 text-center text-gray-500'>{t('暂无公告')}</div>
        )}
      </div>
    </Modal>
  );
};

export default AnnouncementModal;
