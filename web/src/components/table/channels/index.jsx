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
import { Space } from '@douyinfe/semi-ui';
import CardPro from '../../common/ui/CardPro';
import BubbleFilter from '../../common/BubbleFilter';
import ChannelsTable from './ChannelsTable';
import ChannelsActions from './ChannelsActions';
import ChannelsFilters from './ChannelsFilters';
import { useChannelsData } from '../../../hooks/channels/useChannelsData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import BatchTagModal from './modals/BatchTagModal';
import ModelTestModal from './modals/ModelTestModal';
import ColumnSelectorModal from './modals/ColumnSelectorModal';
import EditChannelModal from './modals/EditChannelModal';
import EditTagModal from './modals/EditTagModal';
import MultiKeyManageModal from './modals/MultiKeyManageModal';
import ChannelUpstreamUpdateModal from './modals/ChannelUpstreamUpdateModal';
import { createCardProPagination } from '../../../helpers/utils';
import { CHANNEL_OPTIONS } from '../../../constants';
import { getChannelIcon } from '../../../helpers';

const ChannelsPage = () => {
  const channelsData = useChannelsData();
  const isMobile = useIsMobile();

  const channelTypeOptions = [
    {
      value: 'all',
      label: '全部',
      count: channelsData.channelTypeCounts.all || 0,
    },
    ...CHANNEL_OPTIONS.filter((option) =>
      channelsData.availableTypeKeys.includes(String(option.value)),
    ).map((option) => ({
      value: String(option.value),
      label: option.label,
      count: channelsData.channelTypeCounts[option.value] || 0,
      icon: getChannelIcon(option.value),
    })),
  ];

  return (
    <>
      {/* Modals */}
      <ColumnSelectorModal {...channelsData} />
      <EditTagModal
        visible={channelsData.showEditTag}
        tag={channelsData.editingTag}
        handleClose={() => channelsData.setShowEditTag(false)}
        refresh={channelsData.refresh}
      />
      <EditChannelModal
        refresh={channelsData.refresh}
        visible={channelsData.showEdit}
        handleClose={channelsData.closeEdit}
        editingChannel={channelsData.editingChannel}
      />
      <BatchTagModal {...channelsData} />
      <ModelTestModal {...channelsData} />
      <MultiKeyManageModal
        visible={channelsData.showMultiKeyManageModal}
        onCancel={() => channelsData.setShowMultiKeyManageModal(false)}
        channel={channelsData.currentMultiKeyChannel}
        onRefresh={channelsData.refresh}
        onOpenModelTest={(channel, keyIndex) => {
          if (!channel) return;
          const testChannel = { ...channel, _testKeyIndex: keyIndex };
          channelsData.setCurrentTestChannel(testChannel);
          channelsData.setShowModelTestModal(true);
        }}
      />
      <ChannelUpstreamUpdateModal
        visible={channelsData.showUpstreamUpdateModal}
        addModels={channelsData.upstreamUpdateAddModels}
        removeModels={channelsData.upstreamUpdateRemoveModels}
        preferredTab={channelsData.upstreamUpdatePreferredTab}
        confirmLoading={channelsData.upstreamApplyLoading}
        onConfirm={channelsData.applyUpstreamUpdates}
        onCancel={channelsData.closeUpstreamUpdateModal}
      />

      <div className='flex items-center justify-between mb-4'>
        <Space align='center'>
          <h2 className='text-lg font-semibold'>{channelsData.t('渠道管理')}</h2>
        </Space>
      </div>

      <CardPro
        type='type3'
        tabsArea={null}
        searchArea={
          <div className='flex flex-col gap-3 w-full'>
            <div className='flex items-center gap-3 w-full flex-wrap'>
              {!channelsData.enableTagMode ? (
                <BubbleFilter
                  size='small'
                  label='类别'
                  options={channelTypeOptions}
                  value={channelsData.activeTypeKey}
                  onChange={(nextValue) => {
                    channelsData.setActiveTypeKey(nextValue);
                    channelsData.setActivePage(1);
                    channelsData.loadChannels(
                      1,
                      channelsData.pageSize,
                      channelsData.enableTagMode,
                      nextValue,
                    );
                  }}
                  t={channelsData.t}
                />
              ) : null}
              <ChannelsActions {...channelsData} />
            </div>
            <div className='flex items-center gap-2 w-full flex-wrap'>
              <ChannelsFilters {...channelsData} />
            </div>
          </div>
        }
        paginationArea={createCardProPagination({
          currentPage: channelsData.activePage,
          pageSize: channelsData.pageSize,
          total: channelsData.channelCount,
          onPageChange: channelsData.handlePageChange,
          onPageSizeChange: channelsData.handlePageSizeChange,
          isMobile: isMobile,
          t: channelsData.t,
        })}
        t={channelsData.t}
      >
        <ChannelsTable {...channelsData} />
      </CardPro>
    </>
  );
};

export default ChannelsPage;
