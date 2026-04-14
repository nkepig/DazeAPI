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
import { Link, useNavigate } from 'react-router-dom';
import {
  API, getLogo, showError, showInfo, showSuccess, updateAPI, getSystemName,
  getOAuthProviderIcon, setUserData, onDiscordOAuthClicked, onCustomOAuthClicked,
  onGitHubOAuthClicked, onLinuxDOOAuthClicked, onOIDCClicked,
} from '../../helpers';
import Turnstile from 'react-turnstile';
import { Button, Checkbox, Divider, Form, Icon, Modal } from '@douyinfe/semi-ui';
import Text from '@douyinfe/semi-ui/lib/es/typography/text';
import { IconGithubLogo, IconMail, IconUser, IconLock, IconKey } from '@douyinfe/semi-icons';
import OIDCIcon from '../common/logo/OIDCIcon';
import LinuxDoIcon from '../common/logo/LinuxDoIcon';
import WeChatIcon from '../common/logo/WeChatIcon';
import TelegramLoginButton from 'react-telegram-login/src';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import { useTranslation } from 'react-i18next';
import { SiDiscord } from 'react-icons/si';

const ALLOWED_EMAIL_DOMAINS = [
  'gmail.com',
  'qq.com',
  '163.com',
  '126.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'foxmail.com',
  'icloud.com',
  'me.com',
  'live.com',
  'msn.com',
  'yeah.net',
  'aliyun.com',
  'sina.com',
  'sohu.com',
];

const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return { valid: false, message: '请输入邮箱' };
  }
  
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return { valid: false, message: '邮箱格式不正确' };
  }
  
  const domain = email.split('@')[1]?.toLowerCase();
  if (!ALLOWED_EMAIL_DOMAINS.includes(domain)) {
    return { valid: false, message: '邮箱域名不在白名单中' };
  }
  
  return { valid: true, message: '' };
};

