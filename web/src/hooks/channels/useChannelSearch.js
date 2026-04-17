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

import { useState, useEffect, useRef, useMemo } from 'react';
import { API, showError, loadChannelModels } from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';
import { useTableCompactMode } from '../common/useTableCompactMode';
import { parseUpstreamUpdateMeta } from './upstreamUpdateUtils';

export const useChannelSearch = ({ t }) => {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [channelCount, setChannelCount] = useState(0);
  const [enableTagMode, setEnableTagMode] = useState(false);
  const [enableBatchDelete, setEnableBatchDelete] = useState(false);
  const [statusFilter, setStatusFilter] = useState(
    localStorage.getItem('channel-status-filter') || 'all',
  );
  const [groupFilter, setGroupFilter] = useState(
    localStorage.getItem('channel-group-filter') || 'all',
  );
  const [groupOptions, setGroupOptions] = useState([]);
  const [activeTypeKey, setActiveTypeKey] = useState('all');
  const [typeCounts, setTypeCounts] = useState({});
  const [compactMode, setCompactMode] = useTableCompactMode('channels');
  const [visibleColumns, setVisibleColumns] = useState({});
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [formApi, setFormApi] = useState(null);

  const requestCounter = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await API.get('/api/group/');
        if (res.data?.success) {
          setGroupOptions(res.data.data || []);
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const formInitValues = {
    searchKeyword: '',
    searchModel: '',
  };

  const COLUMN_KEYS = {
    ID: 'id',
    NAME: 'name',
    TYPE: 'type',
    STATUS: 'status',
    RESPONSE_TIME: 'response_time',
    BALANCE: 'balance',
    PRIORITY: 'priority',
    WEIGHT: 'weight',
    GROUPS: 'groups',
    OPERATE: 'operate',
  };

  const setChannelFormat = (channels, enableTagMode) => {
    let channelDates = [];
    let channelTags = {};

    for (let i = 0; i < channels.length; i++) {
      channels[i].upstreamUpdateMeta = parseUpstreamUpdateMeta(
        channels[i].settings,
      );
      channels[i].key = '' + channels[i].id;
      if (!enableTagMode) {
        channelDates.push(channels[i]);
      } else {
        let tag = channels[i].tag ? channels[i].tag : '';
        let tagIndex = channelTags[tag];
        let tagChannelDates = undefined;

        if (tagIndex === undefined) {
          channelTags[tag] = 1;
          tagChannelDates = {
            key: tag,
            id: tag,
            tag: tag,
            name: '标签：' + tag,
            group: '',
            used_quota: 0,
            response_time: 0,
            priority: -1,
            weight: -1,
          };
          tagChannelDates.children = [];
          channelDates.push(tagChannelDates);
        } else {
          tagChannelDates = channelDates.find((item) => item.key === tag);
        }

        if (tagChannelDates.priority === -1) {
          tagChannelDates.priority = channels[i].priority;
        } else {
          if (tagChannelDates.priority !== channels[i].priority) {
            tagChannelDates.priority = '';
          }
        }

        if (tagChannelDates.weight === -1) {
          tagChannelDates.weight = channels[i].weight;
        } else {
          if (tagChannelDates.weight !== channels[i].weight) {
            tagChannelDates.weight = '';
          }
        }

        if (tagChannelDates.group === '') {
          tagChannelDates.group = channels[i].group;
        } else {
          let channelGroupsStr = channels[i].group;
          channelGroupsStr.split(',').forEach((item, index) => {
            if (tagChannelDates.group.indexOf(item) === -1) {
              tagChannelDates.group += ',' + item;
            }
          });
        }

        tagChannelDates.children.push(channels[i]);
        if (channels[i].status === 1) {
          tagChannelDates.status = 1;
        }
        tagChannelDates.used_quota += channels[i].used_quota;
        tagChannelDates.response_time += channels[i].response_time;
        tagChannelDates.response_time = tagChannelDates.response_time / 2;
      }
    }
    setChannels(channelDates);
  };

  const getFormValues = () => {
    const formValues = formApi ? formApi.getValues() : {};
    return {
      searchKeyword: formValues.searchKeyword || '',
      searchModel: formValues.searchModel || '',
    };
  };

  const loadChannels = async (
    page,
    pageSize,
    enableTagMode,
    typeKey = activeTypeKey,
    statusF,
    groupF,
  ) => {
    if (statusF === undefined) statusF = statusFilter;
    if (groupF === undefined) groupF = groupFilter;

    const { searchKeyword, searchModel } = getFormValues();
    if (searchKeyword !== '' || searchModel !== '') {
      setLoading(true);
      await searchChannels(enableTagMode, typeKey, statusF, groupF, page, pageSize);
      setLoading(false);
      return;
    }

    const reqId = ++requestCounter.current;
    setLoading(true);
    const typeParam = typeKey !== 'all' ? `&type=${typeKey}` : '';
    const statusParam = statusF !== 'all' ? `&status=${statusF}` : '';
    const groupParam = groupF !== 'all' ? `&group=${encodeURIComponent(groupF)}` : '';
    const res = await API.get(
      `/api/channel/?p=${page}&page_size=${pageSize}&tag_mode=${enableTagMode}${typeParam}${statusParam}${groupParam}`,
    );

    if (res === undefined || reqId !== requestCounter.current) {
      return;
    }

    const { success, message, data } = res.data;
    if (success) {
      const { items, total, type_counts } = data;
      if (type_counts) {
        const sumAll = Object.values(type_counts).reduce(
          (acc, v) => acc + v,
          0,
        );
        setTypeCounts({ ...type_counts, all: sumAll });
      }
      setChannelFormat(items, enableTagMode);
      setChannelCount(total);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const searchChannels = async (
    enableTagMode,
    typeKey = activeTypeKey,
    statusF = statusFilter,
    groupF = groupFilter,
    page = 1,
    pageSz = pageSize,
  ) => {
    const { searchKeyword, searchModel } = getFormValues();
    setSearching(true);
    try {
      if (searchKeyword === '' && searchModel === '') {
        await loadChannels(page, pageSz, enableTagMode, typeKey, statusF, groupF);
        return;
      }

      const typeParam = typeKey !== 'all' ? `&type=${typeKey}` : '';
      const statusParam = statusF !== 'all' ? `&status=${statusF}` : '';
      const groupParam = groupF !== 'all' ? `&group=${encodeURIComponent(groupF)}` : '';
      const res = await API.get(
        `/api/channel/search?keyword=${searchKeyword}&model=${searchModel}&tag_mode=${enableTagMode}&p=${page}&page_size=${pageSz}${typeParam}${statusParam}${groupParam}`,
      );
      const { success, message, data } = res.data;
      if (success) {
        const { items = [], total = 0, type_counts = {} } = data;
        const sumAll = Object.values(type_counts).reduce(
          (acc, v) => acc + v,
          0,
        );
        setTypeCounts({ ...type_counts, all: sumAll });
        setChannelFormat(items, enableTagMode);
        setChannelCount(total);
        setActivePage(page);
      } else {
        showError(message);
      }
    } finally {
      setSearching(false);
    }
  };

  const refresh = async (page = activePage) => {
    const { searchKeyword, searchModel } = getFormValues();
    if (searchKeyword === '' && searchModel === '') {
      await loadChannels(page, pageSize, enableTagMode);
    } else {
      await searchChannels(enableTagMode, activeTypeKey, statusFilter, page, pageSize);
    }
  };

  const handlePageChange = (page) => {
    const { searchKeyword, searchModel } = getFormValues();
    setActivePage(page);
    if (searchKeyword === '' && searchModel === '') {
      loadChannels(page, pageSize, enableTagMode).then(() => {});
    } else {
      searchChannels(enableTagMode, activeTypeKey, statusFilter, page, pageSize);
    }
  };

  const handlePageSizeChange = async (size) => {
    localStorage.setItem('page-size', size + '');
    setPageSize(size);
    setActivePage(1);
    const { searchKeyword, searchModel } = getFormValues();
    if (searchKeyword === '' && searchModel === '') {
      loadChannels(1, size, enableTagMode)
        .then()
        .catch((reason) => {
          showError(reason);
        });
    } else {
      searchChannels(enableTagMode, activeTypeKey, statusFilter, 1, size);
    }
  };

  const handleRow = (record, index) => {
    if (record.status !== 1) {
      return {
        style: {
          opacity: 0.45,
        },
      };
    } else {
      return {};
    }
  };

  const getDefaultColumnVisibility = () => {
    return {
      [COLUMN_KEYS.ID]: true,
      [COLUMN_KEYS.NAME]: true,
      [COLUMN_KEYS.TYPE]: true,
      [COLUMN_KEYS.STATUS]: true,
      [COLUMN_KEYS.RESPONSE_TIME]: true,
      [COLUMN_KEYS.BALANCE]: true,
      [COLUMN_KEYS.PRIORITY]: true,
      [COLUMN_KEYS.WEIGHT]: true,
      [COLUMN_KEYS.GROUPS]: true,
      [COLUMN_KEYS.OPERATE]: true,
    };
  };

  const initDefaultColumns = () => {
    const defaults = getDefaultColumnVisibility();
    setVisibleColumns(defaults);
  };

  const handleColumnVisibilityChange = (columnKey, checked) => {
    const updatedColumns = { ...visibleColumns, [columnKey]: checked };
    setVisibleColumns(updatedColumns);
  };

  const handleSelectAll = (checked) => {
    const allKeys = Object.keys(COLUMN_KEYS).map((key) => COLUMN_KEYS[key]);
    const updatedColumns = {};
    allKeys.forEach((key) => {
      updatedColumns[key] = checked;
    });
    setVisibleColumns(updatedColumns);
  };

  const channelTypeCounts = useMemo(() => {
    if (Object.keys(typeCounts).length > 0) return typeCounts;
    const counts = { all: channels.length };
    channels.forEach((channel) => {
      const collect = (ch) => {
        const type = ch.type;
        counts[type] = (counts[type] || 0) + 1;
      };
      if (channel.children !== undefined) {
        channel.children.forEach(collect);
      } else {
        collect(channel);
      }
    });
    return counts;
  }, [typeCounts, channels]);

  const availableTypeKeys = useMemo(() => {
    const keys = ['all'];
    Object.entries(channelTypeCounts).forEach(([k, v]) => {
      if (k !== 'all' && v > 0) keys.push(String(k));
    });
    return keys;
  }, [channelTypeCounts]);

  const updateChannelProperty = (channelId, updateFn) => {
    const newChannels = [...channels];
    let updated = false;

    newChannels.forEach((channel) => {
      if (channel.children !== undefined) {
        channel.children.forEach((child) => {
          if (child.id === channelId) {
            updateFn(child);
            updated = true;
          }
        });
      } else if (channel.id === channelId) {
        updateFn(channel);
        updated = true;
      }
    });

    if (updated) {
      setChannels(newChannels);
    }
  };

  useEffect(() => {
    const localPageSize =
      parseInt(localStorage.getItem('page-size')) || ITEMS_PER_PAGE;
    const localEnableTagMode =
      localStorage.getItem('enable-tag-mode') === 'true';
    const localEnableBatchDelete =
      localStorage.getItem('enable-batch-delete') === 'true';

    setPageSize(localPageSize);
    setEnableTagMode(localEnableTagMode);
    setEnableBatchDelete(localEnableBatchDelete);

    loadChannels(1, localPageSize, localEnableTagMode)
      .then()
      .catch((reason) => {
        showError(reason);
      });
    loadChannelModels().then();
  }, []);

  useEffect(() => {
    const savedColumns = localStorage.getItem('channels-table-columns');
    if (savedColumns) {
      try {
        const parsed = JSON.parse(savedColumns);
        const defaults = getDefaultColumnVisibility();
        const merged = { ...defaults, ...parsed };
        setVisibleColumns(merged);
      } catch (e) {
        initDefaultColumns();
      }
    } else {
      initDefaultColumns();
    }
  }, []);

  useEffect(() => {
    if (Object.keys(visibleColumns).length > 0) {
      localStorage.setItem(
        'channels-table-columns',
        JSON.stringify(visibleColumns),
      );
    }
  }, [visibleColumns]);

  return {
    channels,
    setChannels,
    loading,
    searching,
    activePage,
    setActivePage,
    pageSize,
    channelCount,
    enableTagMode,
    setEnableTagMode,
    enableBatchDelete,
    setEnableBatchDelete,
    statusFilter,
    setStatusFilter,
    groupFilter,
    setGroupFilter,
    groupOptions,
    compactMode,
    setCompactMode,
    activeTypeKey,
    setActiveTypeKey,
    typeCounts,
    channelTypeCounts,
    availableTypeKeys,
    visibleColumns,
    showColumnSelector,
    setShowColumnSelector,
    COLUMN_KEYS,
    formApi,
    setFormApi,
    formInitValues,
    loadChannels,
    searchChannels,
    refresh,
    handlePageChange,
    handlePageSizeChange,
    handleRow,
    handleColumnVisibilityChange,
    handleSelectAll,
    initDefaultColumns,
    getDefaultColumnVisibility,
    updateChannelProperty,
    setChannelFormat,
    getFormValues,
  };
};