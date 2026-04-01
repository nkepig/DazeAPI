import React, { useContext, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ToastContainer } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import NavBar from './NavBar';
import App from '../../App';
import {
  API,
  getLogo,
  getSystemName,
  showError,
  setStatusData,
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

  const loadStatus = async () => {
    try {
      const res = await API.get('/api/status');
      const { success, data } = res.data;
      if (success) {
        statusDispatch({ type: 'set', payload: data });
        setStatusData(data);
      } else {
        showError('Unable to connect to server');
      }
    } catch (error) {
      showError('Failed to load status');
    }
  };

  useEffect(() => {
    loadUser();
    loadStatus().catch(console.error);
    const systemName = getSystemName();
    if (systemName) document.title = systemName;
    const logo = getLogo();
    if (logo) {
      const linkEl = document.querySelector("link[rel~='icon']");
      if (linkEl) linkEl.href = logo;
    }
  }, []);

  useEffect(() => {
    let preferredLang;
    if (userState?.user?.setting) {
      try {
        const settings = JSON.parse(userState.user.setting);
        preferredLang = normalizeLanguage(settings.language);
      } catch (e) {}
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
          <AnimatePresence mode='wait'>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <App />
            </motion.div>
          </AnimatePresence>
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
