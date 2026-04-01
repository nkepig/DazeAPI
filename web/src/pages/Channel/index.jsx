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
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import ChannelsTable from '../../components/table/channels';

const Channel = () => {
  const { t } = useTranslation();
  return (
    <div className='px-6 lg:px-10 py-8'>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className='mb-6'
      >
        <h1 className='text-[22px] font-semibold text-[#1A1A1A]'>{t('渠道管理')}</h1>
        <p className='text-[13px] text-[#999] mt-1'>{t('配置和管理 API 渠道')}</p>
      </motion.div>
      <ChannelsTable />
    </div>
  );
};

export default Channel;