const RegisterForm = () => {
  let navigate = useNavigate();
  const { t } = useTranslation();
  const canvasRef = useRef(null);

  const [inputs, setInputs] = useState({ username: '', password: '', password2: '', email: '', verification_code: '', wechat_verification_code: '' });
  const { username, password, password2 } = inputs;
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [showWeChatLoginModal, setShowWeChatLoginModal] = useState(false);
  const [formMode, setFormMode] = useState('email');
  const [wechatLoading, setWechatLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [oidcLoading, setOidcLoading] = useState(false);
  const [linuxdoLoading, setLinuxdoLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [verificationCodeLoading, setVerificationCodeLoading] = useState(false);
  const [wechatCodeSubmitLoading, setWechatCodeSubmitLoading] = useState(false);
  const [customOAuthLoading, setCustomOAuthLoading] = useState({});
  const [disableButton, setDisableButton] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [hasUserAgreement, setHasUserAgreement] = useState(false);
  const [hasPrivacyPolicy, setHasPrivacyPolicy] = useState(false);
  const [githubButtonState, setGithubButtonState] = useState('idle');
  const [githubButtonDisabled, setGithubButtonDisabled] = useState(false);
  const githubTimeoutRef = useRef(null);
  const githubButtonText = t({ idle: '使用 GitHub 继续', redirecting: '正在跳转 GitHub...', timeout: '请求超时' }[githubButtonState]);

  const status = useMemo(() => {
    if (statusState?.status) return statusState.status;
    const s = localStorage.getItem('status');
    if (!s) return {};
    try { return JSON.parse(s) || {}; } catch { return {}; }
  }, [statusState?.status]);

  const hasOAuthOptions = false;

  useEffect(() => {
    if (status?.turnstile_check) { setTurnstileEnabled(true); setTurnstileSiteKey(status.turnstile_site_key); }
    setHasUserAgreement(status?.user_agreement_enabled || false);
    setHasPrivacyPolicy(status?.privacy_policy_enabled || false);
  }, [status]);

  useEffect(() => {
    let iv = null;
    if (disableButton && countdown > 0) iv = setInterval(() => setCountdown((c) => c - 1), 1000);
    else if (countdown === 0) { setDisableButton(false); setCountdown(30); }
    return () => clearInterval(iv);
  }, [disableButton, countdown]);

  // Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, drops = [];
    const chars = 'DAZEAI_v2.0_API_DATA_SYNC_1010101';
    const resize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; drops = Array(Math.floor(w / 20)).fill(1); };
    const draw = () => {
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(0, 0, w, h);
      ctx.font = '12px monospace'; ctx.fillStyle = '#000';
      drops.forEach((y, i) => { ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * 20, y * 20); if (y * 20 > h && Math.random() > 0.975) drops[i] = 0; drops[i]++; });
    };
    resize(); const timer = setInterval(draw, 50);
    window.addEventListener('resize', resize);
    return () => { clearInterval(timer); window.removeEventListener('resize', resize); };
  }, []);

  function handleChange(name, value) { setInputs((p) => ({ ...p, [name]: value })); }

  const requireTerms = (fn) => (...args) => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) { showInfo(t('请先阅读并同意用户协议和隐私政策')); return; }
    return fn(...args);
  };

  async function handleSubmit() {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) { showInfo(t('请先阅读并同意用户协议和隐私政策')); return; }
    if (!username || !password) { showError(t('用户名和密码不能为空')); return; }
    if (password.length < 8) { showError(t('密码长度不得小于 8 位！')); return; }
    if (password !== password2) { showError(t('两次输入的密码不一致')); return; }
    const emailValidation = validateEmail(inputs.email);
    if (!emailValidation.valid) { showError(t(emailValidation.message)); return; }
    if (!inputs.verification_code) { showError(t('请输入邮箱验证码')); return; }
    if (turnstileEnabled && !turnstileToken) { showInfo('请稍后几秒重试'); return; }
    setRegisterLoading(true);
    try {
      const res = await API.post(`/api/user/register?turnstile=${turnstileToken}`, { username, password, email: inputs.email, verification_code: inputs.verification_code, aff_code: localStorage.getItem('aff') });
      const { success, message } = res.data;
      if (success) { showSuccess(t('注册成功！')); navigate('/login'); } else showError(message);
    } catch { showError(t('注册失败，请重试')); }
    finally { setRegisterLoading(false); }
  }

  const sendVerificationCode = async () => {
    const emailValidation = validateEmail(inputs.email);
    if (!emailValidation.valid) { showError(t(emailValidation.message)); return; }
    setDisableButton(true);
    if (turnstileEnabled && !turnstileToken) { showInfo(t('请稍后几秒重试')); return; }
    setVerificationCodeLoading(true);
    const res = await API.get(`/api/verification?email=${inputs.email}&turnstile=${turnstileToken}`);
    if (res.data.success) showSuccess(t('验证码发送成功')); else showError(res.data.message);
    setVerificationCodeLoading(false);
  };

  const onWeChatLoginClicked = requireTerms(() => { setWechatLoading(true); setShowWeChatLoginModal(true); setWechatLoading(false); });
  const onSubmitWeChatVerificationCode = async () => {
    if (turnstileEnabled && !turnstileToken) { showInfo('请稍后'); return; }
    setWechatCodeSubmitLoading(true);
    try {
      const res = await API.get(`/api/oauth/wechat?code=${inputs.wechat_verification_code}`);
      if (res.data.success) { userDispatch({ type: 'login', payload: res.data.data }); localStorage.setItem('user', JSON.stringify(res.data.data)); setUserData(res.data.data); updateAPI(); navigate('/'); showSuccess('登录成功！'); setShowWeChatLoginModal(false); }
      else showError(res.data.message);
    } catch { showError('登录失败'); } finally { setWechatCodeSubmitLoading(false); }
  };

  const onTelegramLoginClicked = async (response) => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) { showInfo(t('请先阅读并同意用户协议和隐私政策')); return; }
    const params = {}; ['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date', 'hash', 'lang'].forEach((f) => { if (response[f]) params[f] = response[f]; });
    try { const res = await API.get('/api/oauth/telegram/login', { params }); if (res.data.success) { userDispatch({ type: 'login', payload: res.data.data }); localStorage.setItem('user', JSON.stringify(res.data.data)); showSuccess('登录成功！'); setUserData(res.data.data); updateAPI(); navigate('/'); } else showError(res.data.message); } catch { showError('登录失败'); }
  };

  const handleGitHubClick = requireTerms(() => { if (githubButtonDisabled) return; setGithubLoading(true); setGithubButtonDisabled(true); setGithubButtonState('redirecting'); githubTimeoutRef.current = setTimeout(() => { setGithubLoading(false); setGithubButtonState('timeout'); }, 20000); try { onGitHubOAuthClicked(status.github_client_id, { shouldLogout: true }); } finally { setTimeout(() => setGithubLoading(false), 3000); } });
  const handleDiscordClick = requireTerms(() => { setDiscordLoading(true); try { onDiscordOAuthClicked(status.discord_client_id, { shouldLogout: true }); } finally { setTimeout(() => setDiscordLoading(false), 3000); } });
  const handleOIDCClick = requireTerms(() => { setOidcLoading(true); try { onOIDCClicked(status.oidc_authorization_endpoint, status.oidc_client_id, false, { shouldLogout: true }); } finally { setTimeout(() => setOidcLoading(false), 3000); } });
  const handleLinuxDOClick = requireTerms(() => { setLinuxdoLoading(true); try { onLinuxDOOAuthClicked(status.linuxdo_client_id, { shouldLogout: true }); } finally { setTimeout(() => setLinuxdoLoading(false), 3000); } });
  const handleCustomOAuthClick = requireTerms((p) => { setCustomOAuthLoading((prev) => ({ ...prev, [p.slug]: true })); try { onCustomOAuthClicked(p, { shouldLogout: true }); } finally { setTimeout(() => setCustomOAuthLoading((prev) => ({ ...prev, [p.slug]: false })), 3000); } });

  const oauthBtnClass = 'w-full h-11 flex items-center justify-center !rounded-lg !border-[#E0E0E0] hover:!bg-[#F8F8F8] transition-colors';

  return (
    <div className='auth-terminal-root' style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <canvas ref={canvasRef} className='auth-data-canvas' />

      <div className='auth-content-overlay'>
        <div className='auth-dialog-card' style={{ maxWidth: 420 }}>
          <div className='text-center mb-6'>
            <h2 className='text-[18px] font-bold text-[#1A1A1A]'>{t('注册')}</h2>
            <p className='text-[12px] text-[#BBB] mt-1'>Create your account</p>
          </div>

          {formMode === 'oauth' ? (
            <>
              <div className='space-y-2.5'>
                {status.github_oauth && <Button theme='outline' className={oauthBtnClass} type='tertiary' icon={<IconGithubLogo size='large' />} onClick={handleGitHubClick} loading={githubLoading} disabled={githubButtonDisabled}><span className='ml-2 text-[13px]'>{githubButtonText}</span></Button>}
                {status.wechat_login && <Button theme='outline' className={oauthBtnClass} type='tertiary' icon={<Icon svg={<WeChatIcon />} style={{ color: '#07C160' }} />} onClick={onWeChatLoginClicked} loading={wechatLoading}><span className='ml-2 text-[13px]'>{t('使用 微信 继续')}</span></Button>}
                {status.discord_oauth && <Button theme='outline' className={oauthBtnClass} type='tertiary' icon={<SiDiscord style={{ color: '#5865F2', width: 20, height: 20 }} />} onClick={handleDiscordClick} loading={discordLoading}><span className='ml-2 text-[13px]'>{t('使用 Discord 继续')}</span></Button>}
                {status.oidc_enabled && <Button theme='outline' className={oauthBtnClass} type='tertiary' icon={<OIDCIcon style={{ color: '#1877F2' }} />} onClick={handleOIDCClick} loading={oidcLoading}><span className='ml-2 text-[13px]'>{t('使用 OIDC 继续')}</span></Button>}
                {status.linuxdo_oauth && <Button theme='outline' className={oauthBtnClass} type='tertiary' icon={<LinuxDoIcon style={{ color: '#E95420', width: 20, height: 20 }} />} onClick={handleLinuxDOClick} loading={linuxdoLoading}><span className='ml-2 text-[13px]'>{t('使用 LinuxDO 继续')}</span></Button>}
                {status.custom_oauth_providers?.map((p) => <Button key={p.slug} theme='outline' className={oauthBtnClass} type='tertiary' icon={getOAuthProviderIcon(p.icon || '', 20)} onClick={() => handleCustomOAuthClick(p)} loading={customOAuthLoading[p.slug]}><span className='ml-2 text-[13px]'>{t('使用 {{name}} 继续', { name: p.name })}</span></Button>)}
                {status.telegram_oauth && <div className='flex justify-center my-2'><TelegramLoginButton dataOnauth={onTelegramLoginClicked} botName={status.telegram_bot_name} /></div>}
              </div>
              <Divider margin='16px' align='center'><span className='text-[11px] text-[#CCC]'>{t('或')}</span></Divider>
              <button className='w-full py-2.5 text-[13px] font-medium text-[#1A1A1A] border border-[#E0E0E0] rounded-lg bg-white hover:bg-[#F8F8F8] transition-colors cursor-pointer' onClick={() => setFormMode('email')}>{t('使用 用户名 注册')}</button>
            </>
          ) : (
            <>
              <Form className='space-y-1'>
                <Form.Input field='username' label={t('用户名')} placeholder={t('请输入用户名')} onChange={(v) => handleChange('username', v)} prefix={<IconUser />} />
                <Form.Input field='password' label={t('密码')} placeholder={t('最短 8 位')} mode='password' onChange={(v) => handleChange('password', v)} prefix={<IconLock />} />
                <Form.Input field='password2' label={t('确认密码')} placeholder={t('确认密码')} mode='password' onChange={(v) => handleChange('password2', v)} prefix={<IconLock />} />
                <Form.Input field='email' label={t('邮箱')} placeholder={t('输入邮箱，支持： Gmail、QQ、163等主流邮箱')} type='email' onChange={(v) => handleChange('email', v)} prefix={<IconMail />}
                  suffix={<Button onClick={sendVerificationCode} loading={verificationCodeLoading} disabled={disableButton}>{disableButton ? `${t('重新发送')} (${countdown})` : t('获取验证码')}</Button>} />
                <Form.Input field='verification_code' label={t('验证码')} placeholder={t('输入验证码')} onChange={(v) => handleChange('verification_code', v)} prefix={<IconKey />} />
              </Form>

              {(hasUserAgreement || hasPrivacyPolicy) && (
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
              )}

              <div className='mt-4'>
                <button className='w-full py-2.5 text-[13px] font-semibold text-[#1A1A1A] border border-[#E0E0E0] rounded-lg bg-white hover:bg-[#F8F8F8] transition-colors cursor-pointer disabled:opacity-40' onClick={handleSubmit} disabled={registerLoading || ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms)}>
                  {registerLoading ? '...' : t('注册')}
                </button>
              </div>

              {hasOAuthOptions && (
                <>
                  <Divider margin='16px' align='center'><span className='text-[11px] text-[#CCC]'>{t('或')}</span></Divider>
                  <button className='w-full py-2 text-[12px] text-[#999] bg-white border border-[#EBEBEB] rounded-lg hover:bg-[#F8F8F8] transition-colors cursor-pointer' onClick={() => setFormMode('oauth')}>{t('其他注册选项')}</button>
                </>
              )}
            </>
          )}

          <div className='flex items-center justify-center mt-5 text-[12px]'>
            <Link to='/login' className='text-[#1A1A1A] hover:underline no-underline font-medium'>{t('已有账户？登录')}</Link>
          </div>
        </div>
      </div>

      <Modal title={t('微信扫码登录')} visible={showWeChatLoginModal} maskClosable onOk={onSubmitWeChatVerificationCode} onCancel={() => setShowWeChatLoginModal(false)} okText={t('登录')} centered okButtonProps={{ loading: wechatCodeSubmitLoading }}>
        <div className='flex flex-col items-center'><img src={status.wechat_qrcode} alt='' className='mb-4' /></div>
        <p className='text-center mb-4 text-sm'>{t('微信扫码关注公众号，输入「验证码」获取验证码（三分钟内有效）')}</p>
        <Form><Form.Input field='wechat_verification_code' placeholder={t('验证码')} label={t('验证码')} value={inputs.wechat_verification_code} onChange={(v) => handleChange('wechat_verification_code', v)} /></Form>
      </Modal>

      {turnstileEnabled && <div className='fixed bottom-4 left-1/2 -translate-x-1/2 z-[300]'><Turnstile sitekey={turnstileSiteKey} onVerify={(t) => setTurnstileToken(t)} /></div>}
    </div>
  );
};

export default RegisterForm;
