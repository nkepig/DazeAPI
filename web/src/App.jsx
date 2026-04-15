/*
Copyright (C) 2025 QuantumNous
*/

import React, { lazy, Suspense } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { PrivateRoute, AdminRoute } from './helpers';
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
const Setup = lazy(() => import('./pages/Setup'));
const RegisterForm = lazy(() => import('./components/auth/RegisterForm'));
const LoginForm = lazy(() => import('./components/auth/LoginForm'));
const PasswordResetForm = lazy(() => import('./components/auth/PasswordResetForm'));
const PasswordResetConfirm = lazy(() => import('./components/auth/PasswordResetConfirm'));

function Loading() {
  return (
    <div className='flex items-center justify-center min-h-[60vh]'>
      <div className='w-6 h-6 border-2 border-[#C8C8C8] border-t-[#1A1A1A] rounded-full animate-spin' />
    </div>
  );
}

function App() {
  return (
    <SetupCheck>
      <Routes>
        <Route path='/' element={<Navigate to='/console/dashboard' replace />} />
        <Route path='/setup' element={<Suspense fallback={<Loading />}><Setup /></Suspense>} />
        <Route
          path='/console/dashboard'
          element={<PrivateRoute><Suspense fallback={<Loading />}><Dashboard /></Suspense></PrivateRoute>}
        />
        <Route
          path='/console/models'
          element={<PrivateRoute><Suspense fallback={<Loading />}><Models /></Suspense></PrivateRoute>}
        />
        <Route path='/console/channel' element={<AdminRoute><Suspense fallback={<Loading />}><Channel /></Suspense></AdminRoute>} />
        <Route path='/console/user' element={<AdminRoute><Suspense fallback={<Loading />}><User /></Suspense></AdminRoute>} />
        <Route path='/console/token' element={<PrivateRoute><Suspense fallback={<Loading />}><Token /></Suspense></PrivateRoute>} />
        <Route path='/console/log' element={<PrivateRoute><Suspense fallback={<Loading />}><Log /></Suspense></PrivateRoute>} />
        <Route
          path='/console/setting'
          element={<AdminRoute><Suspense fallback={<Loading />}><Setting /></Suspense></AdminRoute>}
        />
        <Route
          path='/console/personal'
          element={<PrivateRoute><Suspense fallback={<Loading />}><PersonalSetting /></Suspense></PrivateRoute>}
        />
        <Route
          path='/console/topup'
          element={<PrivateRoute><Suspense fallback={<Loading />}><TopUp /></Suspense></PrivateRoute>}
        />
        <Route path='/user/reset' element={<Suspense fallback={<Loading />}><PasswordResetConfirm /></Suspense>} />
        <Route path='/login' element={<Suspense fallback={<Loading />}><LoginForm /></Suspense>} />
        <Route path='/register' element={<Suspense fallback={<Loading />}><RegisterForm /></Suspense>} />
        <Route path='/reset' element={<Suspense fallback={<Loading />}><PasswordResetForm /></Suspense>} />
        <Route path='*' element={<NotFound />} />
      </Routes>
    </SetupCheck>
  );
}

export default App;
