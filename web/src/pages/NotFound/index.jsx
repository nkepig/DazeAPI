import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

const NotFound = () => {
  const { t } = useTranslation();
  return (
    <div className='min-h-[70vh] flex items-center justify-center'>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className='text-center'
      >
        <p className='text-[64px] font-bold text-[#E8E8E8] leading-none mb-2'>404</p>
        <p className='text-sm text-[#999] mb-8'>{t('页面不存在')}</p>
        <Link
          to='/'
          className='inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[#1A1A1A] bg-white border border-[#EBEBEB] rounded-lg no-underline hover:bg-[#F5F5F5] transition-colors'
        >
          <ArrowLeft size={15} strokeWidth={1.5} />
          {t('返回首页')}
        </Link>
      </motion.div>
    </div>
  );
};

export default NotFound;
