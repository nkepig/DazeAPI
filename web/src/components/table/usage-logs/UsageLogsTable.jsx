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

import React, { useMemo } from 'react';
import CardTable from '../../common/ui/CardTable';
import { getLogsColumns } from './UsageLogsColumnDefs';

const LogsTable = (logsData) => {
  const {
    logs,
    expandData,
    loading,
    activePage,
    pageSize,
    logCount,
    compactMode,
    visibleColumns,
    handlePageChange,
    handlePageSizeChange,
    copyText,
    showUserInfoFunc,
    openChannelAffinityUsageCacheModal,
    openRetryAttemptsDrawer,
    openUsageDictModal,
    isAdminUser,
    billingDisplayMode,
    hasExpandableRows,
    t,
    COLUMN_KEYS,
  } = logsData;

  // Get all columns
  const allColumns = useMemo(() => {
    return getLogsColumns({
      t,
      COLUMN_KEYS,
        copyText,
        showUserInfoFunc,
        openChannelAffinityUsageCacheModal,
        openRetryAttemptsDrawer,
        openUsageDictModal,
        isAdminUser,
        billingDisplayMode,
    });
  }, [
    t,
    COLUMN_KEYS,
    copyText,
    showUserInfoFunc,
    openChannelAffinityUsageCacheModal,
    openRetryAttemptsDrawer,
    openUsageDictModal,
    isAdminUser,
    billingDisplayMode,
  ]);

  // Filter columns based on visibility settings
  const getVisibleColumns = () => {
    return allColumns.filter((column) => visibleColumns[column.key]);
  };

  const visibleColumnsList = useMemo(() => {
    return getVisibleColumns();
  }, [visibleColumns, allColumns]);

  const tableColumns = useMemo(() => {
    return compactMode
      ? visibleColumnsList.map(({ fixed, ...rest }) => rest)
      : visibleColumnsList;
  }, [compactMode, visibleColumnsList]);

  const canExpand = typeof hasExpandableRows === 'function' && hasExpandableRows();

  return (
    <CardTable
      columns={tableColumns}
      dataSource={logs}
      rowKey='key'
      loading={loading}
      scroll={compactMode ? undefined : { x: 'max-content' }}
      className='rounded-xl overflow-hidden usage-logs-table'
      size='small'
      expandRowByClick={canExpand}
      expandedRowRender={
        canExpand
          ? (record) => {
              const data = expandData[record.key];
              if (!data?.length) return null;
              return (
                <div className='log-expand'>
                  {data.map((item, i) => (
                    <div className='log-expand-row' key={`${item.key}-${i}`}>
                      <span className='log-expand-key'>{item.key}</span>
                      <span className='log-expand-val'>{item.value}</span>
                    </div>
                  ))}
                </div>
              );
            }
          : undefined
      }
      rowExpandable={(record) =>
        Boolean(expandData[record.key] && expandData[record.key].length > 0)
      }
      empty={<></>}
      pagination={{
        currentPage: activePage,
        pageSize: pageSize,
        total: logCount,
        pageSizeOptions: [10, 20, 50, 100],
        showSizeChanger: true,
        onPageSizeChange: (size) => {
          handlePageSizeChange(size);
        },
        onPageChange: handlePageChange,
      }}
      hidePagination={true}
    />
  );
};

export default React.memo(LogsTable);
