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

import React, { useState, useEffect } from 'react';
import { Button, Space, TextArea } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { Megaphone, Save, Bell, Calendar } from 'lucide-react';
import { API, showError, showSuccess } from '../../helpers';
import { MarkdownContent } from '../common/markdown/MarkdownRenderer';

const AnnouncementSetting = () => {
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const [version, setVersion] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchAnnouncement = async () => {
    try {
      const res = await API.get('/api/announcement');
      if (res.data?.success) {
        setContent(res.data.data?.content || '');
        setVersion(res.data.data?.version || '');
      }
    } catch {
    }
  };

  useEffect(() => {
    fetchAnnouncement();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await API.put('/api/announcement', { content, notify: false });
      if (res.data?.success) {
        showSuccess(t('保存成功'));
        await fetchAnnouncement();
      } else {
        showError(res.data?.message || t('保存失败'));
      }
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndNotify = async () => {
    setLoading(true);
    try {
      const res = await API.put('/api/announcement', { content, notify: true });
      if (res.data?.success) {
        showSuccess(t('公告已保存并通知用户'));
        await fetchAnnouncement();
      } else {
        showError(res.data?.message || t('保存失败'));
      }
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='space-y-4'>
      <TextArea
        value={content}
        onChange={(value) => setContent(value)}
        rows={10}
        maxCount={5000}
        placeholder={t('请输入公告内容（支持 Markdown）')}
        style={{ width: '100%' }}
      />
      <div className='flex items-center justify-between'>
        <Space>
          <Button icon={<Save size={14} />} theme='light' type='tertiary' onClick={handleSave} loading={loading}>
            {t('保存')}
          </Button>
          <Button icon={<Bell size={14} />} theme='solid' onClick={handleSaveAndNotify} loading={loading}>
            {t('保存且通知')}
          </Button>
        </Space>
      </div>
      <div className='mt-4'>
        <div className='text-sm font-medium mb-2'>{t('预览')}</div>
        <div className='border rounded-xl p-4 bg-white'>
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
            <div className='text-gray-500 text-center py-8'>{t('暂无公告')}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnnouncementSetting;
