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

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { IconSend, IconClose, IconRefresh, IconStop } from '@douyinfe/semi-icons';
import { showError, getUserIdFromLocalStorage, authHeader } from '../../helpers';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

const genSessionId = () =>
  'cl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

const ToolCallChips = ({ calls = [] }) => {
  if (!calls || calls.length === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        marginBottom: '8px',
        paddingBottom: '8px',
        borderBottom: '1px dashed #f0eae6',
      }}
    >
      {calls.map((c, i) => {
        const color =
          c.status === 'error'
            ? '#e57373'
            : c.status === 'completed'
              ? '#7cb342'
              : '#DE886D';
        const icon = c.status === 'completed' ? '✓' : c.status === 'error' ? '✗' : '⟳';
        const detail = c.error || c.result || c.args || '';
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: '10px',
                background: `${color}1a`,
                color: color,
                border: `1px solid ${color}40`,
                whiteSpace: 'nowrap',
                alignSelf: 'flex-start',
              }}
            >
              <span style={{ fontWeight: 600 }}>{icon}</span>
              <code style={{ background: 'none', padding: 0, color: 'inherit', fontSize: 11 }}>
                {c.name}
              </code>
            </span>
            {detail && (
              <details style={{ marginLeft: 12, fontSize: 11 }}>
                <summary style={{ cursor: 'pointer', color: '#aaa', fontSize: 10 }}>
                  {c.error ? '错误详情' : '返回结果'}
                </summary>
                <pre
                  style={{
                    background: '#f5f0ed',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    fontSize: 11,
                    margin: '4px 0 0',
                    maxHeight: '120px',
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {detail}
                </pre>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
};

const ReasoningBlock = ({ text = '' }) => {
  if (!text || !text.trim()) return null;
  return (
    <details
      style={{
        marginBottom: '8px',
        paddingBottom: '8px',
        borderBottom: '1px dashed #f0eae6',
      }}
    >
      <summary style={{ cursor: 'pointer', fontSize: 11, color: '#999', fontWeight: 500 }}>
        思考过程
      </summary>
      <div
        style={{
          marginTop: '6px',
          padding: '8px 10px',
          background: '#faf8f5',
          borderRadius: '6px',
          fontSize: 12,
          color: '#666',
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
          maxHeight: '200px',
          overflowY: 'auto',
        }}
      >
        {text}
      </div>
    </details>
  );
};

const SandboxedHtmlPreview = ({ code = '' }) => {
  const iframeRef = useRef(null);
  const [height, setHeight] = useState(400);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type !== 'clawd-html-height') return;
      try {
        if (e.source !== iframeRef.current?.contentWindow) return;
      } catch {
        return;
      }
      const h = Math.max(e.data.height || 0, 60);
      setHeight(Math.min(h + 8, 800));
      setLoaded(true);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const resizeScript =
    "<script>(function(){function h(){parent.postMessage({type:'clawd-html-height',height:document.documentElement.scrollHeight||document.body.scrollHeight},'*')}if(document.readyState==='complete')h();else window.addEventListener('load',h);if(typeof ResizeObserver!=='undefined')new ResizeObserver(h).observe(document.body);setTimeout(h,500);setTimeout(h,2000);})();</script>";

  let fullCode = code;
  if (fullCode.includes('</body>')) {
    fullCode = fullCode.replace('</body>', resizeScript + '</body>');
  } else {
    fullCode += resizeScript;
  }

  return (
    <div
      style={{
        border: '1px solid #f0eae6',
        borderRadius: '8px',
        overflow: 'hidden',
        margin: '8px 0',
        background: '#fff',
        position: 'relative',
      }}
    >
      {!loaded && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#fcfbfa',
            zIndex: 1,
            fontSize: 13,
            color: '#999',
          }}
        >
          渲染中...
        </div>
      )}
      <iframe
        ref={iframeRef}
        sandbox='allow-scripts'
        srcDoc={fullCode}
        title='HTML预览'
        style={{
          width: '100%',
          height: height + 'px',
          border: 'none',
          display: 'block',
        }}
      />
    </div>
  );
};

