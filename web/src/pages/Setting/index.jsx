/*
Copyright (C) 2025 QuantumNous
*/

import React, { useEffect, useState, useRef } from 'react';
import { Collapsible } from '@douyinfe/semi-ui';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  Calculator,
  Activity,
  ChevronDown,
} from 'lucide-react';

import { isRoot } from '../../helpers';
import OperationSetting from '../../components/settings/OperationSetting';
import RatioSetting from '../../components/settings/RatioSetting';
import PerformanceSetting from '../../components/settings/PerformanceSetting';

const sections = [
  { key: 'operation', icon: Settings, label: '运营设置', Component: OperationSetting },
  { key: 'ratio', icon: Calculator, label: '分组与模型定价', Component: RatioSetting },
  { key: 'performance', icon: Activity, label: '性能设置', Component: PerformanceSetting },
];

function SectionBlock({ sectionKey, icon: Icon, label, children, defaultOpen, t }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div id={`section-${sectionKey}`} className='mb-8'>
      <button
        onClick={() => setOpen(!open)}
        className='w-full flex items-center justify-between py-3 bg-transparent border-0 cursor-pointer transition-colors'
      >
        <span className='flex items-center gap-2.5 text-[15px] font-medium text-[#1A1A1A]'>
          <Icon size={18} strokeWidth={1.5} color='#999' />
          {t(label)}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.5}
          color='#C8C8C8'
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>
      <Collapsible isOpen={open}>
        <div className='pt-2 pb-4'>
          {children}
        </div>
      </Collapsible>
      <div className='border-b border-[#F0F0F0]' />
    </div>
  );
}

const Setting = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('operation');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('section');
    if (section) {
      setActiveSection(section);
      setTimeout(() => {
        const el = document.getElementById(`section-${section}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [location.search]);

  if (!isRoot()) {
    return (
      <div className='px-6 lg:px-10 py-8'>
        <p className='text-[#999]'>{t('无权访问')}</p>
      </div>
    );
  }

  return (
    <div className='px-6 lg:px-10 py-8'>
      <div className='mb-6'>
        <h1 className='text-[22px] font-semibold text-[#1A1A1A]'>{t('运营设置')}</h1>
        <p className='text-[13px] text-[#999] mt-1'>{t('管理核心运营配置')}</p>
      </div>

      {/* Quick nav */}
      <div className='flex gap-2 flex-wrap mb-8'>
        {sections.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => {
              setActiveSection(key);
              navigate(`?section=${key}`);
              const el = document.getElementById(`section-${key}`);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-full cursor-pointer transition-all border ${
              activeSection === key
                ? 'text-[#1A1A1A] border-[#1A1A1A] bg-white'
                : 'text-[#999] border-[#EBEBEB] bg-white hover:bg-[#F5F5F5] hover:text-[#1A1A1A]'
            }`}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {sections.map(({ key, icon, label, Component }) => (
        <SectionBlock
          key={key}
          sectionKey={key}
          icon={icon}
          label={label}
          defaultOpen={activeSection === key}
          t={t}
        >
          <Component />
        </SectionBlock>
      ))}
    </div>
  );
};

export default Setting;
