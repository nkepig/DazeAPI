/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import {
  API,
  getLogo,
  showError,
  showInfo,
  showSuccess,
  updateAPI,
  getSystemName,
  getOAuthProviderIcon,
  setUserData,
  onGitHubOAuthClicked,
  onDiscordOAuthClicked,
  onOIDCClicked,
  onLinuxDOOAuthClicked,
  onCustomOAuthClicked,
  prepareCredentialRequestOptions,
  buildAssertionResult,
  isPasskeySupported,
} from '../../helpers';
import Turnstile from 'react-turnstile';
import {
  Button,
  Checkbox,
  Divider,
  Form,
  Icon,
  Modal,
} from '@douyinfe/semi-ui';
import Text from '@douyinfe/semi-ui/lib/es/typography/text';
import TelegramLoginButton from 'react-telegram-login';
import {
  IconGithubLogo,
  IconMail,
  IconLock,
  IconKey,
} from '@douyinfe/semi-icons';
import OIDCIcon from '../common/logo/OIDCIcon';
import WeChatIcon from '../common/logo/WeChatIcon';
import LinuxDoIcon from '../common/logo/LinuxDoIcon';
import TwoFAVerification from './TwoFAVerification';
import { useTranslation } from 'react-i18next';
import { SiDiscord } from 'react-icons/si';
import { AnimatePresence, motion } from 'framer-motion';

const METRICS = [
  { label: 'UPTIME', value: '99.97%', style: { top: '8%', left: '6%' } },
  { label: 'RESPONSE_TIME', value: '8ms', style: { top: '14%', right: '8%' } },
  { label: 'THROUGHPUT', value: '12K/RPS', style: { bottom: '18%', left: '7%' } },
  { label: 'ACCURACY', value: '99.1%', style: { bottom: '10%', right: '6%' } },
  { label: 'CACHE_HIT', value: '94.2%', style: { top: '40%', left: '4%' } },
  { label: 'QUALITY_SCORE', value: '98.6%', style: { top: '36%', right: '4%' } },
  { label: 'BUILD', value: 'STABLE', style: { top: '4%', left: '44%' } },
  { label: 'OPTIMIZATION', value: 'ENABLED', style: { bottom: '5%', left: '50%' } },
  { label: 'EFFECT_RATE', value: '97.3%', style: { bottom: '28%', right: '20%', opacity: 0.5 } },
  { label: 'HEALTH_CHECK', value: 'PASSING', style: { top: '24%', right: '20%', opacity: 0.5 } },
  { label: 'PERFORMANCE', value: 'OPTIMAL', style: { bottom: '35%', left: '18%', opacity: 0.5 } },
  { label: 'MAINTENANCE', value: 'SCHEDULED', style: { top: '22%', left: '22%', opacity: 0.5 } },
];

