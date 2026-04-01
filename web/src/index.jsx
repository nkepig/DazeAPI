/*
Copyright (C) 2025 QuantumNous
*/

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@douyinfe/semi-ui/dist/css/semi.css';
import { UserProvider } from './context/User';
import 'react-toastify/dist/ReactToastify.css';
import { StatusProvider } from './context/Status';
import PageLayout from './components/layout/PageLayout';
import './i18n/i18n';
import './index.css';
import { LocaleProvider } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import zh_CN from '@douyinfe/semi-ui/lib/es/locale/source/zh_CN';
import zh_TW from '@douyinfe/semi-ui/lib/es/locale/source/zh_TW';
import en_GB from '@douyinfe/semi-ui/lib/es/locale/source/en_GB';
import ja_JP from '@douyinfe/semi-ui/lib/es/locale/source/ja_JP';
import fr from '@douyinfe/semi-ui/lib/es/locale/source/fr';
import ru_RU from '@douyinfe/semi-ui/lib/es/locale/source/ru_RU';
import vi_VN from '@douyinfe/semi-ui/lib/es/locale/source/vi_VN';
import { normalizeLanguage } from './i18n/language';

const semiLocaleByI18n = {
  'zh-CN': zh_CN,
  'zh-TW': zh_TW,
  en: en_GB,
  ja: ja_JP,
  fr,
  ru: ru_RU,
  vi: vi_VN,
};

function SemiLocaleWrapper({ children }) {
  const { i18n } = useTranslation();
  const semiLocale = React.useMemo(() => {
    const lang = normalizeLanguage(i18n.language) || 'zh-CN';
    return semiLocaleByI18n[lang] || zh_CN;
  }, [i18n.language]);
  return <LocaleProvider locale={semiLocale}>{children}</LocaleProvider>;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <StatusProvider>
      <UserProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <SemiLocaleWrapper>
            <PageLayout />
          </SemiLocaleWrapper>
        </BrowserRouter>
      </UserProvider>
    </StatusProvider>
  </React.StrictMode>,
);
