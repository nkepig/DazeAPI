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
import { Modal } from '@douyinfe/semi-ui';

const DeleteUserModal = ({
  visible,
  onCancel,
  onConfirm,
  user,
  users,
  activePage,
  refresh,
  manageUser,
  deleteUser,
  permanently,
  t,
}) => {
  const handleConfirm = async () => {
    if (permanently) {
      await deleteUser(user);
    } else {
      await manageUser(user.id, 'delete', user);
    }
    const nextPage = users.length === 1 && activePage > 1 ? activePage - 1 : activePage;
    await refresh(nextPage);
    onCancel(); // Close modal after success
  };

  return (
    <Modal
      title={permanently ? t('确定要彻底移除此用户吗？') : t('确定是否要注销此用户？')}
      visible={visible}
      onCancel={onCancel}
      onOk={handleConfirm}
      type='danger'
    >
      {permanently
        ? t('该用户已注销，此操作会从数据库中彻底移除且不可恢复')
        : t('相当于删除用户，此修改将不可逆')}
    </Modal>
  );
};

export default DeleteUserModal;