const LoginForm = () => {
  let navigate = useNavigate();
  const { t } = useTranslation();
  const canvasRef = useRef(null);
  const metricsRef = useRef([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const logoRef = useRef(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('oauth');

  const githubButtonTextKeyByState = {
    idle: '使用 GitHub 继续',
    redirecting: '正在跳转 GitHub...',
    timeout: '请求超时，请刷新页面后重新发起 GitHub 登录',
  };
  const [inputs, setInputs] = useState({
    username: '',
    password: '',
    wechat_verification_code: '',
  });
  const { username, password } = inputs;
  const [searchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [showWeChatLoginModal, setShowWeChatLoginModal] = useState(false);
  const [wechatLoading, setWechatLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [oidcLoading, setOidcLoading] = useState(false);
  const [linuxdoLoading, setLinuxdoLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [wechatCodeSubmitLoading, setWechatCodeSubmitLoading] = useState(false);
  const [showTwoFA, setShowTwoFA] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [hasUserAgreement, setHasUserAgreement] = useState(false);
  const [hasPrivacyPolicy, setHasPrivacyPolicy] = useState(false);
  const [githubButtonState, setGithubButtonState] = useState('idle');
  const [githubButtonDisabled, setGithubButtonDisabled] = useState(false);
  const githubTimeoutRef = useRef(null);
  const githubButtonText = t(githubButtonTextKeyByState[githubButtonState]);
  const [customOAuthLoading, setCustomOAuthLoading] = useState({});

  const status = useMemo(() => {
    if (statusState?.status) return statusState.status;
    const savedStatus = localStorage.getItem('status');
    if (!savedStatus) return {};
    try { return JSON.parse(savedStatus) || {}; } catch { return {}; }
  }, [statusState?.status]);

  const hasCustomOAuthProviders = (status.custom_oauth_providers || []).length > 0;
  const hasOAuthLoginOptions = Boolean(
    status.github_oauth || status.discord_oauth || status.oidc_enabled ||
    status.wechat_login || status.linuxdo_oauth || status.telegram_oauth || hasCustomOAuthProviders,
  );

  // Canvas data stream
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, drops = [];
    const chars = 'DAZEAI_v2.0_API_DATA_SYNC_1010101';
    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      drops = Array(Math.floor(w / 20)).fill(1);
    };
    const draw = () => {
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(0, 0, w, h);
      ctx.font = '12px monospace';
      ctx.fillStyle = '#000';
      drops.forEach((y, i) => {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(ch, i * 20, y * 20);
        if (y * 20 > h && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      });
    };
    resize();
    const timer = setInterval(draw, 50);
    window.addEventListener('resize', resize);
    return () => { clearInterval(timer); window.removeEventListener('resize', resize); };
  }, []);

  // Mouse tracking for logo parallax + metric push
  useEffect(() => {
    const onMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      if (logoRef.current) {
        const mx = (e.clientX - window.innerWidth / 2) / 25;
        const my = (e.clientY - window.innerHeight / 2) / 25;
        logoRef.current.style.transform = `perspective(1000px) rotateX(${-my}deg) rotateY(${mx}deg)`;
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Metric push animation
  useEffect(() => {
    let raf;
    const update = () => {
      const m = mouseRef.current;
      metricsRef.current.forEach((el) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dist = Math.hypot(m.x - cx, m.y - cy);
        if (dist < 180) {
          const angle = Math.atan2(m.y - cy, m.x - cx);
          const push = (180 - dist) * 0.4;
          el.style.transform = `translate(${-Math.cos(angle) * push}px, ${-Math.sin(angle) * push}px) scale(1.08)`;
          el.style.zIndex = '100';
        } else {
          el.style.transform = '';
          el.style.zIndex = '50';
        }
      });
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (status?.turnstile_check) { setTurnstileEnabled(true); setTurnstileSiteKey(status.turnstile_site_key); }
    setHasUserAgreement(status?.user_agreement_enabled || false);
    setHasPrivacyPolicy(status?.privacy_policy_enabled || false);
  }, [status]);

  useEffect(() => {
    isPasskeySupported().then(setPasskeySupported).catch(() => setPasskeySupported(false));
    return () => { if (githubTimeoutRef.current) clearTimeout(githubTimeoutRef.current); };
  }, []);

  useEffect(() => {
    if (searchParams.get('expired')) showError(t('未登录或登录已过期，请重新登录'));
    if (searchParams.get('open') === '1') {
      setShowForm(true);
      setFormMode('email');
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      setShowForm(true);
      setFormMode('email');
    };
    window.addEventListener('login:open', handler);
    return () => window.removeEventListener('login:open', handler);
  }, []);

  // Auto-show form if no OAuth
  useEffect(() => {
    if (!hasOAuthLoginOptions) setFormMode('email');
  }, [hasOAuthLoginOptions]);

  let affCode = new URLSearchParams(window.location.search).get('aff');
  if (affCode) localStorage.setItem('aff', affCode);

  function handleChange(name, value) { setInputs((p) => ({ ...p, [name]: value })); }

  const requireTerms = (fn) => (...args) => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) {
      showInfo(t('请先阅读并同意用户协议和隐私政策'));
      return;
    }
    return fn(...args);
  };

  async function handleSubmit() {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) { showInfo(t('请先阅读并同意用户协议和隐私政策')); return; }
    if (turnstileEnabled && !turnstileToken) { showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！'); return; }
    setSubmitted(true); setLoginLoading(true);
    try {
      if (username && password) {
        const res = await API.post(`/api/user/login?turnstile=${turnstileToken}`, { username, password });
        const { success, message, data } = res.data;
        if (success) {
          if (data?.require_2fa) { setShowTwoFA(true); setLoginLoading(false); return; }
          userDispatch({ type: 'login', payload: data }); setUserData(data); updateAPI();
          showSuccess('登录成功！');
          if (username === 'root' && password === '123456') Modal.error({ title: '您正在使用默认密码！', content: '请立刻修改默认密码！', centered: true });
          navigate('/console/dashboard');
        } else showError(message);
      } else showError('请输入用户名和密码！');
    } catch { showError('登录失败，请重试'); }
    finally { setLoginLoading(false); }
  }

  const onWeChatLoginClicked = requireTerms(() => { setWechatLoading(true); setShowWeChatLoginModal(true); setWechatLoading(false); });
  const onSubmitWeChatVerificationCode = async () => {
    if (turnstileEnabled && !turnstileToken) { showInfo('请稍后几秒重试'); return; }
    setWechatCodeSubmitLoading(true);
    try {
      const res = await API.get(`/api/oauth/wechat?code=${inputs.wechat_verification_code}`);
      const { success, message, data } = res.data;
      if (success) { userDispatch({ type: 'login', payload: data }); localStorage.setItem('user', JSON.stringify(data)); setUserData(data); updateAPI(); navigate('/'); showSuccess('登录成功！'); setShowWeChatLoginModal(false); }
      else showError(message);
    } catch { showError('登录失败，请重试'); }
    finally { setWechatCodeSubmitLoading(false); }
  };

  const onTelegramLoginClicked = async (response) => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) { showInfo(t('请先阅读并同意用户协议和隐私政策')); return; }
    const fields = ['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date', 'hash', 'lang'];
    const params = {}; fields.forEach((f) => { if (response[f]) params[f] = response[f]; });
    try {
      const res = await API.get('/api/oauth/telegram/login', { params });
      const { success, message, data } = res.data;
      if (success) { userDispatch({ type: 'login', payload: data }); localStorage.setItem('user', JSON.stringify(data)); showSuccess('登录成功！'); setUserData(data); updateAPI(); navigate('/'); }
      else showError(message);
    } catch { showError('登录失败，请重试'); }
  };

  const handleGitHubClick = requireTerms(() => {
    if (githubButtonDisabled) return;
    setGithubLoading(true); setGithubButtonDisabled(true); setGithubButtonState('redirecting');
    if (githubTimeoutRef.current) clearTimeout(githubTimeoutRef.current);
    githubTimeoutRef.current = setTimeout(() => { setGithubLoading(false); setGithubButtonState('timeout'); setGithubButtonDisabled(true); }, 20000);
    try { onGitHubOAuthClicked(status.github_client_id, { shouldLogout: true }); } finally { setTimeout(() => setGithubLoading(false), 3000); }
  });
  const handleDiscordClick = requireTerms(() => { setDiscordLoading(true); try { onDiscordOAuthClicked(status.discord_client_id, { shouldLogout: true }); } finally { setTimeout(() => setDiscordLoading(false), 3000); } });
  const handleOIDCClick = requireTerms(() => { setOidcLoading(true); try { onOIDCClicked(status.oidc_authorization_endpoint, status.oidc_client_id, false, { shouldLogout: true }); } finally { setTimeout(() => setOidcLoading(false), 3000); } });
  const handleLinuxDOClick = requireTerms(() => { setLinuxdoLoading(true); try { onLinuxDOOAuthClicked(status.linuxdo_client_id, { shouldLogout: true }); } finally { setTimeout(() => setLinuxdoLoading(false), 3000); } });
  const handleCustomOAuthClick = requireTerms((provider) => { setCustomOAuthLoading((p) => ({ ...p, [provider.slug]: true })); try { onCustomOAuthClicked(provider, { shouldLogout: true }); } finally { setTimeout(() => setCustomOAuthLoading((p) => ({ ...p, [provider.slug]: false })), 3000); } });

  const handlePasskeyLogin = requireTerms(async () => {
    if (!passkeySupported || !window.PublicKeyCredential) { showInfo('当前环境无法使用 Passkey 登录'); return; }
    setPasskeyLoading(true);
    try {
      const beginRes = await API.post('/api/user/passkey/login/begin');
      const { success, message, data } = beginRes.data;
      if (!success) { showError(message || '无法发起 Passkey 登录'); return; }
      const publicKeyOptions = prepareCredentialRequestOptions(data?.options || data?.publicKey || data);
      const assertion = await navigator.credentials.get({ publicKey: publicKeyOptions });
      const payload = buildAssertionResult(assertion);
      if (!payload) { showError('Passkey 验证失败'); return; }
      const finishRes = await API.post('/api/user/passkey/login/finish', payload);
      if (finishRes.data.success) { userDispatch({ type: 'login', payload: finishRes.data.data }); setUserData(finishRes.data.data); updateAPI(); showSuccess('登录成功！'); navigate('/console/dashboard'); }
      else showError(finishRes.data.message || 'Passkey 登录失败');
    } catch (e) { if (e?.name === 'AbortError') showInfo('已取消 Passkey 登录'); else showError('Passkey 登录失败，请重试'); }
    finally { setPasskeyLoading(false); }
  });

  const handle2FASuccess = (data) => { userDispatch({ type: 'login', payload: data }); setUserData(data); updateAPI(); showSuccess('登录成功！'); navigate('/console/dashboard'); };
  const handleBackToLogin = () => { setShowTwoFA(false); setInputs({ username: '', password: '', wechat_verification_code: '' }); };

  const oauthBtnClass = 'w-full h-11 flex items-center justify-center !rounded-lg !border-[#E0E0E0] hover:!bg-[#F8F8F8] transition-colors';

  const renderTermsCheckbox = () => (
    (hasUserAgreement || hasPrivacyPolicy) && (
      <div className='mt-4'>
        <Checkbox checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)}>
          <Text size='small' className='!text-[#999]'>
            {t('我已阅读并同意')}
            {hasUserAgreement && <a href='/user-agreement' target='_blank' rel='noopener noreferrer' className='text-[#1A1A1A] hover:underline mx-1'>{t('用户协议')}</a>}
            {hasUserAgreement && hasPrivacyPolicy && t('和')}
            {hasPrivacyPolicy && <a href='/privacy-policy' target='_blank' rel='noopener noreferrer' className='text-[#1A1A1A] hover:underline mx-1'>{t('隐私政策')}</a>}
          </Text>
        </Checkbox>
      </div>
    )
  );

  const renderOAuthButtons = () => (
    <div className='space-y-2.5'>
      {status.github_oauth && <Button theme='outline' className={oauthBtnClass} type='tertiary' icon={<IconGithubLogo size='large' />} onClick={handleGitHubClick} loading={githubLoading} disabled={githubButtonDisabled}><span className='ml-2 text-[13px]'>{githubButtonText}</span></Button>}
      {status.wechat_login && <Button theme='outline' className={oauthBtnClass} type='tertiary' icon={<Icon svg={<WeChatIcon />} style={{ color: '#07C160' }} />} onClick={onWeChatLoginClicked} loading={wechatLoading}><span className='ml-2 text-[13px]'>{t('使用 微信 继续')}</span></Button>}
      {status.discord_oauth && <Button theme='outline' className={oauthBtnClass} type='tertiary' icon={<SiDiscord style={{ color: '#5865F2', width: 20, height: 20 }} />} onClick={handleDiscordClick} loading={discordLoading}><span className='ml-2 text-[13px]'>{t('使用 Discord 继续')}</span></Button>}
      {status.oidc_enabled && <Button theme='outline' className={oauthBtnClass} type='tertiary' icon={<OIDCIcon style={{ color: '#1877F2' }} />} onClick={handleOIDCClick} loading={oidcLoading}><span className='ml-2 text-[13px]'>{t('使用 OIDC 继续')}</span></Button>}
      {status.linuxdo_oauth && <Button theme='outline' className={oauthBtnClass} type='tertiary' icon={<LinuxDoIcon style={{ color: '#E95420', width: 20, height: 20 }} />} onClick={handleLinuxDOClick} loading={linuxdoLoading}><span className='ml-2 text-[13px]'>{t('使用 LinuxDO 继续')}</span></Button>}
      {status.custom_oauth_providers?.map((p) => <Button key={p.slug} theme='outline' className={oauthBtnClass} type='tertiary' icon={getOAuthProviderIcon(p.icon || '', 20)} onClick={() => handleCustomOAuthClick(p)} loading={customOAuthLoading[p.slug]}><span className='ml-2 text-[13px]'>{t('使用 {{name}} 继续', { name: p.name })}</span></Button>)}
      {status.telegram_oauth && <div className='flex justify-center my-2'><TelegramLoginButton dataOnauth={onTelegramLoginClicked} botName={status.telegram_bot_name} /></div>}
      {status.passkey_login && passkeySupported && <Button theme='outline' className={oauthBtnClass} type='tertiary' icon={<IconKey size='large' />} onClick={handlePasskeyLogin} loading={passkeyLoading}><span className='ml-2 text-[13px]'>{t('使用 Passkey 登录')}</span></Button>}
    </div>
  );

  return (
    <div className='auth-terminal-root'>
      <canvas ref={canvasRef} className='auth-data-canvas' />

      <div className='auth-metrics-cloud'>
        {METRICS.map((m, i) => (
          <div key={i} ref={(el) => (metricsRef.current[i] = el)} className='auth-metric-item' style={m.style}>
            <span>{m.label}</span>
            <strong>{m.value}</strong>
          </div>
        ))}
      </div>

      {/* Landing hero */}
      <div className='auth-content-overlay'>
        <div ref={logoRef} className='auth-glitch-logo' data-text='DazeAI'>DazeAI</div>
        <p className='auth-tagline'>MULTI-MODEL API AGGREGATION PLATFORM</p>
        <nav className='auth-button-matrix'>
          <button className='auth-neo-btn auth-btn-outline' onClick={() => { setShowForm(true); setFormMode(hasOAuthLoginOptions ? 'oauth' : 'email'); }}>
            Get Started
          </button>
          <a href='/docs' className='auth-neo-btn auth-btn-ghost'>View Docs</a>
        </nav>
      </div>

      {/* Login Dialog */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            className='fixed inset-0 z-[200] flex items-center justify-center'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className='absolute inset-0 bg-white/60 backdrop-blur-sm' onClick={() => setShowForm(false)} />
            <motion.div
              className='auth-dialog-card'
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <div className='text-center mb-6'>
                <h2 className='text-[18px] font-bold text-[#1A1A1A]'>{t('登录')}</h2>
                <p className='text-[12px] text-[#BBB] mt-1'>Welcome!</p>
              </div>

              {formMode === 'oauth' ? (
                <>
                  {renderOAuthButtons()}
                  <Divider margin='16px' align='center'><span className='text-[11px] text-[#CCC]'>{t('或')}</span></Divider>
                  <button
                    className='w-full py-2.5 text-[13px] font-medium text-[#1A1A1A] border border-[#E0E0E0] rounded-lg bg-white hover:bg-[#F8F8F8] transition-colors cursor-pointer'
                    onClick={() => setFormMode('email')}
                  >{t('使用 邮箱或用户名 登录')}</button>
                </>
              ) : (
                <>
                  {status.passkey_login && passkeySupported && (
                    <Button theme='outline' type='tertiary' className={oauthBtnClass + ' mb-3'} icon={<IconKey size='large' />} onClick={handlePasskeyLogin} loading={passkeyLoading}>
                      <span className='ml-2 text-[13px]'>{t('使用 Passkey 登录')}</span>
                    </Button>
                  )}
                  <Form className='space-y-1'>
                    <Form.Input field='username' label={t('用户名/邮箱')} placeholder={t('用户名/邮箱')} name='username' onChange={(v) => handleChange('username', v)} prefix={<IconMail />} />
                    <Form.Input field='password' label={t('密码')} placeholder={t('密码')} name='password' mode='password' onChange={(v) => handleChange('password', v)} prefix={<IconLock />} />
                  </Form>

                  {renderTermsCheckbox()}

                  <div className='mt-4 space-y-2'>
                    <button
                      className='w-full py-2.5 text-[13px] font-semibold text-[#1A1A1A] border border-[#E0E0E0] rounded-lg bg-white hover:bg-[#F8F8F8] transition-colors cursor-pointer disabled:opacity-40'
                      onClick={handleSubmit}
                      disabled={loginLoading || ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms)}
                    >{loginLoading ? '...' : t('登录')}</button>
                  </div>

                  <div className='flex items-center justify-between mt-4 text-[12px]'>
                    <Link to='/register' className='text-[#1A1A1A] hover:underline no-underline font-medium'>{t('注册')}</Link>
                    <Link to='/reset' className='text-[#999] hover:text-[#1A1A1A] hover:underline no-underline'>{t('忘记密码')}</Link>
                  </div>

                  {hasOAuthLoginOptions && (
                    <>
                      <Divider margin='16px' align='center'><span className='text-[11px] text-[#CCC]'>{t('或')}</span></Divider>
                      <button
                        className='w-full py-2 text-[12px] text-[#999] bg-white border border-[#EBEBEB] rounded-lg hover:bg-[#F8F8F8] transition-colors cursor-pointer'
                        onClick={() => setFormMode('oauth')}
                      >{t('其他登录选项')}</button>
                    </>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WeChat Modal */}
      <Modal title={t('微信扫码登录')} visible={showWeChatLoginModal} maskClosable onOk={onSubmitWeChatVerificationCode} onCancel={() => setShowWeChatLoginModal(false)} okText={t('登录')} centered okButtonProps={{ loading: wechatCodeSubmitLoading }}>
        <div className='flex flex-col items-center'><img src={status.wechat_qrcode} alt='' className='mb-4' /></div>
        <p className='text-center mb-4 text-sm'>{t('微信扫码关注公众号，输入「验证码」获取验证码（三分钟内有效）')}</p>
        <Form><Form.Input field='wechat_verification_code' placeholder={t('验证码')} label={t('验证码')} value={inputs.wechat_verification_code} onChange={(v) => handleChange('wechat_verification_code', v)} /></Form>
      </Modal>

      {/* 2FA Modal */}
      <Modal title='两步验证' visible={showTwoFA} onCancel={handleBackToLogin} footer={null} width={450} centered>
        <TwoFAVerification onSuccess={handle2FASuccess} onBack={handleBackToLogin} isModal />
      </Modal>

      {turnstileEnabled && (
        <div className='fixed bottom-4 left-1/2 -translate-x-1/2 z-[300]'>
          <Turnstile sitekey={turnstileSiteKey} onVerify={(token) => setTurnstileToken(token)} />
        </div>
      )}
    </div>
  );
};

export default LoginForm;
