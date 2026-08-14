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

import React, { useState, useRef } from 'react';
import { API, showError, showSuccess } from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import { Button, Modal, Spin, Form } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { ModalTitle } from '../../../common/ui/FormSection';

const AddUserModal = (props) => {
  const { t } = useTranslation();
  const formApiRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();

  const getInitValues = () => ({
    username: '',
    display_name: '',
    password: '',
    remark: '',
  });

  const submit = async (values) => {
    setLoading(true);
    const res = await API.post(`/api/user/`, values);
    const { success, message } = res.data;
    if (success) {
      showSuccess(t('用户账户创建成功！'));
      formApiRef.current?.setValues(getInitValues());
      props.refresh();
      props.handleClose();
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const handleCancel = () => {
    props.handleClose();
  };

  return (
    <Modal
      className='compact-modal'
      title={
        <ModalTitle
          title={t('添加用户')}
          subtitle={t('创建登录账号与初始密码')}
        />
      }
      visible={props.visible}
      onCancel={handleCancel}
      width={isMobile ? '100%' : 680}
      centered
      closable
      maskClosable={false}
      footer={
        <div className='flex justify-end gap-2'>
          <Button theme='light' type='tertiary' onClick={handleCancel}>
            {t('取消')}
          </Button>
          <Button
            theme='solid'
            type='primary'
            loading={loading}
            onClick={() => formApiRef.current?.submitForm()}
          >
            {t('保存')}
          </Button>
        </div>
      }
    >
      <Spin spinning={loading}>
        <Form
          className='compact-form'
          initValues={getInitValues()}
          getFormApi={(api) => (formApiRef.current = api)}
          onSubmit={submit}
          onSubmitFail={(errs) => {
            const first = Object.values(errs)[0];
            if (first) showError(Array.isArray(first) ? first[0] : first);
            formApiRef.current?.scrollToError();
          }}
        >
          <Form.Input
            field='username'
            label={t('用户名')}
            placeholder={t('登录名')}
            rules={[{ required: true, message: t('请输入用户名') }]}
            showClear
          />
          <Form.Input
            field='display_name'
            label={t('显示名称')}
            placeholder={t('可选')}
            showClear
          />
          <Form.Input
            field='password'
            label={t('密码')}
            type='password'
            placeholder={t('登录密码')}
            rules={[{ required: true, message: t('请输入密码') }]}
            showClear
          />
          <Form.Input
            field='remark'
            label={t('备注')}
            placeholder={t('仅管理员可见')}
            showClear
          />
        </Form>
      </Spin>
    </Modal>
  );
};

export default AddUserModal;