const detectHtmlCodeBlock = (node) => {
  if (!node || !node.children) return null;
  const codeEl = node.children.find((c) => c.tagName === 'code');
  if (!codeEl) return null;
  const classes = codeEl.properties?.className;
  const langClass = Array.isArray(classes)
    ? classes.find((c) => typeof c === 'string' && c.startsWith('language-'))
    : null;
  if (!langClass) return null;
  const lang = langClass.replace('language-', '');
  if (lang !== 'html' && lang !== 'echarts' && lang !== 'chart') return null;
  const textChild = codeEl.children?.find((c) => c.type === 'text');
  return textChild?.value || '';
};

const mdComponents = {
  table: ({ node, ...props }) => (
    <div
      style={{
        maxHeight: '300px',
        overflowX: 'auto',
        overflowY: 'auto',
        borderRadius: '8px',
        border: '1px solid #e0d8d2',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <table {...props} style={{ minWidth: 'max-content', ...props.style }} />
    </div>
  ),
  pre: ({ node, children, ...props }) => {
    const htmlCode = detectHtmlCodeBlock(node);
    if (htmlCode) {
      return <SandboxedHtmlPreview code={htmlCode} />;
    }
    return (
      <pre {...props} style={{ ...props.style, maxHeight: '300px', overflowY: 'auto' }}>
        {children}
      </pre>
    );
  },
};

const CrabIcon = ({ size = 24, color = '#DE886D' }) => (
  <svg
    viewBox='-3 3 21 15'
    style={{ width: size, height: size * (15 / 21), imageRendering: 'pixelated', flexShrink: 0 }}
  >
    <rect x='2' y='6' width='11' height='7' rx='1' fill={color} />
    <rect x='3' y='5' width='9' height='2' fill={color} />
    <rect x='4' y='7' width='7' height='1' fill={color} opacity='0.7' />
    <rect x='3' y='13' width='2' height='2' fill={color} />
    <rect x='5' y='13' width='2' height='2' fill={color} />
    <rect x='9' y='13' width='2' height='2' fill={color} />
    <rect x='11' y='13' width='2' height='2' fill={color} />
    <rect x='0' y='9' width='2' height='3' fill={color} />
    <rect x='13' y='9' width='2' height='3' fill={color} />
    <rect x='-1' y='8' width='2' height='2' fill={color} />
    <rect x='14' y='8' width='2' height='2' fill={color} />
    <rect x='4' y='8' width='1' height='2' fill='#000' />
    <rect x='10' y='8' width='1' height='2' fill='#000' />
  </svg>
);

const ClawdChatPanel = ({ visible, onClose, onNewResponse }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(genSessionId);
  const [streamingText, setStreamingText] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const [streamingToolCalls, setStreamingToolCalls] = useState([]);
  const [toolCallInfo, setToolCallInfo] = useState('');
  const [toolCallStatus, setToolCallStatus] = useState(''); // 'started' | 'completed' | 'error'
  const [loadingHintIndex, setLoadingHintIndex] = useState(0);

  const LOADING_HINTS = [
    'Clawd智能体努力检索中～',
    '可以先去做别的事哦！完成后马上通知你 🎉',
    '🍵 稍等一下下～ (｡･ω･｡)',
  ];

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // 侧边栏宽度，可拖拽调整，持久化到 localStorage
  const PANEL_MIN = 360;
  const PANEL_MAX = 960;
  const [panelWidth, setPanelWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('clawd_panel_width');
      if (saved) {
        const n = parseInt(saved, 10);
        if (!isNaN(n) && n >= PANEL_MIN && n <= PANEL_MAX) return n;
      }
    } catch {}
    return Math.min(520, Math.max(PANEL_MIN, window.innerWidth - 80));
  });

  const startResize = useCallback(
    (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = panelWidth;
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      const onMove = (ev) => {
        const delta = startX - ev.clientX;
        const next = Math.max(PANEL_MIN, Math.min(PANEL_MAX, startWidth + delta));
        setPanelWidth(next);
        try {
          localStorage.setItem('clawd_panel_width', String(next));
        } catch {}
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [panelWidth],
  );

  // textarea 自动高度：从 1 行长到最多 10 行，超过后出滚动条
  // 10 行 ≈ 10 * 1.6 * 14 = 224px，留一点 padding 取 240px
  const TEXTAREA_MAX_HEIGHT = 240;

  const autoResizeTextarea = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT);
    el.style.height = next + 'px';
    // 超过最大高度时启用纵向滚动条
    el.style.overflowY = el.scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText, streamingReasoning, streamingToolCalls, loading, toolCallInfo, toolCallStatus]);

  useEffect(() => {
    if (visible && inputRef.current) {
      const t = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      setLoadingHintIndex(0);
      return;
    }
    setLoadingHintIndex(0);
    const interval = setInterval(() => {
      setLoadingHintIndex((prev) => (prev + 1) % LOADING_HINTS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [loading]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    // 清空后重置 textarea 高度
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.overflowY = 'hidden';
    }
    setLoading(true);
    setStreamingText('');
    setStreamingReasoning('');
    setStreamingToolCalls([]);
    setToolCallInfo('');
    setToolCallStatus('');

try {
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch('/api/channel/clawd/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'New-API-User': String(getUserIdFromLocalStorage()),
          ...authHeader(),
        },
        body: JSON.stringify({
          message: text,
          session_id: sessionId,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body.message) msg = body.message;
        } catch {}
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: msg, toolCalls: [], reasoning: '' },
        ]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let reasoningAcc = '';
      let toolCallsAcc = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

            try {
              const data = JSON.parse(jsonStr);
              if (data.type === 'content') {
                if (data.ts) console.log('[clawd] content ts=%d local=%d delta=%dms', data.ts, Date.now(), Date.now() - data.ts);
                fullText += data.content || '';
                setStreamingText(fullText);
                await new Promise((r) => setTimeout(r, 0));
              } else if (data.type === 'reasoning') {
                const piece = data.content || '';
                reasoningAcc += piece;
                setStreamingReasoning(reasoningAcc);
                await new Promise((r) => setTimeout(r, 0));
              } else if (data.type === 'tool_call') {
                const name = data.tool_name || 'tool';
                const status = data.subtype || 'started';
                const result = data.result || '';
                const error = data.error || '';
                const args = data.tool_args || '';
                const existing = toolCallsAcc.find((t) => t.name === name);
                if (existing) {
                  existing.status = status;
                  if (result) existing.result = result;
                  if (error) existing.error = error;
                  if (args) existing.args = args;
                } else {
                  toolCallsAcc = [...toolCallsAcc, { name, status, result, error, args }];
                }
                setStreamingToolCalls(toolCallsAcc);
                setToolCallInfo(name);
                setToolCallStatus(status);
              } else if (data.type === 'error') {
                fullText += (fullText ? '\n\n' : '') + (data.content || '未知错误');
                setStreamingText(fullText);
              } else if (data.type === 'done') {
                break;
              }
            } catch {
            // skip malformed chunks
          }
        }
      }

      if (fullText || toolCallsAcc.length > 0 || reasoningAcc) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: fullText,
            toolCalls: toolCallsAcc,
            reasoning: reasoningAcc || '',
          },
        ]);
      }
      setStreamingText('');
      setStreamingReasoning('');
      setStreamingToolCalls([]);
      setToolCallInfo('');
      setToolCallStatus('');
    } catch (e) {
      if (e.name === 'AbortError') {
        if (streamingText || streamingReasoning) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: streamingText + '\n\n_(已中断)_',
              toolCalls: toolCallsAcc,
              reasoning: streamingReasoning || '',
            },
          ]);
        }
      } else {
        const msg = e.message || '网络错误';
        showError(msg);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `⚠️ ${msg}`, toolCalls: toolCallsAcc, reasoning: '' },
        ]);
      }
    } finally {
      setLoading(false);
      setStreamingText('');
      setStreamingReasoning('');
      setStreamingToolCalls([]);
      setToolCallInfo('');
      setToolCallStatus('');
      abortRef.current = null;
      if (!visible && onNewResponse) {
        onNewResponse();
      }
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, sessionId, streamingText, streamingReasoning, visible, onNewResponse]);

  const handleNewSession = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setMessages([]);
    setStreamingText('');
    setStreamingReasoning('');
    setStreamingToolCalls([]);
    setToolCallInfo('');
    setToolCallStatus('');
    setSessionId(genSessionId());
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!visible) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.08)',
          zIndex: 9998,
          animation: 'clawd-overlay-in 0.2s ease-out',
        }}
      />
      {/* Side drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: panelWidth + 'px',
          maxWidth: 'calc(100vw - 8px)',
          height: '100vh',
          background: '#ffffff',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.1)',
          animation: 'clawd-drawer-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Drag handle on left edge */}
        <div
          onMouseDown={startResize}
          onDoubleClick={() => {
            try {
              localStorage.removeItem('clawd_panel_width');
            } catch {}
            setPanelWidth(Math.min(520, Math.max(PANEL_MIN, window.innerWidth - 80)));
          }}
          title='拖拽调整宽度，双击重置'
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '6px',
            cursor: 'ew-resize',
            background: 'transparent',
            transition: 'background 0.15s',
            zIndex: 10,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(222,136,109,0.25)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        />
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #f0eae6',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CrabIcon size={28} color='#DE886D' />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>
              Clawd
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={handleNewSession}
              title='新对话'
              style={{
                background: 'transparent',
                border: 'none',
                color: '#999',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#faf5f2';
                e.currentTarget.style.color = '#DE886D';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#999';
              }}
            >
              <IconRefresh size='medium' />
            </button>
            <button
              onClick={onClose}
              title='关闭'
              style={{
                background: 'transparent',
                border: 'none',
                color: '#999',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#faf5f2';
                e.currentTarget.style.color = '#DE886D';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#999';
              }}
            >
              <IconClose size='medium' />
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            background: '#fcfbfa',
          }}
        >
          {messages.length === 0 && !streamingText && !loading && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: '16px',
              }}
            >
              <div className='clawd-welcome-crab'>
                <CrabIcon size={64} color='#DE886D' />
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#333' }}>
                嗨，我是 Clawd
              </div>
              <div style={{ fontSize: 14, color: '#aaa', textAlign: 'center', maxWidth: 280 }}>
                向我提问关于本站的任何信息
                <br />
                渠道状态、用户配额、请求日志...
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: '10px',
                  flexDirection: isUser ? 'row-reverse' : 'row',
                }}
              >
                {!isUser && (
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#faf5f2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      border: '1px solid #f0eae6',
                    }}
                  >
                    <CrabIcon size={20} color='#DE886D' />
                  </div>
                )}
                <div
                  style={{
                    maxWidth: isUser ? '78%' : '92%',
                    padding: '10px 16px',
                    borderRadius: isUser
                      ? '16px 16px 4px 16px'
                      : '4px 16px 16px 16px',
                    fontSize: '14px',
                    lineHeight: '1.65',
                    wordBreak: 'break-word',
                    background: isUser
                      ? '#DE886D'
                      : '#ffffff',
                    color: isUser ? '#fff' : '#333',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    border: isUser ? 'none' : '1px solid #f0eae6',
                  }}
                >
                  {isUser ? (
                    msg.content
                  ) : (
                    <>
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <ToolCallChips calls={msg.toolCalls} />
                      )}
                      {msg.reasoning && (
                        <ReasoningBlock text={msg.reasoning} />
                      )}
                      <div className='clawd-md'>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={mdComponents}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {loading && !streamingText && (
            <div style={{ display: 'flex', gap: '10px', flexDirection: 'row' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#faf5f2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  border: '1px solid #f0eae6',
                }}
              >
                <CrabIcon size={20} color='#DE886D' />
              </div>
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '4px 16px 16px 16px',
                  background: '#ffffff',
                  border: '1px solid #f0eae6',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                {streamingToolCalls.length === 0 && !toolCallInfo && (
                  <span
                    style={{
                      fontSize: 12,
                      color: '#8a7a72',
                      transition: 'opacity 0.3s',
                      key: loadingHintIndex,
                    }}
                  >
                    {LOADING_HINTS[loadingHintIndex]}
                  </span>
                )}
                <span className='clawd-dot' />
                <span className='clawd-dot clawd-dot-2' />
                <span className='clawd-dot clawd-dot-3' />
                {streamingToolCalls.length > 0 ? (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {streamingToolCalls.map((c, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: '#faf5f2',
                          color: c.status === 'error' ? '#e57373' : c.status === 'completed' ? '#7cb342' : '#DE886D',
                          border: '1px solid #f0eae6',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.status === 'completed' ? '✓ ' : c.status === 'error' ? '✗ ' : '⟳ '}
                        {c.name}
                      </span>
                    ))}
                  </div>
                ) : toolCallInfo ? (
                  <span style={{ marginLeft: 4, fontSize: 12, color: '#bbb' }}>
                    {toolCallStatus === 'error'
                      ? `${toolCallInfo} 调用失败`
                      : toolCallStatus === 'completed'
                        ? `${toolCallInfo} 调用完成`
                        : `正在调用 ${toolCallInfo}...`}
                  </span>
                ) : null}
              </div>
            </div>
          )}

          {streamingText && (
            <div style={{ display: 'flex', gap: '10px', flexDirection: 'row' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#faf5f2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  border: '1px solid #f0eae6',
                }}
              >
                <CrabIcon size={20} color='#DE886D' />
              </div>
              <div
                style={{
                  maxWidth: '92%',
                  padding: '10px 16px',
                  borderRadius: '4px 16px 16px 16px',
                  fontSize: '14px',
                  lineHeight: '1.65',
                  wordBreak: 'break-word',
                  background: '#ffffff',
                  color: '#333',
                  border: '1px solid #f0eae6',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                {streamingToolCalls.length > 0 && (
                  <ToolCallChips calls={streamingToolCalls} />
                )}
                {streamingReasoning && (
                  <ReasoningBlock text={streamingReasoning} />
                )}
                <div className='clawd-md'>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={mdComponents}>
                    {streamingText}
                  </ReactMarkdown>
                </div>
                <span className='clawd-cursor'>▋</span>
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div
          style={{
            padding: '12px 20px 16px',
            borderTop: '1px solid #f0eae6',
            flexShrink: 0,
            background: '#fff',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0',
              background: '#fcfbfa',
              border: '1px solid #e8e4e0',
              borderRadius: '16px',
              padding: '6px 6px 6px 4px',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onFocusCapture={(e) => {
              e.currentTarget.style.borderColor = '#DE886D';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(222,136,109,0.08)';
            }}
            onBlurCapture={(e) => {
              e.currentTarget.style.borderColor = '#e8e4e0';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoResizeTextarea();
              }}
              onKeyDown={handleKeyDown}
              placeholder='输入消息，Enter 发送，Shift+Enter 换行...'
              disabled={loading && !streamingText}
              rows={1}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                fontSize: 14,
                lineHeight: '1.6',
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                maxHeight: TEXTAREA_MAX_HEIGHT + 'px',
                height: 'auto',
                overflowY: 'hidden',
                color: '#333',
                padding: '8px 12px 4px',
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                padding: '0 6px 0 10px',
                minHeight: '32px',
              }}
            >
              {loading ? (
                <button
                  onClick={handleStop}
                  title='停止'
                  style={{
                    width: '32px',
                    height: '32px',
                    border: 'none',
                    borderRadius: '50%',
                    background: '#4a4a4a',
                    color: '#fff',
                    cursor: 'pointer',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.15s, transform 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#3a3a3a')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#4a4a4a')}
                >
                  <IconStop size='small' />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  title='发送'
                  style={{
                    width: '32px',
                    height: '32px',
                    border: 'none',
                    borderRadius: '50%',
                    background: input.trim() ? '#DE886D' : '#e0d8d2',
                    color: '#fff',
                    cursor: input.trim() ? 'pointer' : 'not-allowed',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.15s, transform 0.1s, opacity 0.15s',
                    opacity: input.trim() ? 1 : 0.5,
                  }}
                  onMouseEnter={(e) => {
                    if (input.trim()) {
                      e.currentTarget.style.background = '#d07a5f';
                      e.currentTarget.style.transform = 'scale(1.06)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = input.trim() ? '#DE886D' : '#e0d8d2';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <IconSend size='small' />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .clawd-welcome-crab {
          animation: clawd-welcome-bob 2s ease-in-out infinite;
        }
        @keyframes clawd-welcome-bob {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-6px) rotate(2deg); }
        }
        .clawd-cursor {
          animation: clawd-blink-cursor 0.8s step-end infinite;
          color: #DE886D;
          font-weight: bold;
        }
        @keyframes clawd-blink-cursor {
          50% { opacity: 0; }
        }
        @keyframes clawd-drawer-in {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes clawd-overlay-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .clawd-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #DE886D;
          animation: clawd-bounce 1.2s infinite ease-in-out;
        }
        .clawd-dot-2 { animation-delay: 0.15s; }
        .clawd-dot-3 { animation-delay: 0.3s; }
        @keyframes clawd-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.3; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        .clawd-md p { margin: 0 0 8px 0; }
        .clawd-md p:last-child { margin-bottom: 0; }
        .clawd-md code {
          background: #f5f0ed;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 13px;
          font-family: 'SF Mono', Monaco, monospace;
          color: '#d24848';
        }
        .clawd-md pre {
          background: #1e1e1e;
          color: #f8f8f2;
          padding: 12px 14px;
          border-radius: 8px;
          overflow-x: auto;
          margin: 8px 0;
          font-size: 13px;
        }
        .clawd-md pre code {
          background: none;
          padding: 0;
          color: inherit;
        }
        .clawd-md table {
          border-collapse: collapse;
          margin: 8px 0;
          font-size: 13px;
          width: 100%;
          min-width: max-content;
        }
        .clawd-md th, .clawd-md td {
          border: 1px solid #e0d8d2;
          padding: 6px 10px;
          text-align: left;
          white-space: nowrap;
        }
        .clawd-md th {
          background: #faf5f2;
          font-weight: 600;
          position: sticky;
          top: 0;
          z-index: 1;
        }
        .clawd-md ul, .clawd-md ol {
          margin: 6px 0;
          padding-left: 20px;
        }
        .clawd-md li {
          margin: 2px 0;
        }
        .clawd-md a {
          color: #DE886D;
          text-decoration: none;
        }
        .clawd-md a:hover {
          text-decoration: underline;
        }
        .clawd-md blockquote {
          border-left: 3px solid #DE886D;
          margin: 8px 0;
          padding: 4px 12px;
          color: #666;
          background: #faf5f2;
          border-radius: 0 6px 6px 0;
        }
        .clawd-md h1, .clawd-md h2, .clawd-md h3,
        .clawd-md h4, .clawd-md h5, .clawd-md h6 {
          margin: 12px 0 6px;
          font-weight: 600;
          color: #1a1a1a;
        }
        .clawd-md h1 { font-size: 18px; }
        .clawd-md h2 { font-size: 16px; }
        .clawd-md h3 { font-size: 15px; }
        .clawd-md h4, .clawd-md h5, .clawd-md h6 { font-size: 14px; }
        .clawd-md img {
          max-width: 100%;
          border-radius: 6px;
          margin: 6px 0;
        }
        .clawd-md hr {
          border: none;
          border-top: 1px solid #e0d8d2;
          margin: 12px 0;
        }
        .clawd-md details {
          margin: 6px 0;
          padding: 6px 10px;
          background: #faf8f5;
          border-radius: 6px;
          border: 1px solid #f0eae6;
        }
        .clawd-md summary {
          cursor: pointer;
          font-size: 13px;
          color: #666;
          font-weight: 500;
        }
        .clawd-md mark {
          background: #fff3cd;
          padding: 1px 3px;
          border-radius: 2px;
        }
        .clawd-md kbd {
          background: #f5f0ed;
          border: 1px solid #e0d8d2;
          border-radius: 3px;
          padding: 1px 5px;
          font-size: 12px;
          font-family: 'SF Mono', Monaco, monospace;
        }
        .clawd-md abbr {
          cursor: help;
          text-decoration: underline dotted;
        }
        .clawd-md figure {
          margin: 8px 0;
          text-align: center;
        }
        .clawd-md figcaption {
          font-size: 12px;
          color: #999;
          margin-top: 4px;
        }
        .clawd-md div {
          max-width: 100%;
        }
      `}</style>
    </>
  );
};

export default ClawdChatPanel;
