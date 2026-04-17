import React, { useContext, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import NavBar from './NavBar';
import App from '../../App';
import {
  API,
  getSystemName,
  showError,
  setStatusData,
  setUserData,
} from '../../helpers';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import { normalizeLanguage } from '../../i18n/language';

const FULLSCREEN_ROUTES = ['/register', '/reset'];

const PageLayout = () => {
  const [userState, userDispatch] = useContext(UserContext);
  const [, statusDispatch] = useContext(StatusContext);
  const { i18n } = useTranslation();
  const location = useLocation();
  const isFullscreen = FULLSCREEN_ROUTES.some((r) => location.pathname === r || location.pathname.startsWith(r + '/'));

  const loadUser = () => {
    let user = localStorage.getItem('user');
    if (user) {
      userDispatch({ type: 'login', payload: JSON.parse(user) });
    }
  };

  const refreshUser = async () => {
    if (!localStorage.getItem('user')) return;
    try {
      const res = await API.get('/api/user/self');
      const { success, data } = res.data;
      if (success) {
        userDispatch({ type: 'login', payload: data });
        setUserData(data);
      }
    } catch {
      // Session may be expired; keep cached data for now
    }
  };

  const loadStatus = async () => {
    try {
      const res = await API.get('/api/status');
      const { success, data } = res.data;
if (success) {
        statusDispatch({ type: 'set', payload: data });
        setStatusData(data);
        document.title = getSystemName();
      } else {
        showError('Unable to connect to server');
      }
    } catch (error) {
      showError('Failed to load status');
    }
  };

  useEffect(() => {
    loadUser();
    const systemName = getSystemName();
    if (systemName) document.title = systemName;
    loadStatus().catch(console.error);
    refreshUser();
  }, []);

  useEffect(() => {
    let preferredLang;
    if (userState?.user?.setting) {
      try {
        const settings = JSON.parse(userState.user.setting);
        preferredLang = normalizeLanguage(settings.language);
      } catch (e) { /* invalid user settings JSON, fallback to default */ }
    }
    if (!preferredLang) {
      const savedLang = localStorage.getItem('i18nextLng');
      if (savedLang) preferredLang = normalizeLanguage(savedLang);
    }
    if (preferredLang) {
      localStorage.setItem('i18nextLng', preferredLang);
      if (preferredLang !== i18n.language) i18n.changeLanguage(preferredLang);
    }
  }, [i18n, userState?.user?.setting]);

  if (isFullscreen) {
    return (
      <div className='bg-white'>
        <App />
        <ToastContainer
          position='top-right'
          autoClose={3000}
          hideProgressBar
          newestOnTop
          closeOnClick
        />
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-white'>
      <NavBar />
      <main className='pt-[var(--nav-height)]'>
        <div className='max-w-[1400px] mx-auto'>
          {/* 勿用 key=pathname + AnimatePresence mode=wait 包裹 App：会整树卸载路由并易出现切换白屏 */}
          <App />
        </div>
      </main>
      <ToastContainer
        position='top-right'
        autoClose={3000}
        hideProgressBar
        newestOnTop
        closeOnClick
      />
    </div>
  );
};

export default PageLayout;
