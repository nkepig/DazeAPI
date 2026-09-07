/*
Copyright (C) 2025 QuantumNous
*/

import React, { lazy, Suspense } from 'react';
import { Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { PrivateRoute, AdminRoute, RootRoute } from './helpers';
import NotFound from './pages/NotFound';
import SetupCheck from './components/layout/SetupCheck';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Models = lazy(() => import('./pages/Models'));
const TopUp = lazy(() => import('./components/topup'));
const Channel = lazy(() => import('./pages/Channel'));
const Token = lazy(() => import('./pages/Token'));
const Log = lazy(() => import('./pages/Log'));
const User = lazy(() => import('./pages/User'));
const Setting = lazy(() => import('./pages/Setting'));
const PersonalSetting = lazy(() => import('./components/settings/PersonalSetting'));
const PermissionManagement = lazy(() => import('./pages/Permission'));
const Setup = lazy(() => import('./pages/Setup'));
const RegisterForm = lazy(() => import('./components/auth/RegisterForm'));
const LoginForm = lazy(() => import('./components/auth/LoginForm'));
const PasswordResetForm = lazy(() => import('./components/auth/PasswordResetForm'));
const PasswordResetConfirm = lazy(() => import('./components/auth/PasswordResetConfirm'));
const UserAgreement = lazy(() => import('./pages/UserAgreement'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));

function PageAwait() {
  return <div className='page-await-screen' aria-busy='true' aria-live='polite' />;
}

// iOS navigation: slight push, then settle.
const PAGE_EASE = [0.32, 0.72, 0, 1];

function AppRoutes() {
  const location = useLocation();
  return (
    <div className='relative overflow-x-hidden'>
      <AnimatePresence initial={false}>
        <motion.div
          key={location.pathname}
          className='w-full'
          initial={{ opacity: 0, x: 22 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{
            opacity: 0,
            x: -14,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
          transition={{ duration: 0.34, ease: PAGE_EASE }}
        >
        <Routes location={location}>
          <Route path='/' element={<Navigate to='/console/dashboard' replace />} />
          <Route path='/setup' element={<Setup />} />
          <Route
            path='/console/dashboard'
            element={<PrivateRoute><Dashboard /></PrivateRoute>}
          />
          <Route
            path='/console/models'
            element={<PrivateRoute><Models /></PrivateRoute>}
          />
          <Route path='/console/channel' element={<AdminRoute><Channel /></AdminRoute>} />
          <Route path='/console/user' element={<AdminRoute><User /></AdminRoute>} />
          <Route
            path='/console/permission'
            element={<RootRoute><PermissionManagement /></RootRoute>}
          />
          <Route path='/console/token' element={<PrivateRoute><Token /></PrivateRoute>} />
          <Route path='/console/log' element={<PrivateRoute><Log /></PrivateRoute>} />
          <Route
            path='/console/setting'
            element={<AdminRoute><Setting /></AdminRoute>}
          />
          <Route
            path='/console/personal'
            element={<PrivateRoute><PersonalSetting /></PrivateRoute>}
          />
          <Route
            path='/console/topup'
            element={<PrivateRoute><TopUp /></PrivateRoute>}
          />
          <Route path='/user/reset' element={<PasswordResetConfirm />} />
          <Route path='/login' element={<LoginForm />} />
          <Route path='/register' element={<RegisterForm />} />
          <Route path='/reset' element={<PasswordResetForm />} />
          <Route path='/user-agreement' element={<UserAgreement />} />
          <Route path='/privacy-policy' element={<PrivacyPolicy />} />
          <Route path='*' element={<NotFound />} />
        </Routes>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function App() {
  return (
    <SetupCheck>
      <Suspense fallback={<PageAwait />}>
        <AppRoutes />
      </Suspense>
    </SetupCheck>
  );
}

export default App;
