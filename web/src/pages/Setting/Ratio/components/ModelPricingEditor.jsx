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

import React, { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Collapsible,
  Empty,
  Input,
  Modal,
  Radio,
  RadioGroup,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconDelete,
  IconPlus,
  IconSave,
  IconSearch,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import {
  PAGE_SIZE,
  PRICE_SUFFIX,
  buildSummaryText,
  hasValue,
  useModelPricingEditorState,
} from '../hooks/useModelPricingEditorState';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';

const { Text } = Typography;
const EMPTY_CANDIDATE_MODEL_NAMES = [];

const PriceInput = ({
  label,
  value,
  placeholder,
  onChange,
  suffix = PRICE_SUFFIX,
  disabled = false,
  extraText = '',
}) => (
  <div style={{ marginBottom: 12 }}>
    <div className='mb-1 font-medium text-gray-700 flex items-center justify-between gap-3'>
      <span>{label}</span>
    </div>
    <Input
      value={value}
      placeholder={placeholder}
      onChange={onChange}
      suffix={suffix}
      disabled={disabled}
    />
    {extraText ? (
      <div className='mt-1 text-xs text-gray-500'>{extraText}</div>
    ) : null}
  </div>
);

export default function ModelPricingEditor({
  options,
  refresh,
  candidateModelNames = EMPTY_CANDIDATE_MODEL_NAMES,
  filterMode = 'all',
  allowAddModel = true,
  allowDeleteModel = true,
  listDescription = '',
  emptyTitle = '',
  emptyDescription = '',
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [addVisible, setAddVisible] = useState(false);
  const [batchVisible, setBatchVisible] = useState(false);
  const [newModelName, setNewModelName] = useState('');
  const [showAdvancedPrices, setShowAdvancedPrices] = useState(false);

  const {
    selectedModel,
    selectedModelName,
    selectedModelNames,
    setSelectedModelName,
    setSelectedModelNames,
    searchText,
    setSearchText,
    currentPage,
    setCurrentPage,
    loading,
    statusFilter,
    setStatusFilter,
    filteredModels,
    pagedData,
    selectedWarnings,
    previewRows,
    handleNumericFieldChange,
    handleBillingModeChange,
    handleSubmit,
    addModel,
    deleteModel,
    applySelectedModelPricing,
  } = useModelPricingEditorState({
    options,
    refresh,
    t,
    candidateModelNames,
    filterMode,
  });

  const columns = useMemo(
    () => [
      {
        title: t('模型名称'),
        dataIndex: 'name',
        key: 'name',
        width: 220,
        ellipsis: true,
        render: (text, record) => (
          <Space>
            <Button
              theme='borderless'
              type='tertiary'
              onClick={() => setSelectedModelName(record.name)}
              style={{
                padding: 0,
                color:
                  record.name === selectedModelName
                    ? 'var(--semi-color-primary)'
                    : undefined,
              }}
            >
              {text}
            </Button>
            {selectedModelNames.includes(record.name) ? (
              <Tag color='green' shape='circle'>
                {t('已勾选')}
              </Tag>
            ) : null}
          </Space>
        ),
      },
      {
        title: t('计费方式'),
        dataIndex: 'billingMode',
        key: 'billingMode',
        width: 120,
        render: (_, record) => (
          <Tag color={record.billingMode === 'per-request' ? 'teal' : 'violet'}>
            {record.billingMode === 'per-request'
              ? t('固定价格')
              : t('按 token 价格')}
          </Tag>
        ),
      },
      {
        title: t('配置状态'),
        dataIndex: 'hasConfiguration',
        key: 'configurationStatus',
        width: 100,
        render: (_, record) => (
          <Tag color={record.hasConfiguration ? 'green' : 'grey'}>
            {record.hasConfiguration ? t('已配置') : t('未配置')}
          </Tag>
        ),
      },
      {
        title: t('价格摘要'),
        dataIndex: 'summary',
        key: 'summary',
        width: 240,
        render: (_, record) => (
          <div
            style={{
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={buildSummaryText(record, t)}
          >
            {buildSummaryText(record, t)}
          </div>
        ),
      },
      {
        title: t('操作'),
        key: 'action',
        width: 80,
        render: (_, record) => (
          <Space>
            {allowDeleteModel ? (
              <Button
                size='small'
                type='danger'
                icon={<IconDelete />}
                onClick={() => deleteModel(record.name)}
              />
            ) : null}
          </Space>
        ),
      },
    ],
    [allowDeleteModel, deleteModel, selectedModelName, selectedModelNames, setSelectedModelName, t],
  );

  const handleAddModel = () => {
    if (addModel(newModelName)) {
      setNewModelName('');
      setAddVisible(false);
    }
  };

  const rowSelection = {
    selectedRowKeys: selectedModelNames,
    onChange: (selectedRowKeys) => setSelectedModelNames(selectedRowKeys),
  };

  return (
    <>
      <Space vertical align='start' style={{ width: '100%' }}>
        <Space wrap className='mt-2'>
          {allowAddModel ? (
            <Button
              icon={<IconPlus />}
              onClick={() => setAddVisible(true)}
              style={isMobile ? { width: '100%' } : undefined}
            >
              {t('新增模型')}
            </Button>
          ) : null}
          <Button
            type='primary'
            icon={<IconSave />}
            loading={loading}
            onClick={handleSubmit}
            style={isMobile ? { width: '100%' } : undefined}
          >
            {t('保存')}
          </Button>
          <Button
            disabled={!selectedModel || selectedModelNames.length === 0}
            onClick={() => setBatchVisible(true)}
            style={isMobile ? { width: '100%' } : undefined}
          >
            {t('批量应用')}
            {selectedModelNames.length > 0 ? ` (${selectedModelNames.length})` : ''}
          </Button>
          <Select
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
            style={{ width: isMobile ? '100%' : 140 }}
            optionList={[
              { label: t('全部'), value: 'all' },
              { label: t('已配置'), value: 'configured' },
              { label: t('未配置'), value: 'unset' },
            ]}
          />
          <Input
            prefix={<IconSearch />}
            placeholder={t('搜索模型')}
            value={searchText}
            onChange={(value) => setSearchText(value)}
            style={{ width: isMobile ? '100%' : 220 }}
            showClear
          />
        </Space>

        {listDescription ? (
          <div className='text-sm text-gray-500'>{listDescription}</div>
        ) : null}
        {selectedModelNames.length > 0 ? (
          <div
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--semi-color-primary-light-default)',
              border: '1px solid var(--semi-color-primary)',
              color: 'var(--semi-color-primary)',
              fontWeight: 600,
            }}
          >
            {t('已勾选 {{count}} 个模型', { count: selectedModelNames.length })}
          </div>
        ) : null}

        <div
          style={{
            width: '100%',
            display: 'grid',
            gap: 16,
            gridTemplateColumns: isMobile
              ? 'minmax(0, 1fr)'
              : 'minmax(360px, 1.1fr) minmax(420px, 1fr)',
          }}
        >
          <Card
            bodyStyle={{ padding: 0 }}
            style={{
              minWidth: 0,
              width: '100%',
              ...(isMobile ? { order: 2 } : {}),
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <Table
                columns={columns}
                dataSource={pagedData}
                rowKey='name'
                rowSelection={rowSelection}
                pagination={{
                  currentPage,
                  pageSize: PAGE_SIZE,
                  total: filteredModels.length,
                  onPageChange: (page) => setCurrentPage(page),
                  showTotal: true,
                  showSizeChanger: false,
                }}
                empty={
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    {emptyTitle || t('暂无模型')}
                  </div>
                }
                onRow={(record) => ({
                  style: {
                    background: selectedModelNames.includes(record.name)
                      ? 'var(--semi-color-success-light-default)'
                      : record.name === selectedModelName
                        ? 'var(--semi-color-primary-light-default)'
                        : undefined,
                    boxShadow: selectedModelNames.includes(record.name)
                      ? 'inset 4px 0 0 var(--semi-color-success)'
                      : record.name === selectedModelName
                        ? 'inset 4px 0 0 var(--semi-color-primary)'
                        : undefined,
                    transition: 'background 0.2s ease, box-shadow 0.2s ease',
                  },
                  onClick: () => setSelectedModelName(record.name),
                })}
                scroll={isMobile ? { x: 760 } : { x: 760 }}
              />
            </div>
          </Card>

          <Card
            style={{
              minWidth: 0,
              width: '100%',
              ...(isMobile ? { order: 1 } : {}),
            }}
            title={selectedModel ? selectedModel.name : t('模型计费编辑器')}
            headerExtraContent={
              selectedModel ? (
                <Tag color='blue'>
                  {selectedModel.billingMode === 'per-request'
                    ? t('固定价格')
                    : t('按 token 价格')}
                </Tag>
              ) : null
            }
          >
            {!selectedModel ? (
              <Empty
                title={emptyTitle || t('暂无模型')}
                description={
                  emptyDescription || t('请先新增模型或从左侧列表选择一个模型')
                }
              />
            ) : (
              <div>
                <div className='mb-4'>
                  <div className='mb-2 font-medium text-gray-700'>
                    {t('计费方式')}
                  </div>
                  <RadioGroup
                    type='button'
                    value={selectedModel.billingMode}
                    onChange={(event) => handleBillingModeChange(event.target.value)}
                  >
                    <Radio value='per-token'>{t('按 token 价格')}</Radio>
                    <Radio value='per-request'>{t('固定价格')}</Radio>
                  </RadioGroup>
                  <div className='mt-2 text-xs text-gray-500'>
                    {t('仅保存价格配置')}
                  </div>
                </div>

                {selectedWarnings.length > 0 ? (
                  <Card
                    bodyStyle={{ padding: 12 }}
                    style={{
                      marginBottom: 16,
                      background: 'var(--semi-color-warning-light-default)',
                    }}
                  >
                    <div className='font-medium mb-2'>{t('当前提示')}</div>
                    {selectedWarnings.map((warning) => (
                      <div key={warning} className='text-sm text-gray-700 mb-1'>
                        {warning}
                      </div>
                    ))}
                  </Card>
                ) : null}

                {selectedModel.billingMode === 'per-request' ? (
                  <PriceInput
                    label={t('固定价格')}
                    value={selectedModel.fixedPrice}
                    placeholder={t('输入每次调用价格')}
                    suffix={t('$/次')}
                    onChange={(value) => handleNumericFieldChange('fixedPrice', value)}
                    extraText={t('按次计费')}
                  />
                ) : (
                  <Card
                    bodyStyle={{ padding: 16 }}
                    style={{
                      marginBottom: 16,
                      background: 'var(--semi-color-fill-0)',
                    }}
                  >
                    <div className='font-medium mb-3'>{t('Token 价格')}</div>
                    <PriceInput
                      label={t('输入价格')}
                      value={selectedModel.inputPrice}
                      placeholder={t('输入 $/1M tokens')}
                      onChange={(value) => handleNumericFieldChange('inputPrice', value)}
                      extraText={t('保存为输入价格')}
                    />
                    <PriceInput
                      label={t('输出价格')}
                      value={selectedModel.outputPrice}
                      placeholder={t('输入 $/1M tokens')}
                      onChange={(value) => handleNumericFieldChange('outputPrice', value)}
                      extraText={t('保存为输出价格')}
                    />
                    <div style={{ marginTop: 10 }}>
                      <Button
                        theme='borderless'
                        type='tertiary'
                        onClick={() => setShowAdvancedPrices((prev) => !prev)}
                        style={{ paddingLeft: 0, fontWeight: 600 }}
                      >
                        {showAdvancedPrices ? t('收起扩展价格') : t('展开扩展价格')}
                      </Button>
                      <Collapsible isOpen={showAdvancedPrices}>
                        <Card bodyStyle={{ padding: 12 }} style={{ marginTop: 8, background: 'var(--semi-color-fill-1)' }}>
                          <PriceInput
                            label={t('缓存读取价格')}
                            value={selectedModel.cacheReadPrice}
                            placeholder={t('输入 $/1M tokens')}
                            onChange={(value) => handleNumericFieldChange('cacheReadPrice', value)}
                            extraText={t('按缓存读取计费')}
                          />
                          <PriceInput
                            label={t('缓存创建价格')}
                            value={selectedModel.cacheWritePrice}
                            placeholder={t('输入 $/1M tokens')}
                            onChange={(value) => handleNumericFieldChange('cacheWritePrice', value)}
                            extraText={t('按缓存创建计费')}
                          />
                          <PriceInput
                            label={t('图片输入价格')}
                            value={selectedModel.imagePrice}
                            placeholder={t('输入 $/1M tokens')}
                            onChange={(value) => handleNumericFieldChange('imagePrice', value)}
                            extraText={t('按图片输入计费')}
                          />
                        </Card>
                      </Collapsible>
                    </div>
                  </Card>
                )}

                <Card bodyStyle={{ padding: 16 }} style={{ background: 'var(--semi-color-fill-0)' }}>
                  <div className='font-medium mb-3'>{t('保存预览')}</div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(140px, 180px) 1fr',
                      gap: 8,
                    }}
                  >
                    {previewRows.map((row) => (
                      <React.Fragment key={row.key}>
                        <Text strong>{row.label}</Text>
                        <Text size='small'>{row.value}</Text>
                      </React.Fragment>
                    ))}
                  </div>
                </Card>
              </div>
            )}
          </Card>
        </div>
      </Space>

      {allowAddModel ? (
        <Modal
          title={t('新增模型')}
          visible={addVisible}
          onCancel={() => {
            setAddVisible(false);
            setNewModelName('');
          }}
          onOk={handleAddModel}
        >
          <Input
            value={newModelName}
            placeholder={t('输入模型名称，例如 gpt-4.1')}
            onChange={(value) => setNewModelName(value)}
          />
        </Modal>
      ) : null}

      <Modal
        title={t('批量应用')}
        visible={batchVisible}
        onCancel={() => setBatchVisible(false)}
        onOk={() => {
          if (applySelectedModelPricing()) {
            setBatchVisible(false);
          }
        }}
      >
        <div className='text-sm text-gray-600'>
          {selectedModel
            ? t(
                '将当前价格同步到已勾选模型。',
                {
                  name: selectedModel.name,
                  count: selectedModelNames.length,
                },
              )
            : t('请先选择一个作为模板的模型')}
        </div>
      </Modal>
    </>
  );
}
