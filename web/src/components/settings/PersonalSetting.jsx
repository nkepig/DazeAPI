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

import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, showError, showSuccess, setUserData, renderQuota } from '../../helpers';
import { UserContext } from '../../context/User';
import { Modal, Form, Button } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { Wallet, Users, KeyRound, LogOut } from 'lucide-react';

const PersonalSetting = () => {
  const [userState, userDispatch] = useContext(UserContext);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [inputs, setInputs] = useState({
    original_password: '',
    set_new_password: '',
    set_new_password_confirmation: '',
  });

  useEffect(() => {
    getUserData();
  }, []);

  const getUserData = async () => {
    try {
      const res = await API.get('/api/user/self');
      const { success, message, data } = res.data;
      if (success) {
        userDispatch({ type: 'login', payload: data });
        setUserData(data);
      } else {
        showError(message);
      }
    } catch {
      showError(t('获取用户信息失败'));
    }
  };

  const handleInputChange = (name, value) => {
    setInputs((prev) => ({ ...prev, [name]: value }));
  };

  const changePassword = async () => {
    if (!inputs.set_new_password) {
      showError(t('请输入新密码！'));
      return;
    }
    if (inputs.original_password === inputs.set_new_password) {
      showError(t('新密码需要和原密码不一致！'));
      return;
    }
    if (inputs.set_new_password !== inputs.set_new_password_confirmation) {
      showError(t('两次输入的密码不一致！'));
      return;
    }
    try {
      const res = await API.put('/api/user/self', {
        original_password: inputs.original_password,
        password: inputs.set_new_password,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('密码修改成功！'));
        setShowChangePasswordModal(false);
        setInputs({ original_password: '', set_new_password: '', set_new_password_confirmation: '' });
      } else {
        showError(message);
      }
    } catch {
      showError(t('密码修改失败'));
    }
  };

  const handleLogout = async () => {
    try { await API.get('/api/user/logout'); } catch {}
    localStorage.removeItem('user');
    userDispatch({ type: 'logout' });
    navigate('/login');
  };

  const user = userState?.user;
  const username = user?.display_name || user?.username || '';
  const initials = username ? username.slice(0, 2).toUpperCase() : 'NA';

  return (
    <div className='px-6 lg:px-10 py-10'>
      <div className='max-w-[520px] mx-auto'>
        {/* Avatar + Name */}
        <div className='flex items-center gap-4 mb-10'>
          <div className='w-14 h-14 rounded-full bg-[#F5F5F5] flex items-center justify-center text-lg font-semibold text-[#1A1A1A] shrink-0'>
            {initials}
          </div>
          <div className='min-w-0'>
            <h1 className='text-[20px] font-semibold text-[#1A1A1A] truncate'>{username}</h1>
            <p className='text-[13px] text-[#999] mt-0.5'>ID: {user?.id}</p>
          </div>
        </div>

        {/* Info Items */}
        <div className='space-y-0'>
          <InfoRow icon={Wallet} label={t('账户余额')} value={renderQuota(user?.quota)} />
          <InfoRow icon={Wallet} label={t('已用额度')} value={renderQuota(user?.used_quota)} />
          <InfoRow icon={Users} label={t('用户分组')} value={user?.group || t('默认')} />
          <InfoRow icon={KeyRound} label={t('请求次数')} value={String(user?.request_count || 0)} />
        </div>

        {/* Actions */}
        <div className='mt-10 space-y-3'>
          <button
            onClick={() => setShowChangePasswordModal(true)}
            className='w-full py-2.5 text-sm font-medium text-[#1A1A1A] bg-white border border-[#EBEBEB] rounded-lg cursor-pointer hover:bg-[#FAFAFA] transition-colors'
          >
            {t('修改密码')}
          </button>
          <button
            onClick={handleLogout}
            className='w-full py-2.5 text-sm font-medium text-[#999] bg-white border border-[#EBEBEB] rounded-lg cursor-pointer hover:bg-[#FAFAFA] transition-colors'
          >
            {t('退出登录')}
          </button>
        </div>
      </div>

      {/* Change Password Modal */}
      <Modal
        title={t('修改密码')}
        visible={showChangePasswordModal}
        onOk={changePassword}
        onCancel={() => setShowChangePasswordModal(false)}
        okText={t('确认')}
        cancelText={t('取消')}
        centered
        width={400}
      >
        <Form>
          <Form.Input
            field='original_password'
            label={t('原密码')}
            placeholder={t('请输入原密码')}
            mode='password'
            onChange={(v) => handleInputChange('original_password', v)}
          />
          <Form.Input
            field='set_new_password'
            label={t('新密码')}
            placeholder={t('请输入新密码')}
            mode='password'
            onChange={(v) => handleInputChange('set_new_password', v)}
          />
          <Form.Input
            field='set_new_password_confirmation'
            label={t('确认新密码')}
            placeholder={t('再次输入新密码')}
            mode='password'
            onChange={(v) => handleInputChange('set_new_password_confirmation', v)}
          />
        </Form>
      </Modal>
    </div>
  );
};

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className='flex items-center justify-between py-4 border-b border-[#F5F5F5] last:border-0'>
      <div className='flex items-center gap-2.5'>
        <Icon size={16} strokeWidth={1.5} color='#BBB' />
        <span className='text-[13px] text-[#999]'>{label}</span>
      </div>
      <span className='text-[14px] font-medium text-[#1A1A1A]'>{value}</span>
    </div>
  );
}

export default PersonalSetting;
