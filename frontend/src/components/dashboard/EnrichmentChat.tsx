import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  startEnrichment, sendEnrichmentMessage, getEnrichmentStatus,
} from '../../api/fir';
import { capture } from '../../lib/posthog';

interface Props {
  firId: string;
  firNumber: string;
  onDone: () => void;
  onLater: () => void;
}

interface ChatMessage {
  role: 'assistant' | 'user';
  content: string;
}

const MAX_TURNS = 10;

export default function EnrichmentChat({ firId, firNumber, onDone, onLater }: Props) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [turnCount, setTurnCount] = useState(0);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [locked, setLocked] = useState(false);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    getEnrichmentStatus(token, firId)
      .then(async s => {
        setTurnCount(s.turn_count);
        if (s.is_locked) { setLocked(true); setLoading(false); return; }
        if (s.enrichment_status === 'expired') { setExpired(true); setLoading(false); return; }
        if (s.enrichment_status === 'complete') { setDone(true); setLoading(false); return; }
        if (s.enrichment_status === 'in_progress' && s.last_question) {
          setMessages([{ role: 'assistant', content: s.last_question }]);
          setLoading(false);
          return;
        }
        // pending or unavailable — auto-start
        const r = await startEnrichment(token, firId);
        capture('enrichment_started', { fir_id: firId });
        setMessages([{ role: 'assistant', content: r.question }]);
        setTurnCount(r.turn_count);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [firId, token]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleSend = async () => {
    const ans = answer.trim();
    if (!ans || sending || !token) return;
    setMessages(prev => [...prev, { role: 'user', content: ans }]);
    setAnswer('');
    setSending(true);
    setError('');
    try {
      const result = await sendEnrichmentMessage(token, firId, ans);
      setTurnCount(result.turn_count);
      if (result.done) {
        capture('enrichment_completed', { fir_id: firId, turns: result.turn_count });
        setDone(true);
      } else if (result.question) {
        setMessages(prev => [...prev, { role: 'assistant', content: result.question! }]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send. Your answer is saved — try again.');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="dash-loading">Starting enrichment session…</div>;

  if (locked) return (
    <div className="dash-card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔒</div>
      <h3 style={{ marginBottom: '0.5rem' }}>Enrichment Locked</h3>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        An officer has acknowledged this FIR. The enrichment window is now closed.
      </p>
      <button className="btn-secondary" onClick={onLater}>← Back to FIR</button>
    </div>
  );

  if (expired) return (
    <div className="dash-card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⌛</div>
      <h3 style={{ marginBottom: '0.5rem' }}>Enrichment Expired</h3>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        The officer acknowledged this FIR before enrichment was completed.
      </p>
      <button className="btn-secondary" onClick={onLater}>← Back to FIR</button>
    </div>
  );

  if (done) return (
    <div className="dash-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', margin: '0 auto 1rem' }}>✓</div>
      <h3 style={{ color: '#16a34a', marginBottom: '0.5rem' }}>Enrichment Complete</h3>
      <p style={{ color: '#64748b', fontSize: '0.875rem', maxWidth: 380, margin: '0 auto 1.75rem', lineHeight: 1.6 }}>
        Your answers have been processed. The investigating officer will see an AI-enriched summary of your case alongside your original complaint.
      </p>
      <button className="btn-primary" onClick={onDone}>View FIR Details</button>
    </div>
  );

  const answeredCount = messages.filter(m => m.role === 'user').length;
  const awaitingAnswer = messages.length > 0 && messages[messages.length - 1].role === 'assistant';
  const isLastQuestion = turnCount >= MAX_TURNS - 1;

  return (
    <>
      <button className="back-btn" onClick={onLater}>← Back</button>

      <div className="dash-header">
        <h1>AI Enrichment — {firNumber}</h1>
        <p>Answer up to {MAX_TURNS} questions to help the officer understand your case better</p>
      </div>

      <div className="dash-card">
        {/* Progress */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', marginBottom: '0.4rem' }}>
            <span>Questions answered</span>
            <span>{answeredCount} / {MAX_TURNS}</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: '#3b82f6', borderRadius: 999,
              width: `${(answeredCount / MAX_TURNS) * 100}%`, transition: 'width 0.3s ease',
            }} />
          </div>
        </div>

        {/* Chat */}
        <div className="interview-chat" style={{ marginBottom: '1rem' }}>
          {messages.map((msg, idx) => (
            <div key={idx} className={`interview-bubble ${msg.role === 'assistant' ? 'ai' : 'user'}`}>
              {msg.role === 'assistant' && <div className="interview-bubble-label">AI Officer</div>}
              <div className="interview-bubble-text">{msg.content}</div>
            </div>
          ))}
          {sending && (
            <div className="interview-bubble ai">
              <div className="interview-bubble-label">AI Officer</div>
              <div className="interview-typing"><span /><span /><span /></div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {error && (
          <div className="dash-error" style={{ marginBottom: '0.75rem', fontSize: '0.8rem' }}>⚠ {error}</div>
        )}

        {/* Input */}
        {awaitingAnswer && (
          <div className="interview-input-row">
            <textarea
              className="interview-answer-input"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={isLastQuestion ? 'Final answer…' : 'Type your answer… (Enter to submit)'}
              rows={2}
              disabled={sending}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={handleSend}
              disabled={!answer.trim() || sending}
              style={{ alignSelf: 'flex-end', whiteSpace: 'nowrap' }}
            >
              {isLastQuestion ? 'Submit Final Answer' : 'Submit Answer'}
            </button>
          </div>
        )}

        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button
            type="button"
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => { capture('enrichment_skipped', { fir_id: firId, turns_completed: turnCount }); onLater(); }}
          >
            I'll complete this later
          </button>
        </div>
      </div>
    </>
  );
}
