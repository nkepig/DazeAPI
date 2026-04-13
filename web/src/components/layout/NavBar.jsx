import React, { useContext, useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Layers,
  KeyRound,
  FileText,
  Settings,
  LogOut,
  Home,
  Menu,
  X,
  Globe,
} from 'lucide-react';
import { UserContext } from '../../context/User';
import { isAdmin, isRoot, getSystemName } from '../../helpers';
import { updateAPI } from '../../helpers/api';
import { normalizeLanguage } from '../../i18n/language';

const navItems = [
  { key: 'dashboard', path: '/console/dashboard', icon: LayoutDashboard, label: '控制台' },
  { key: 'models', path: '/console/models', icon: Layers, label: '可用模型' },
  { key: 'apikeys', path: '/console/token', icon: KeyRound, label: 'API 密钥' },
  { key: 'logs', path: '/console/log', icon: FileText, label: '使用日志' },
];

const languages = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'fr', label: 'Français' },
  { code: 'ru', label: 'Русский' },
  { code: 'vi', label: 'Tiếng Việt' },
];

const NavBar = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [userState, userDispatch] = useContext(UserContext);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const dropdownRef = useRef(null);
  const langRef = useRef(null);
  const isLoggedIn = !!userState?.user;

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
      if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const activeKey = navItems.find((item) => location.pathname.startsWith(item.path))?.key;

  const handleLogout = async () => {
    setDropdownOpen(false);
    localStorage.removeItem('user');
    userDispatch({ type: 'logout' });
    updateAPI();
    navigate('/login');
  };

  const handleNavClick = (e) => {
    if (!isLoggedIn) {
      e.preventDefault();
      navigate('/login');
    }
  };

  const switchLang = (code) => {
    const normalized = normalizeLanguage(code) || code;
    i18n.changeLanguage(normalized);
    localStorage.setItem('i18nextLng', normalized);
    setLangOpen(false);
  };

  const activeLang = normalizeLanguage(i18n.language) || 'zh-CN';
  const currentLang = languages.find((l) => l.code === activeLang)?.label || '简体中文';
  const systemName = getSystemName();

  return (
    <nav className='fixed top-0 left-0 right-0 z-50 h-[var(--nav-height)] bg-white/80 backdrop-blur-lg'>
      <div className='h-full px-6 lg:px-10 flex items-center justify-between'>
        {/* Logo */}
        <Link to='/' className='flex items-center gap-3 no-underline shrink-0'>
          <span className='text-[18px] font-bold text-[#1A1A1A] leading-none'>{systemName}</span>
        </Link>

        {/* Desktop Nav */}
        <div className='hidden md:flex items-center gap-1'>
          <Link
            to='/login'
            className='relative px-4 py-2 text-sm font-medium rounded-lg no-underline transition-colors duration-150'
            style={{
              color: location.pathname === '/login' ? '#1A1A1A' : '#999',
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => { if (location.pathname !== '/login') e.currentTarget.style.backgroundColor = '#F5F5F5'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            {t('首页')}
            {location.pathname === '/login' && (
              <motion.div layoutId='nav-indicator' className='absolute bottom-0 left-3 right-3 h-[2px] bg-[#1A1A1A] rounded-full' transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
            )}
          </Link>
          {navItems.map((item) => {
            const isActive = isLoggedIn && activeKey === item.key;
            return (
              <Link
                key={item.key}
                to={item.path}
                onClick={handleNavClick}
                className='relative px-4 py-2 text-sm font-medium rounded-lg no-underline transition-colors duration-150'
                style={{
                  color: !isLoggedIn ? '#C8C8C8' : isActive ? '#1A1A1A' : '#999',
                  backgroundColor: 'transparent',
                  cursor: isLoggedIn ? 'pointer' : 'default',
                }}
                onMouseEnter={(e) => { if (isLoggedIn && !isActive) e.currentTarget.style.backgroundColor = '#F5F5F5'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {t(item.label)}
                {isActive && (
                  <motion.div
                    layoutId='nav-indicator'
                    className='absolute bottom-0 left-3 right-3 h-[2px] bg-[#1A1A1A] rounded-full'
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </Link>
            );
          })}
          {isLoggedIn && isAdmin() && (
            <Link
              to='/console/channel'
              className='relative px-4 py-2 text-sm font-medium rounded-lg no-underline transition-colors duration-150'
              style={{
                color: location.pathname.startsWith('/console/channel') ? '#1A1A1A' : '#999',
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => { if (!location.pathname.startsWith('/console/channel')) e.currentTarget.style.backgroundColor = '#F5F5F5'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {t('渠道管理')}
              {location.pathname.startsWith('/console/channel') && (
                <motion.div layoutId='nav-indicator' className='absolute bottom-0 left-3 right-3 h-[2px] bg-[#1A1A1A] rounded-full' transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
              )}
            </Link>
          )}
          {isLoggedIn && isAdmin() && (
            <Link
              to='/console/user'
              className='relative px-4 py-2 text-sm font-medium rounded-lg no-underline transition-colors duration-150'
              style={{
                color: location.pathname.startsWith('/console/user') ? '#1A1A1A' : '#999',
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => { if (!location.pathname.startsWith('/console/user')) e.currentTarget.style.backgroundColor = '#F5F5F5'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {t('用户管理')}
              {location.pathname.startsWith('/console/user') && (
                <motion.div layoutId='nav-indicator' className='absolute bottom-0 left-3 right-3 h-[2px] bg-[#1A1A1A] rounded-full' transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
              )}
            </Link>
          )}
        </div>

        {/* Right */}
        <div className='flex items-center gap-2 shrink-0'>
          {/* Language */}
          <div className='relative' ref={langRef}>
            <button
              onClick={() => setLangOpen(!langOpen)}
              className='hidden md:flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#999] rounded-lg cursor-pointer bg-transparent border-0 hover:bg-[#F5F5F5] hover:text-[#1A1A1A] transition-colors'
            >
              <Globe size={14} strokeWidth={1.5} />
              {currentLang}
            </button>
            {langOpen && (
              <div className='absolute right-0 top-10 w-40 bg-white rounded-xl border border-[#EBEBEB] shadow-lg py-1 z-50'>
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => switchLang(lang.code)}
                    className={`w-full text-left px-4 py-2 text-sm cursor-pointer bg-transparent border-0 transition-colors ${
                      activeLang === lang.code ? 'text-[#1A1A1A] font-medium bg-[#F5F5F5]' : 'text-[#999] hover:bg-[#F5F5F5] hover:text-[#1A1A1A]'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isLoggedIn ? (
            <>
              {/* User dropdown */}
              <div className='relative' ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className='hidden md:flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#1A1A1A] bg-transparent border border-[#EBEBEB] rounded-lg cursor-pointer hover:bg-[#F5F5F5] transition-colors'
                >
                  {(userState.user?.display_name || userState.user?.username || '').slice(0, 8)}
                </button>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className='md:hidden w-9 h-9 rounded-full bg-[#FAFAFA] border border-[#EBEBEB] flex items-center justify-center cursor-pointer hover:bg-[#F0F0F0] transition-colors text-[12px] font-semibold text-[#1A1A1A]'
                >
                  {(userState.user?.display_name || userState.user?.username || '').slice(0, 1).toUpperCase()}
                </button>
                {dropdownOpen && (
                  <div className='absolute right-0 top-12 w-48 bg-white rounded-xl border border-[#EBEBEB] shadow-lg py-1.5 z-50'>
                    <div className='px-4 py-2 border-b border-[#F0F0F0]'>
                      <p className='text-sm font-medium text-[#1A1A1A] truncate'>
                        {userState.user?.display_name || userState.user?.username}
                      </p>
                      <p className='text-xs text-[#999] truncate'>{userState.user?.email || ''}</p>
                    </div>
                    <Link
                      to='/console/personal'
                      onClick={() => setDropdownOpen(false)}
                      className='flex items-center gap-2 px-4 py-2.5 text-sm text-[#1A1A1A] no-underline hover:bg-[#F5F5F5] transition-colors'
                    >
                      <Settings size={15} strokeWidth={1.5} />
                      {t('个人设置')}
                    </Link>
                    {isRoot() && (
                      <Link
                        to='/console/setting'
                        onClick={() => setDropdownOpen(false)}
                        className='flex items-center gap-2 px-4 py-2.5 text-sm text-[#1A1A1A] no-underline hover:bg-[#F5F5F5] transition-colors'
                      >
                        <Settings size={15} strokeWidth={1.5} />
                        {t('运营设置')}
                      </Link>
                    )}
                    <div className='border-t border-[#F0F0F0] mt-1 pt-1'>
                      <button
                        onClick={handleLogout}
                        className='flex items-center gap-2 px-4 py-2.5 text-sm text-[#1A1A1A] w-full hover:bg-[#F5F5F5] transition-colors cursor-pointer bg-transparent border-0'
                      >
                        <LogOut size={15} strokeWidth={1.5} />
                        {t('退出登录')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                className='md:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F5F5F5] cursor-pointer bg-transparent border-0'
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
              </button>
            </>
          ) : (
            <div className='flex items-center gap-2'>
              <button
                className='md:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F5F5F5] cursor-pointer bg-transparent border-0'
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                <Menu size={20} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => {
                  if (location.pathname === '/login') {
                    window.dispatchEvent(new Event('login:open'));
                  } else {
                    navigate('/login?open=1');
                  }
                }}
                className='px-5 py-2 text-sm font-medium text-[#1A1A1A] bg-white border border-[#EBEBEB] rounded-lg no-underline hover:bg-[#F5F5F5] transition-colors cursor-pointer'
              >
                {t('登录')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className='md:hidden absolute top-[var(--nav-height)] left-0 right-0 bg-white border-b border-[#EBEBEB] shadow-lg py-2 px-4'
        >
          <Link
            to='/login'
            onClick={() => setMobileOpen(false)}
            className='flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium no-underline transition-colors'
            style={{
              color: location.pathname === '/login' ? '#1A1A1A' : '#999',
              backgroundColor: location.pathname === '/login' ? '#F5F5F5' : 'transparent',
            }}
          >
            <Home size={18} strokeWidth={1.5} />
            {t('首页')}
          </Link>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isLoggedIn && activeKey === item.key;
            return (
              <Link
                key={item.key}
                to={item.path}
                onClick={(e) => { handleNavClick(e); setMobileOpen(false); }}
                className='flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium no-underline transition-colors'
                style={{
                  color: !isLoggedIn ? '#C8C8C8' : isActive ? '#1A1A1A' : '#999',
                  backgroundColor: isActive ? '#F5F5F5' : 'transparent',
                }}
              >
                <Icon size={18} strokeWidth={1.5} />
                {t(item.label)}
              </Link>
            );
          })}
          {isLoggedIn && isAdmin() && (
            <>
              <div className='border-t border-[#F0F0F0] my-2' />
              <Link
                to='/console/channel'
                onClick={() => setMobileOpen(false)}
                className='flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-[#999] no-underline hover:bg-[#F5F5F5]'
              >
                {t('渠道管理')}
              </Link>
              <Link
                to='/console/user'
                onClick={() => setMobileOpen(false)}
                className='flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-[#999] no-underline hover:bg-[#F5F5F5]'
              >
                {t('用户管理')}
              </Link>
            </>
          )}
          {/* Mobile language */}
          <div className='border-t border-[#F0F0F0] my-2' />
          <div className='flex flex-wrap gap-2 px-4 py-2'>
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => { switchLang(lang.code); setMobileOpen(false); }}
                className={`px-3 py-1.5 text-xs rounded-full cursor-pointer border transition-colors ${
                  activeLang === lang.code
                    ? 'text-[#1A1A1A] font-medium border-[#1A1A1A] bg-white'
                    : 'text-[#999] border-[#EBEBEB] bg-white hover:bg-[#F5F5F5]'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </nav>
  );
};

export default NavBar;
