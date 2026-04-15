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

import { API, showError, showSuccess, showInfo } from '../../helpers';

export const useChannelCRUD = ({ t, channels, refresh }) => {
  const manageChannel = async (id, action, record, value) => {
    let data = { id };
    let res;
    switch (action) {
      case 'delete':
        res = await API.delete(`/api/channel/${id}/`);
        break;
      case 'enable':
        data.status = 1;
        res = await API.put('/api/channel/', data);
        break;
      case 'disable':
        data.status = 2;
        res = await API.put('/api/channel/', data);
        break;
      case 'priority':
        if (value === '') return;
        data.priority = parseInt(value);
        res = await API.put('/api/channel/', data);
        break;
      case 'weight':
        if (value === '') return;
        data.weight = parseInt(value);
        if (data.weight < 0) data.weight = 0;
        res = await API.put('/api/channel/', data);
        break;
      case 'enable_all':
        data.channel_info = record.channel_info;
        data.channel_info.multi_key_status_list = {};
        res = await API.put('/api/channel/', data);
        break;
    }
    const { success, message } = res.data;
    if (success) {
      showSuccess(t('操作成功完成！'));
      await refresh();
    } else {
      showError(message);
    }
  };

  const manageTag = async (tag, action) => {
    let res;
    switch (action) {
      case 'enable':
        res = await API.post('/api/channel/tag/enabled', { tag: tag });
        break;
      case 'disable':
        res = await API.post('/api/channel/tag/disabled', { tag: tag });
        break;
    }
    const { success, message } = res.data;
    if (success) {
      showSuccess(t('操作成功完成！'));
      await refresh();
    } else {
      showError(message);
    }
  };

  const copySelectedChannel = async (record) => {
    try {
      const res = await API.post(`/api/channel/copy/${record.id}`);
      if (res?.data?.success) {
        showSuccess(t('渠道复制成功'));
        await refresh();
      } else {
        showError(res?.data?.message || t('渠道复制失败'));
      }
    } catch (error) {
      showError(
        t('渠道复制失败: ') +
          (error?.response?.data?.message || error?.message || error),
      );
    }
  };

  const submitTagEdit = async (type, data) => {
    switch (type) {
      case 'priority':
        if (data.priority === undefined || data.priority === '') {
          showInfo('优先级必须是整数！');
          return;
        }
        data.priority = parseInt(data.priority);
        break;
      case 'weight':
        if (
          data.weight === undefined ||
          data.weight < 0 ||
          data.weight === ''
        ) {
          showInfo('权重必须是非负整数！');
          return;
        }
        data.weight = parseInt(data.weight);
        break;
    }

    try {
      const res = await API.put('/api/channel/tag', data);
      if (res?.data?.success) {
        showSuccess('更新成功！');
        await refresh();
      }
    } catch (error) {
      showError(error);
    }
  };

  const batchSetChannelTag = async (selectedChannels, batchSetTagValue) => {
    if (selectedChannels.length === 0) {
      showError(t('请先选择要设置标签的渠道！'));
      return;
    }
    if (batchSetTagValue === '') {
      showError(t('标签不能为空！'));
      return;
    }
    let ids = selectedChannels.map((channel) => channel.id);
    const res = await API.post('/api/channel/batch/tag', {
      ids: ids,
      tag: batchSetTagValue === '' ? null : batchSetTagValue,
    });
    if (res.data.success) {
      showSuccess(
        t('已为 ${count} 个渠道设置标签！').replace('${count}', res.data.data),
      );
      await refresh();
    } else {
      showError(res.data.message);
    }
  };

  const batchDeleteChannels = async (selectedChannels, activePage) => {
    if (selectedChannels.length === 0) {
      showError(t('请先选择要删除的通道！'));
      return;
    }
    let ids = [];
    selectedChannels.forEach((channel) => {
      ids.push(channel.id);
    });
    const res = await API.post(`/api/channel/batch`, { ids: ids });
    const { success, message, data } = res.data;
    if (success) {
      showSuccess(t('已删除 ${data} 个通道！').replace('${data}', data));
      await refresh();
    } else {
      showError(message);
    }
  };

  const deleteAllDisabledChannels = async () => {
    const res = await API.delete(`/api/channel/disabled`);
    const { success, message, data } = res.data;
    if (success) {
      showSuccess(
        t('已删除所有禁用渠道，共计 ${data} 个').replace('${data}', data),
      );
      await refresh();
    } else {
      showError(message);
    }
  };

  const updateAllChannelsBalance = async () => {
    const res = await API.get(`/api/channel/update_balance`);
    const { success, message } = res.data;
    if (success) {
      showInfo(t('已更新完毕所有已启用通道余额！'));
    } else {
      showError(message);
    }
  };

  const fixChannelsAbilities = async () => {
    const res = await API.post(`/api/channel/fix`);
    const { success, message, data } = res.data;
    if (success) {
      showSuccess(
        t('已修复 ${success} 个通道，失败 ${fails} 个通道。')
          .replace('${success}', data.success)
          .replace('${fails}', data.fails),
      );
      await refresh();
    } else {
      showError(message);
    }
  };

  return {
    manageChannel,
    manageTag,
    copySelectedChannel,
    submitTagEdit,
    batchSetChannelTag,
    batchDeleteChannels,
    deleteAllDisabledChannels,
    updateAllChannelsBalance,
    fixChannelsAbilities,
  };
};