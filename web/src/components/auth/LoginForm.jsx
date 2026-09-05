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
  setUserData,
  onGitHubOAuthClicked,
  onDiscordOAuthClicked,
  onOIDCClicked,
  onLinuxDOOAuthClicked,
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
} from '@douyinfe/semi-icons';
import OIDCIcon from '../common/logo/OIDCIcon';
import WeChatIcon from '../common/logo/WeChatIcon';
import LinuxDoIcon from '../common/logo/LinuxDoIcon';
import { useTranslation } from 'react-i18next';
import { SiDiscord } from 'react-icons/si';
import { AnimatePresence, motion } from 'framer-motion';
import { ShieldCheck, Zap, Headphones, Receipt, ChevronDown } from 'lucide-react';

const METRICS = [
  { label: 'UPTIME', value: '99.97%', style: { top: '8%', left: '6%' } },
  { label: 'RESPONSE_TIME', value: '8ms', style: { top: '14%', right: '8%' } },
  { label: 'THROUGHPUT', value: '12K/RPS', style: { bottom: '18%', left: '7%' } },
  { label: 'ACCURACY', value: '99.1%', style: { bottom: '10%', right: '6%' } },
  { label: 'CACHE_HIT', value: '94.2%', style: { top: '40%', left: '4%' } },
  { label: 'QUALITY_SCORE', value: '98.6%', style: { top: '36%', right: '4%' } },
  { label: 'BUILD', value: 'STABLE', style: { top: '4%', left: '44%' } },
  { label: 'OPTIMIZATION', value: 'ENABLED', style: { bottom: '14%', left: '50%' } },
  { label: 'EFFECT_RATE', value: '97.3%', style: { bottom: '28%', right: '20%', opacity: 0.5 } },
  { label: 'HEALTH_CHECK', value: 'PASSING', style: { top: '24%', right: '20%', opacity: 0.5 } },
  { label: 'PERFORMANCE', value: 'OPTIMAL', style: { bottom: '35%', left: '18%', opacity: 0.5 } },
  { label: 'MAINTENANCE', value: 'SCHEDULED', style: { top: '22%', left: '22%', opacity: 0.5 } },
];

