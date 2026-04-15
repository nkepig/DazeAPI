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

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../common/useIsMobile';
import { useChannelSearch } from './useChannelSearch';
import { useChannelTest } from './useChannelTest';
import { useChannelCRUD } from './useChannelCRUD';
import { useChannelUpstreamUpdates } from './useChannelUpstreamUpdates';

export const useChannelsData = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const [showEdit, setShowEdit] = useState(false);
  const [editingChannel, setEditingChannel] = useState({ id: undefined });
  const [showEditTag, setShowEditTag] = useState(false);
  const [editingTag, setEditingTag] = useState('');
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [showBatchSetTag, setShowBatchSetTag] = useState(false);
  const [batchSetTagValue, setBatchSetTagValue] = useState('');
  const [allSelectingRef] = useState({ current: false });

  const searchState = useChannelSearch({ t });
  const testState = useChannelTest({
    t,
    channels: searchState.channels,
    updateChannelProperty: searchState.updateChannelProperty,
    refresh: searchState.refresh,
  });
  const crudState = useChannelCRUD({
    t,
    channels: searchState.channels,
    refresh: searchState.refresh,
  });
  const upstreamUpdates = useChannelUpstreamUpdates({ t, refresh: searchState.refresh });

  const closeEdit = () => {
    setShowEdit(false);
  };

  return {
    channels: searchState.channels,
    loading: searchState.loading,
    searching: searchState.searching,
    activePage: searchState.activePage,
    pageSize: searchState.pageSize,
    channelCount: searchState.channelCount,
    enableTagMode: searchState.enableTagMode,
    enableBatchDelete: searchState.enableBatchDelete,
    statusFilter: searchState.statusFilter,
    compactMode: searchState.compactMode,
    globalPassThroughEnabled: testState.globalPassThroughEnabled,

    showEdit,
    setShowEdit,
    editingChannel,
    setEditingChannel,
    showEditTag,
    setShowEditTag,
    editingTag,
    setEditingTag,
    selectedChannels,
    setSelectedChannels,
    showBatchSetTag,
    setShowBatchSetTag,
    batchSetTagValue,
    setBatchSetTagValue,

    visibleColumns: searchState.visibleColumns,
    showColumnSelector: searchState.showColumnSelector,
    setShowColumnSelector: searchState.setShowColumnSelector,
    COLUMN_KEYS: searchState.COLUMN_KEYS,

    activeTypeKey: searchState.activeTypeKey,
    setActiveTypeKey: searchState.setActiveTypeKey,
    typeCounts: searchState.typeCounts,
    channelTypeCounts: searchState.channelTypeCounts,
    availableTypeKeys: searchState.availableTypeKeys,

    showModelTestModal: testState.showModelTestModal,
    setShowModelTestModal: testState.setShowModelTestModal,
    currentTestChannel: testState.currentTestChannel,
    setCurrentTestChannel: testState.setCurrentTestChannel,
    modelSearchKeyword: testState.modelSearchKeyword,
    setModelSearchKeyword: testState.setModelSearchKeyword,
    modelTestResults: testState.modelTestResults,
    testingModels: testState.testingModels,
    selectedModelKeys: testState.selectedModelKeys,
    setSelectedModelKeys: testState.setSelectedModelKeys,
    isBatchTesting: testState.isBatchTesting,
    modelTablePage: testState.modelTablePage,
    setModelTablePage: testState.setModelTablePage,
    selectedEndpointType: testState.selectedEndpointType,
    setSelectedEndpointType: testState.setSelectedEndpointType,
    isStreamTest: testState.isStreamTest,
    setIsStreamTest: testState.setIsStreamTest,
    allSelectingRef,

    showMultiKeyManageModal: testState.showMultiKeyManageModal,
    setShowMultiKeyManageModal: testState.setShowMultiKeyManageModal,
    currentMultiKeyChannel: testState.currentMultiKeyChannel,
    setCurrentMultiKeyChannel: testState.setCurrentMultiKeyChannel,
    ...upstreamUpdates,

    formApi: searchState.formApi,
    setFormApi: searchState.setFormApi,
    formInitValues: searchState.formInitValues,

    t,
    isMobile,

    loadChannels: searchState.loadChannels,
    searchChannels: searchState.searchChannels,
    refresh: searchState.refresh,
    manageChannel: crudState.manageChannel,
    manageTag: crudState.manageTag,
    handlePageChange: searchState.handlePageChange,
    handlePageSizeChange: searchState.handlePageSizeChange,
    copySelectedChannel: crudState.copySelectedChannel,
    updateChannelProperty: searchState.updateChannelProperty,
    submitTagEdit: crudState.submitTagEdit,
    closeEdit,
    handleRow: searchState.handleRow,
    batchSetChannelTag: crudState.batchSetChannelTag,
    batchDeleteChannels: crudState.batchDeleteChannels,
    testAllChannels: testState.testAllChannels,
    deleteAllDisabledChannels: crudState.deleteAllDisabledChannels,
    updateAllChannelsBalance: crudState.updateAllChannelsBalance,
    updateChannelBalance: testState.updateChannelBalance,
    fixChannelsAbilities: crudState.fixChannelsAbilities,
    checkOllamaVersion: testState.checkOllamaVersion,
    testChannel: testState.testChannel,
    batchTestModels: testState.batchTestModels,
    handleCloseModal: testState.handleCloseModal,
    getFormValues: searchState.getFormValues,

    handleColumnVisibilityChange: searchState.handleColumnVisibilityChange,
    handleSelectAll: searchState.handleSelectAll,
    initDefaultColumns: searchState.initDefaultColumns,
    getDefaultColumnVisibility: searchState.getDefaultColumnVisibility,

    setEnableTagMode: searchState.setEnableTagMode,
    setEnableBatchDelete: searchState.setEnableBatchDelete,
    setStatusFilter: searchState.setStatusFilter,
    setCompactMode: searchState.setCompactMode,
    setActivePage: searchState.setActivePage,
  };
};