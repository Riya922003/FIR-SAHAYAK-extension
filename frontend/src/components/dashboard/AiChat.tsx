import { useState, useRef, useEffect, FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { sendChatMessage, type ChatMsg } from '../../api/ai';

const WELCOME: ChatMsg = {
  role: 'model',
  text: 'Namaste! I\'m your AI Legal Assistant. I can help you understand the FIR filing process, explain IPC sections relevant to your case, or answer questions about your complaint status. How can I help you today?',
};

export default function AiChat() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading || !token) return;

    const userMsg: ChatMsg = { role: 'user', text };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const reply = await sendChatMessage(token, text, messages);
      setMessages([...nextHistory, { role: 'model', text: reply }]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        className={`ai-chat-fab${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close AI chat' : 'Open AI legal assistant'}
        title="AI Legal Assistant"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="ai-chat-panel">
          {/* Header */}
          <div className="ai-chat-header">
            <div className="ai-chat-header-left">
              <div className="ai-chat-avatar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a8 8 0 0 1 8 8c0 5-8 13-8 13S4 15 4 10a8 8 0 0 1 8-8z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
              <div>
                <div className="ai-chat-header-name">AI Legal Assistant</div>
                <div className="ai-chat-header-sub">Powered by Gemini · FIR Sahayak</div>
              </div>
            </div>
            <button className="ai-chat-close" onClick={() => setOpen(false)} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="ai-chat-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`ai-chat-bubble ${msg.role}`}>
                {msg.role === 'model' && <div className="ai-chat-bubble-label">AI Assistant</div>}
                <div className="ai-chat-bubble-text">{msg.text}</div>
              </div>
            ))}

            {loading && (
              <div className="ai-chat-bubble model">
                <div className="ai-chat-bubble-label">AI Assistant</div>
                <div className="ai-chat-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}

            {error && (
              <div className="ai-chat-error">⚠ {error}</div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form className="ai-chat-input-area" onSubmit={send}>
            <textarea
              ref={inputRef}
              className="ai-chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about FIR process, IPC sections, your rights…"
              rows={2}
              disabled={loading}
            />
            <button
              type="submit"
              className="ai-chat-send"
              disabled={!input.trim() || loading}
              aria-label="Send"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
