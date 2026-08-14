/*
Copyright (C) 2025 QuantumNous
*/

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  Calculator,
  Activity,
  Megaphone,
} from 'lucide-react';

import { isRoot } from '../../helpers';
import OperationSetting from '../../components/settings/OperationSetting';
import RatioSetting from '../../components/settings/RatioSetting';
import PerformanceSetting from '../../components/settings/PerformanceSetting';
import AnnouncementSetting from '../../components/settings/AnnouncementSetting';

const sections = [
  { key: 'announcement', icon: Megaphone, navLabel: '公告', label: '公告管理', Component: AnnouncementSetting },
  { key: 'operation', icon: Settings, navLabel: '运营', label: '运营设置', Component: OperationSetting },
  { key: 'ratio', icon: Calculator, navLabel: '定价', label: '模型定价', Component: RatioSetting },
  { key: 'performance', icon: Activity, navLabel: '性能', label: '性能设置', Component: PerformanceSetting },
];

const Setting = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('operation');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('section');
    if (section && sections.some((s) => s.key === section)) {
      setActiveSection(section);
    }
  }, [location.search]);

  const switchSection = (key) => {
    setActiveSection(key);
    navigate(`?section=${key}`);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  if (!isRoot()) {
    return (
      <div className='px-6 lg:px-10 py-8'>
        <p className='text-[#999]'>{t('无权访问')}</p>
      </div>
    );
  }

  const current = sections.find((s) => s.key === activeSection) || sections[1];
  const ActiveComponent = current.Component;

  return (
    <div className='px-6 lg:px-10 py-8'>
      <h1 className='text-[22px] font-semibold text-[#1A1A1A] mb-6'>{t(current.label)}</h1>

      <div className='flex flex-col md:flex-row gap-8 items-start'>
        <nav className='md:sticky md:top-[calc(var(--nav-height)+24px)] w-full md:w-36 shrink-0'>
          <div className='flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0'>
            {sections.map(({ key, icon: Icon, navLabel }) => {
              const active = activeSection === key;
              return (
                <button
                  key={key}
                  type='button'
                  onClick={() => switchSection(key)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer border-0 text-left transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#F5F5F5] text-[#1A1A1A] font-medium'
                      : 'bg-transparent text-[#999] hover:bg-[#FAFAFA] hover:text-[#1A1A1A]'
                  }`}
                >
                  <Icon size={15} strokeWidth={1.5} />
                  {t(navLabel)}
                </button>
              );
            })}
          </div>
        </nav>

        <div className='flex-1 min-w-0 w-full'>
          <ActiveComponent />
        </div>
      </div>
    </div>
  );
};

export default Setting;