const LoginForm = () => {
  let navigate = useNavigate();
  const { t } = useTranslation();
  const canvasRef = useRef(null);
  const rootRef = useRef(null);
  const metricsRef = useRef([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const logoRef = useRef(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('email');
  const systemName = getSystemName();

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
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [hasUserAgreement, setHasUserAgreement] = useState(false);
  const [hasPrivacyPolicy, setHasPrivacyPolicy] = useState(false);
  const [githubButtonState, setGithubButtonState] = useState('idle');
  const [githubButtonDisabled, setGithubButtonDisabled] = useState(false);
  const githubTimeoutRef = useRef(null);
  const githubButtonText = t(githubButtonTextKeyByState[githubButtonState]);

  const status = useMemo(() => {
    if (statusState?.status) return statusState.status;
    const savedStatus = localStorage.getItem('status');
    if (!savedStatus) return {};
    try { return JSON.parse(savedStatus) || {}; } catch { return {}; }
  }, [statusState?.status]);

  const hasOAuthLoginOptions = false;

  // Canvas data stream — "thunder" edition: fading trails + fast glowing bolt columns
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, cols = [];
    const chars = 'DAZEAI_v2.0_API_DATA_SYNC_1010101';
    const spawn = () => ({
      y: Math.random() * -30,
      speed: 0.35 + Math.random() * 0.8,
      bolt: Math.random() < 0.14,
    });
    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      cols = Array.from({ length: Math.floor(w / 20) }, () => {
        const c = spawn();
        c.y = Math.random() * (h / 20);
        return c;
      });
    };
    const draw = () => {
      // Semi-transparent white wash → previous frames fade into trails
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(0, 0, w, h);
      ctx.font = '12px monospace';
      cols.forEach((c, i) => {
        const ch = chars[(Math.random() * chars.length) | 0];
        const x = i * 20;
        const y = c.y * 20;
        if (c.bolt) {
          // Bolt column: pure black head with a soft glow, falls fast
          ctx.shadowBlur = 9;
          ctx.shadowColor = 'rgba(0,0,0,0.75)';
          ctx.fillStyle = '#000';
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
        }
        ctx.fillText(ch, x, y);
        ctx.shadowBlur = 0;
        c.y += c.bolt ? c.speed * 2.4 : c.speed;
        if (y > h && Math.random() > 0.96) cols[i] = spawn();
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

  // Typewriter tagline
  const TAGLINE = 'MULTI-MODEL API AGGREGATION PLATFORM';
  const [typedTagline, setTypedTagline] = useState('');
  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setTypedTagline(TAGLINE.slice(0, i));
      if (i >= TAGLINE.length) clearInterval(timer);
    }, 45);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Terminal typing with syntax highlighting: starts when scrolled into view
  const terminalRef = useRef(null);
  const [typedCount, setTypedCount] = useState(0);
  const CODE_SEGMENTS = useMemo(() => [
    { text: '$ ', cls: 'tk-prompt' },
    { text: 'curl ', cls: 'tk-cmd' },
    { text: `${window.location.origin}/v1/chat/completions`, cls: 'tk-str' },
    { text: ' \\\n    -H ', cls: 'tk-flag' },
    { text: '"Authorization: Bearer sk-your-key"', cls: 'tk-str' },
    { text: ' \\\n    -d ', cls: 'tk-flag' },
    { text: '\'{"model":"gpt-5","messages":[{"role":"user","content":"Hello!"}]}\'', cls: 'tk-str' },
    { text: '\n\n→ ', cls: 'tk-prompt' },
    { text: '200 OK', cls: 'tk-ok' },
    { text: ' · 8ms\n', cls: 'tk-dim' },
    { text: '{"choices":[{"message":{"role":"assistant","content":"Hello!"}}],\n "usage":{"prompt_tokens":8,"completion_tokens":9,"total_tokens":17}}', cls: 'tk-dim' },
  ], []);
  const codeTotalLen = useMemo(() => CODE_SEGMENTS.reduce((n, s) => n + s.text.length, 0), [CODE_SEGMENTS]);
  useEffect(() => {
    const el = terminalRef.current;
    if (!el) return;
    let timer = null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || timer) return;
        let i = 0;
        timer = setInterval(() => {
          i += 2;
          setTypedCount(i);
          if (i >= codeTotalLen) clearInterval(timer);
        }, 16);
        observer.disconnect();
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => { observer.disconnect(); if (timer) clearInterval(timer); };
  }, [codeTotalLen]);

  // Scroll reveal: sections fade/slide in when entering the viewport and
  // gently fade back out when leaving it (若隐若现, works in both directions)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = root.querySelectorAll('.landing-reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle('in-view', entry.isIntersecting);
        });
      },
      { root, threshold: 0.15 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Unified rAF loop: metric push + focus fade (若隐若现)
  useEffect(() => {
    let raf;
    const update = () => {
      const m = mouseRef.current;
      // Metrics: push away near cursor, fade with distance (focus reveal)
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
          el.style.opacity = '1';
        } else {
          el.style.transform = '';
          el.style.zIndex = '50';
          const fade = Math.max(0.22, Math.min(0.85, 1 - (dist - 180) / 600));
          el.style.opacity = String(fade);
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
    if (turnstileEnabled && !turnstileToken) { showInfo(t('请稍后几秒重试，Turnstile 正在检查用户环境！')); return; }
    setSubmitted(true); setLoginLoading(true);
    try {
      if (username && password) {
        const res = await API.post(`/api/user/login?turnstile=${turnstileToken}`, { username, password });
        const { success, message, data } = res.data;
        if (success) {
          userDispatch({ type: 'login', payload: data }); setUserData(data); updateAPI();
          showSuccess(t('登录成功！'));
          if (username === 'root' && password === '123456') Modal.error({ title: t('您正在使用默认密码！'), content: t('请立刻修改默认密码！'), centered: true });
          navigate('/console/dashboard');
        } else showError(message);
      } else showError(t('请输入用户名和密码！'));
    } catch { showError(t('登录失败，请重试')); }
    finally { setLoginLoading(false); }
  }

  const onWeChatLoginClicked = requireTerms(() => { setWechatLoading(true); setShowWeChatLoginModal(true); setWechatLoading(false); });
  const onSubmitWeChatVerificationCode = async () => {
    if (turnstileEnabled && !turnstileToken) { showInfo(t('请稍后几秒重试')); return; }
    setWechatCodeSubmitLoading(true);
    try {
      const res = await API.get(`/api/oauth/wechat?code=${inputs.wechat_verification_code}`);
      const { success, message, data } = res.data;
      if (success) { userDispatch({ type: 'login', payload: data }); localStorage.setItem('user', JSON.stringify(data)); setUserData(data); updateAPI(); navigate('/'); showSuccess(t('登录成功！')); setShowWeChatLoginModal(false); }
      else showError(message);
    } catch { showError(t('登录失败，请重试')); }
    finally { setWechatCodeSubmitLoading(false); }
  };

  const onTelegramLoginClicked = async (response) => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) { showInfo(t('请先阅读并同意用户协议和隐私政策')); return; }
    const fields = ['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date', 'hash', 'lang'];
    const params = {}; fields.forEach((f) => { if (response[f]) params[f] = response[f]; });
    try {
      const res = await API.get('/api/oauth/telegram/login', { params });
      const { success, message, data } = res.data;
      if (success) { userDispatch({ type: 'login', payload: data }); localStorage.setItem('user', JSON.stringify(data)); showSuccess(t('登录成功！')); setUserData(data); updateAPI(); navigate('/'); }
      else showError(message);
    } catch { showError(t('登录失败，请重试')); }
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
      {status.telegram_oauth && <div className='flex justify-center my-2'><TelegramLoginButton dataOnauth={onTelegramLoginClicked} botName={status.telegram_bot_name} /></div>}
    </div>
  );

  const LANDING_FEATURES = [
    { key: 'ha', icon: ShieldCheck, title: t('高可用架构'), desc: t('多通道故障自动转移，请求永远落到可用上游，SLA 有保障。'), metric: 'FAILOVER < 300MS · MULTI-CHANNEL' },
    { key: 'fast', icon: Zap, title: t('闪电响应'), desc: t('智能路由与边缘缓存双重加速，平均延迟压至个位数毫秒。'), metric: 'AVG 8MS · P99 42MS' },
    { key: 'support', icon: Headphones, title: t('全天候支持'), desc: t('7×24 小时技术响应，企业级问题不过夜。'), metric: '24/7 · RESPONSE < 1H' },
    { key: 'billing', icon: Receipt, title: t('透明计费'), desc: t('Token 级成本明细，每一次调用都可追溯、可审计。'), metric: '100% TRACEABLE · PER-TOKEN' },
  ];

  return (
    <div ref={rootRef} className='auth-terminal-root'>
      <canvas ref={canvasRef} className='auth-data-canvas' />

      {/* ================= HERO ================= */}
      <section className='auth-hero'>
        {/* HUD corner brackets */}
        <div className='auth-hud-corner auth-hud-tl' />
        <div className='auth-hud-corner auth-hud-tr' />
        <div className='auth-hud-corner auth-hud-bl' />
        <div className='auth-hud-corner auth-hud-br' />

        <div className='auth-metrics-cloud'>
          {METRICS.map((m, i) => (
            <div key={i} ref={(el) => (metricsRef.current[i] = el)} className='auth-metric-item' style={m.style}>
              <span>{m.label}</span>
              <strong>{m.value}</strong>
            </div>
          ))}
        </div>

        <div className='auth-content-overlay'>
          <div ref={logoRef} className='auth-glitch-logo' data-text={systemName}>{systemName}</div>
          <p className='auth-tagline'>
            {typedTagline}
            <span className='auth-caret' />
          </p>
          <h1 className='auth-hero-headline'>{t('一个密钥，调用全球模型')}</h1>
          <p className='auth-hero-sub'>{t('聚合 40+ 上游供应商，统一接口、统一计费、智能路由。')}</p>
          <nav className='auth-button-matrix'>
            <button
              className='auth-neo-btn auth-btn-outline'
              onClick={() => { setShowForm(true); setFormMode('email'); }}
            >
              {t('开始使用')}
            </button>
            <a
              href='/docs'
              className='auth-neo-btn auth-btn-ghost'
            >
              {t('查看文档')}
            </a>
          </nav>
        </div>

        {/* Scroll hint: gently pulsing arrow guiding to the sections below */}
        <button
          type='button'
          className='auth-scroll-hint'
          onClick={() => {
            const root = rootRef.current;
            const target = root?.querySelector('.landing-section');
            if (root && target) {
              root.scrollTo({ top: target.offsetTop - 20, behavior: 'smooth' });
            }
          }}
        >
          <span>{t('为什么选择我们')}</span>
          <ChevronDown size={16} strokeWidth={2} />
        </button>
      </section>

      {/* ================= FEATURES ================= */}
      <section className='landing-section'>
        <div className='landing-sec-head landing-reveal'>
          <h2>{t('为生产环境而生')}</h2>
          <p>{t('不只是一个中转站——从可用性到计费，每一层都为稳定性设计。')}</p>
        </div>
        <div className='landing-feat-grid'>
          {LANDING_FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={f.key} className='landing-feat landing-reveal' style={{ transitionDelay: `${i * 70}ms` }}>
                <div className='landing-feat-icon'><Icon size={17} strokeWidth={1.8} /></div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                <div className='landing-feat-drawer'>{f.metric}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ================= QUICKSTART / CODE ================= */}
      <section className='landing-section landing-code-section'>
        <div className='landing-code-wrap'>
          <div className='landing-code-copy landing-reveal'>
            <h2>{t('一行接入，全球模型')}</h2>
            <ul>
              <li>{t('兼容 OpenAI / Claude / Gemini 官方 SDK，零改动接入')}</li>
              <li>{t('一个密钥调用 200+ 模型，统一计费、统一日志')}</li>
              <li>{t('智能负载均衡，上游故障自动切换')}</li>
            </ul>
            <a href='/docs' className='landing-doc-link'>{t('查看 API 文档')} →</a>
          </div>
          <div className='landing-terminal landing-reveal' style={{ transitionDelay: '120ms' }} ref={terminalRef}>
            <div className='landing-terminal-bar'>
              <i className='dot-r' /><i className='dot-y' /><i className='dot-g' />
              <span>bash — curl</span>
            </div>
            <pre>
              {/* Invisible full-text sizer reserves the final height — no layout shift while typing */}
              <span aria-hidden='true' className='tk-sizer'>
                {CODE_SEGMENTS.map((s) => s.text).join('')}
              </span>
              <span className='tk-typed'>
                {(() => {
                  let remaining = typedCount;
                  return CODE_SEGMENTS.map((seg, i) => {
                    const slice = seg.text.slice(0, Math.max(0, Math.min(remaining, seg.text.length)));
                    remaining -= seg.text.length;
                    return slice ? <span key={i} className={seg.cls}>{slice}</span> : null;
                  });
                })()}
                <span className='auth-caret' />
              </span>
            </pre>
          </div>
        </div>
      </section>

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
                <p className='text-[12px] text-[#BBB] mt-1'>{t('欢迎')}</p>
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

      {turnstileEnabled && (
        <div className='fixed bottom-4 left-1/2 -translate-x-1/2 z-[300]'>
          <Turnstile sitekey={turnstileSiteKey} onVerify={(token) => setTurnstileToken(token)} />
        </div>
      )}

      {/* new-api credit */}
      <div className='landing-credit landing-reveal text-[11px] text-[#b0b0b0] leading-relaxed'>
        {t('本项目基于')}{' '}
        <a
          href='https://github.com/QuantumNous/new-api'
          target='_blank'
          rel='noopener noreferrer'
          className='underline decoration-[#b0b0b0] hover:text-[#888] transition-colors'
        >
          New-API
        </a>
        {' '}{t('二次开发，仅供个人学习使用。')}
      </div>
    </div>
  );
};

export default LoginForm;
