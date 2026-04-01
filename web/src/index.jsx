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
import en_GB from '@douyinfe/semi-ui/lib/es/locale/source/en_GB';

function SemiLocaleWrapper({ children }) {
  const { i18n } = useTranslation();
  const semiLocale = React.useMemo(
    () => ({ zh: zh_CN, en: en_GB })[i18n.language] || zh_CN,
    [i18n.language],
  );
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
