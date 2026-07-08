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
import { showError } from '../../helpers';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
  pre: ({ node, ...props }) => (
    <pre {...props} style={{ ...props.style, maxHeight: '300px', overflowY: 'auto' }} />
  ),
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

const ClawdChatPanel = ({ visible, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(genSessionId);
  const [streamingText, setStreamingText] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const [streamingToolCalls, setStreamingToolCalls] = useState([]);
  const [toolCallInfo, setToolCallInfo] = useState('');
  const [toolCallStatus, setToolCallStatus] = useState(''); // 'started' | 'completed' | 'error'
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');

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
    if (!visible) return;
    fetch('/api/channel/clawd/models')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setModels(data.data);
          if (data.data.length > 0 && !selectedModel) {
            setSelectedModel(data.data[0]);
          }
        }
      })
      .catch(() => {});
  }, [visible]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

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
        },
        body: JSON.stringify({
          message: text,
          session_id: sessionId,
          model: selectedModel,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
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
                fullText += data.content || '';
                setStreamingText(fullText);
              } else if (data.type === 'reasoning') {
                const piece = data.content || '';
                reasoningAcc += piece;
                setStreamingReasoning(reasoningAcc);
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
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, sessionId, streamingText, streamingReasoning, selectedModel]);

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
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
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
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
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
            padding: '10px 20px 14px',
            borderTop: '1px solid #f0eae6',
            flexShrink: 0,
            background: '#fff',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              background: '#fcfbfa',
              border: '1px solid #e8e4e0',
              borderRadius: '14px',
              padding: '8px 12px',
              transition: 'border-color 0.15s',
            }}
            onFocusCapture={(e) => (e.currentTarget.style.borderColor = '#DE886D')}
            onBlurCapture={(e) => (e.currentTarget.style.borderColor = '#e8e4e0')}
          >
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={loading}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: 12,
                color: '#999',
                cursor: loading ? 'not-allowed' : 'pointer',
                outline: 'none',
                maxWidth: '240px',
                fontFamily: 'inherit',
                flexShrink: 0,
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                paddingRight: '16px',
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23999' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E\")",
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right center',
              }}
            >
              {models.length === 0 && <option value=''>加载中...</option>}
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
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
                flex: 1,
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
              }}
            />
            {loading ? (
              <button
                onClick={handleStop}
                style={{
                  background: '#666',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#555')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#666')}
              >
                <IconStop size='small' />
                停止
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                style={{
                  background: input.trim() ? '#DE886D' : '#ddd',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  color: '#fff',
                  cursor: input.trim() ? 'pointer' : 'not-allowed',
                  fontSize: 13,
                  fontWeight: 500,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'opacity 0.15s',
                  opacity: input.trim() ? 1 : 0.6,
                }}
              >
                <IconSend size='small' />
                发送
              </button>
            )}
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
      `}</style>
    </>
  );
};

export default ClawdChatPanel;
