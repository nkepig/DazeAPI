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

import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Table, InputNumber, Typography, Spin } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../../helpers';

const DefaultVendorRatioModal = ({ visible, onClose, t }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [ratios, setRatios] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/user/default-vendor-ratios');
      const { success, message, data } = res.data;
      if (!success) {
        showError(message || t('加载失败'));
        return;
      }
      const list = data.vendors || [];
      setVendors(list);
      const m = data.default_vendor_ratio_multipliers || {};
      const next = {};
      for (const v of list) {
        const id = v.id;
        const raw = m[id] ?? m[String(id)];
        next[id] =
          raw != null && Number(raw) > 0 ? Number(raw) : 1;
      }
      setRatios(next);
    } catch (e) {
      showError(e.message || t('加载失败'));
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    if (visible) {
      load();
    }
  }, [visible, load]);

  const handleSave = async () => {
    const payload = {};
    for (const v of vendors) {
      const r = ratios[v.id];
      if (r != null && r > 0) {
        payload[v.id] = r;
      }
    }
    setSaving(true);
    try {
      const res = await API.put('/api/user/default-vendor-ratios', {
        default_vendor_ratio_multipliers: payload,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('已保存默认供应商倍率'));
        onClose();
      } else {
        showError(message);
      }
    } catch (e) {
      showError(e.message || t('保存失败'));
    }
    setSaving(false);
  };

  const columns = [
    {
      title: t('供应商'),
      dataIndex: 'name',
      render: (_, record) => (
        <div>
          <div className='font-medium'>{record.name}</div>
          {record.description ? (
            <Typography.Text type='tertiary' style={{ fontSize: 12 }}>
              {record.description}
            </Typography.Text>
          ) : null}
        </div>
      ),
    },
    {
      title: t('供应商默认倍率'),
      width: 200,
      render: (_, record) => (
        <InputNumber
          min={0.01}
          max={1000}
          step={0.1}
          value={ratios[record.id] ?? 1}
          onChange={(v) => {
            const n = v == null ? 1 : v;
            setRatios((prev) => ({ ...prev, [record.id]: n }));
          }}
        />
      ),
    },
  ];

  return (
    <Modal
      title={t('默认供应商倍率')}
      visible={visible}
      onCancel={onClose}
      onOk={handleSave}
      okText={t('保存')}
      cancelText={t('取消')}
      confirmLoading={saving}
      width={720}
      maskClosable={false}
    >
      <Typography.Paragraph type='tertiary' className='!mb-4'>
        {t('默认供应商倍率说明')}
      </Typography.Paragraph>
      {loading ? (
        <div className='py-16 flex justify-center'>
          <Spin size='large' />
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={vendors}
          pagination={false}
          rowKey='id'
        />
      )}
    </Modal>
  );
};

export default DefaultVendorRatioModal;
