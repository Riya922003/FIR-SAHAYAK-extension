import { useState, FormEvent, Fragment, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fileFIR, getNearbyStations, conductInterview, summarizeInterview,
  type PoliceStation, type IncidentType, type InterviewMessage, INCIDENT_LABELS,
} from '../../api/fir';

interface Props {
  onSuccess: (firNumber: string) => void;
  onCancel: () => void;
}

const INCIDENT_TYPES = Object.entries(INCIDENT_LABELS) as [IncidentType, string][];

const STEPS = [
  { label: 'Incident' },
  { label: 'Location' },
  { label: 'Details' },
  { label: 'AI Interview' },
  { label: 'IPC Sections' },
  { label: 'Review' },
];

const EMPTY_FORM = {
  station_id: '',
  incident_type: '' as IncidentType | '',
  description: '',
  incident_location: '',
  incident_date: '',
  incident_time: '',
  complainant_address: '',
  witness_info: '',
};

const MAX_QUESTIONS = 10;

export default function FileFIR({ onSuccess, onCancel }: Props) {
  const { token, user } = useAuth();

  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Station search
  const [nearbyStations, setNearbyStations] = useState<PoliceStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<PoliceStation | null>(null);
  const [showStationList, setShowStationList] = useState(false);
  const [stationSearching, setStationSearching] = useState(false);
  const [stationError, setStationError] = useState('');
  const [searchedAddress, setSearchedAddress] = useState('');

  // AI Interview state
  const [interviewMsgs, setInterviewMsgs] = useState<InterviewMessage[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [questionCount, setQuestionCount] = useState(0);
  const [interviewDone, setInterviewDone] = useState(false);
  const [interviewSkipped, setInterviewSkipped] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  // AI results
  const [aiSummary, setAiSummary] = useState('');
  const [suggestedIPC, setSuggestedIPC] = useState('');
  const [ipcAccepted, setIpcAccepted] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-start interview when entering step 3
  useEffect(() => {
    if (currentStep === 3 && interviewMsgs.length === 0 && !interviewSkipped && !aiLoading) {
      fetchNextQuestion([], 0);
    }
  }, [currentStep]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [interviewMsgs, aiLoading]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (name === 'incident_location' && searchedAddress && value !== searchedAddress) {
      setNearbyStations([]);
      setSelectedStation(null);
      setShowStationList(false);
      setSearchedAddress('');
      setForm(prev => ({ ...prev, station_id: '', incident_location: value }));
    }
  };

  const findNearbyStations = async () => {
    const addr = form.incident_location.trim();
    if (!addr) return;
    setStationSearching(true);
    setStationError('');
    setNearbyStations([]);
    setSelectedStation(null);
    setForm(prev => ({ ...prev, station_id: '' }));
    try {
      const stations = await getNearbyStations(addr);
      setNearbyStations(stations);
      setSearchedAddress(addr);
      if (stations.length === 0) {
        setStationError('No stations found. Try adding city or district name.');
      } else {
        setShowStationList(true);
      }
    } catch (e: unknown) {
      setStationError(e instanceof Error ? e.message : 'Could not find nearby stations.');
    } finally {
      setStationSearching(false);
    }
  };

  const selectStation = (station: PoliceStation) => {
    setSelectedStation(station);
    setForm(prev => ({ ...prev, station_id: station.id }));
    setShowStationList(false);
  };

  // ── AI Interview ─────────────────────────────────────────────────────────────

  const fetchNextQuestion = async (history: InterviewMessage[], qCount: number) => {
    setAiLoading(true);
    setError('');
    try {
      const result = await conductInterview(token!, {
        incident_type: form.incident_type,
        description: form.description,
        history,
        question_count: qCount,
      });

      if (result.done) {
        setInterviewDone(true);
        await doSummarize(history);
      } else {
        setInterviewMsgs([...history, { role: 'model', text: result.question }]);
        setQuestionCount(qCount + 1);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'AI interview failed. You can skip to continue.');
    } finally {
      setAiLoading(false);
    }
  };

  const submitAnswer = async () => {
    const ans = currentAnswer.trim();
    if (!ans || aiLoading) return;

    const updatedHistory: InterviewMessage[] = [
      ...interviewMsgs,
      { role: 'user', text: ans },
    ];
    setInterviewMsgs(updatedHistory);
    setCurrentAnswer('');

    if (questionCount >= MAX_QUESTIONS) {
      setInterviewDone(true);
      await doSummarize(updatedHistory);
    } else {
      await fetchNextQuestion(updatedHistory, questionCount);
    }
  };

  const doSummarize = async (msgs: InterviewMessage[]) => {
    setSummarizing(true);
    try {
      const result = await summarizeInterview(token!, {
        incident_type: form.incident_type,
        description: form.description,
        conversation: msgs,
      });
      setAiSummary(result.summary);
      setSuggestedIPC(result.ipc_sections);
      setCurrentStep(4);
    } catch {
      // Summary failed — skip to IPC step anyway
      setCurrentStep(4);
    } finally {
      setSummarizing(false);
    }
  };

  const skipInterview = () => {
    setInterviewSkipped(true);
    setCurrentStep(4);
  };

  const acceptIPC = () => {
    setIpcAccepted(true);
    setCurrentStep(5);
  };

  const skipIPC = () => {
    setIpcAccepted(false);
    setCurrentStep(5);
  };

  // ── Validation & navigation ──────────────────────────────────────────────────

  const validateStep = (step: number): string => {
    if (step === 0) {
      if (!form.incident_type) return 'Please select an incident type';
      if (!form.incident_date) return 'Please enter the incident date';
    }
    if (step === 1) {
      if (!form.incident_location.trim()) return 'Please enter the incident location';
      if (!form.station_id) return 'Please search for and select a police station';
    }
    if (step === 2) {
      const rem = 50 - form.description.length;
      if (rem > 0) return `Description needs ${rem} more character${rem !== 1 ? 's' : ''}`;
      if (!form.complainant_address.trim()) return 'Please enter your residential address';
    }
    return '';
  };

  const goNext = () => {
    const err = validateStep(currentStep);
    if (err) { setError(err); return; }
    setError('');
    setCurrentStep(s => s + 1);
  };

  const goBack = () => {
    setError('');
    setCurrentStep(s => s - 1);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fir = await fileFIR(token!, {
        station_id: form.station_id,
        incident_type: form.incident_type as IncidentType,
        description: form.description,
        incident_location: form.incident_location,
        incident_date: form.incident_date,
        incident_time: form.incident_time || undefined,
        complainant_name: user!.full_name,
        complainant_address: form.complainant_address,
        complainant_phone: user!.phone,
        witness_info: form.witness_info || undefined,
        ai_interview_summary: aiSummary || undefined,
        suggested_ipc_sections: ipcAccepted ? suggestedIPC : undefined,
      });
      onSuccess(fir.fir_number);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to file FIR');
    } finally {
      setLoading(false);
    }
  };

  const descLen = form.description.length;
  const canSearch = form.incident_location.trim().length >= 10 && !stationSearching;
  const locationChanged = searchedAddress && form.incident_location !== searchedAddress;

  // Questions answered so far (user turns only)
  const answeredCount = interviewMsgs.filter(m => m.role === 'user').length;
  const currentQuestion = interviewMsgs.length > 0 && interviewMsgs[interviewMsgs.length - 1].role === 'model'
    ? interviewMsgs[interviewMsgs.length - 1].text
    : null;

  return (
    <>
      <button className="back-btn" onClick={onCancel}>← Back</button>

      <div className="dash-header">
        <h1>File a Complaint</h1>
        <p>Submit your complaint — it will be assigned to the nearest police station</p>
      </div>

      {/* Step Timeline */}
      <div className="fir-steps">
        {STEPS.map((step, idx) => {
          const isDone   = idx < currentStep;
          const isActive = idx === currentStep;
          return (
            <Fragment key={idx}>
              <div className="fir-step-item">
                <div className={`fir-step-dot${isDone ? ' done' : isActive ? ' active' : ''}`}>
                  {isDone ? '✓' : idx + 1}
                </div>
                <div className={`fir-step-label${isDone ? ' done' : isActive ? ' active' : ''}`}>
                  {step.label}
                </div>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`fir-step-conn${isDone ? ' done' : ''}`} />
              )}
            </Fragment>
          );
        })}
      </div>

      {error && (
        <div className="dash-error" style={{ marginBottom: '1rem' }}>⚠ {error}</div>
      )}

      <div className="dash-card">
        <form className="file-fir-form" onSubmit={handleSubmit}>

          {/* ══ Step 0 — Incident ══ */}
          {currentStep === 0 && (
            <div>
              <div className="form-section-title">Incident Information</div>
              <div className="form-row-2">
                <div className="form-group-dash">
                  <label>Incident Type *</label>
                  <select name="incident_type" value={form.incident_type} onChange={handleChange}>
                    <option value="">Select type…</option>
                    {INCIDENT_TYPES.map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group-dash">
                  <label>Incident Date *</label>
                  <input
                    type="date"
                    name="incident_date"
                    value={form.incident_date}
                    onChange={handleChange}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
              <div className="form-row-2" style={{ marginTop: '1rem' }}>
                <div className="form-group-dash">
                  <label>Incident Time (optional)</label>
                  <input type="time" name="incident_time" value={form.incident_time} onChange={handleChange} />
                </div>
                <div />
              </div>
            </div>
          )}

          {/* ══ Step 1 — Location & Station ══ */}
          {currentStep === 1 && (
            <div>
              <div className="form-section-title">Location & Police Station</div>
              <div className="form-group-dash">
                <label>Incident Location *</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                  <input
                    type="text"
                    name="incident_location"
                    value={form.incident_location}
                    onChange={handleChange}
                    placeholder="e.g. Near SBI ATM, Sector 21, Noida"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={findNearbyStations}
                    disabled={!canSearch}
                    style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    {stationSearching ? 'Searching…' : locationChanged ? 'Search Again' : 'Find Stations'}
                  </button>
                </div>
                {!searchedAddress && (
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.35rem' }}>
                    Enter where the incident happened, then click "Find Stations".
                  </div>
                )}
                {locationChanged && (
                  <div style={{ fontSize: '0.78rem', color: '#f59e0b', marginTop: '0.35rem' }}>
                    Location changed — click "Search Again" to update nearby stations.
                  </div>
                )}
              </div>

              {stationSearching && (
                <div style={{ padding: '0.75rem 0', color: '#64748b', fontSize: '0.875rem' }}>
                  Locating nearby police stations…
                </div>
              )}
              {stationError && !stationSearching && (
                <div className="dash-error" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                  {stationError}
                </div>
              )}

              {selectedStation && !showStationList && (
                <div className="form-group-dash" style={{ marginTop: '0.75rem' }}>
                  <label>Selected Police Station *</label>
                  <div className="station-card selected" style={{ cursor: 'default' }}>
                    <div style={{ flex: 1 }}>
                      <div className="station-card-name">{selectedStation.name}</div>
                      <div className="station-card-address">{selectedStation.address}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#22c55e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>✓</span>
                      <button type="button" className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }} onClick={() => setShowStationList(true)}>Change</button>
                    </div>
                  </div>
                </div>
              )}

              {!stationSearching && nearbyStations.length > 0 && showStationList && (
                <div className="form-group-dash" style={{ marginTop: '0.75rem' }}>
                  <label>Select Police Station *</label>
                  <div className="station-picker">
                    {nearbyStations.map(s => {
                      const isSelected = selectedStation?.id === s.id;
                      return (
                        <div
                          key={s.id}
                          className={`station-card${isSelected ? ' selected' : ''}`}
                          onClick={() => selectStation(s)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={e => e.key === 'Enter' && selectStation(s)}
                        >
                          <div>
                            <div className="station-card-name">{s.name}</div>
                            <div className="station-card-address">{s.address}</div>
                          </div>
                          {isSelected && (
                            <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#22c55e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', flexShrink: 0 }}>✓</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ Step 2 — Details ══ */}
          {currentStep === 2 && (
            <div>
              <div className="form-section-title">Description & Your Details</div>
              <div className="form-group-dash">
                <label>Description * (min 50 characters)</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Describe the incident in detail — what happened, when, who was involved, any evidence…"
                  rows={5}
                />
                <div className={`char-count ${descLen < 50 ? 'warn' : 'ok'}`}>
                  {descLen} / 50 min {descLen >= 50 ? '✓' : `(${50 - descLen} more needed)`}
                </div>
              </div>
              <div className="form-group-dash" style={{ marginTop: '1rem' }}>
                <label>Residential Address *</label>
                <input
                  type="text"
                  name="complainant_address"
                  value={form.complainant_address}
                  onChange={handleChange}
                  placeholder="House No., Street, Area, City, PIN"
                />
              </div>
              <div className="form-group-dash" style={{ marginTop: '1rem' }}>
                <label>Witness Information (optional)</label>
                <textarea
                  name="witness_info"
                  value={form.witness_info}
                  onChange={handleChange}
                  placeholder="Names, contact details, or descriptions of any witnesses…"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* ══ Step 3 — AI Interview ══ */}
          {currentStep === 3 && (
            <div>
              <div className="form-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>AI-Guided Interview</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#64748b', textTransform: 'none', letterSpacing: 0 }}>
                  {interviewDone || summarizing ? 'Complete' : `Question ${Math.min(answeredCount + 1, MAX_QUESTIONS)} of ${MAX_QUESTIONS}`}
                </span>
              </div>

              <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1rem' }}>
                Our AI will ask up to {MAX_QUESTIONS} targeted questions to help gather all relevant details for your case. These answers will be summarised and shared with the investigating officer.
              </p>

              {/* Progress bar */}
              {!interviewDone && !summarizing && (
                <div className="interview-progress">
                  <div
                    className="interview-progress-fill"
                    style={{ width: `${(answeredCount / MAX_QUESTIONS) * 100}%` }}
                  />
                </div>
              )}

              {/* Chat area */}
              <div className="interview-chat">
                {interviewMsgs.map((msg, idx) => (
                  <div key={idx} className={`interview-bubble ${msg.role === 'model' ? 'ai' : 'user'}`}>
                    {msg.role === 'model' && (
                      <div className="interview-bubble-label">AI Officer</div>
                    )}
                    <div className="interview-bubble-text">{msg.text}</div>
                  </div>
                ))}

                {/* Loading indicator */}
                {(aiLoading || summarizing) && (
                  <div className="interview-bubble ai">
                    <div className="interview-bubble-label">AI Officer</div>
                    <div className="interview-typing">
                      <span /><span /><span />
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Answer input — only show if interview not done */}
              {!interviewDone && !summarizing && currentQuestion && (
                <div className="interview-input-row">
                  <textarea
                    className="interview-answer-input"
                    value={currentAnswer}
                    onChange={e => setCurrentAnswer(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        submitAnswer();
                      }
                    }}
                    placeholder="Type your answer… (Enter to submit)"
                    rows={2}
                    disabled={aiLoading}
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={submitAnswer}
                    disabled={!currentAnswer.trim() || aiLoading}
                    style={{ alignSelf: 'flex-end', whiteSpace: 'nowrap' }}
                  >
                    Submit Answer
                  </button>
                </div>
              )}

              {summarizing && (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#64748b', fontSize: '0.875rem' }}>
                  Generating case summary for the officer…
                </div>
              )}
            </div>
          )}

          {/* ══ Step 4 — IPC Sections ══ */}
          {currentStep === 4 && (
            <div>
              <div className="form-section-title">Suggested IPC Sections</div>

              {interviewSkipped && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#64748b' }}>
                  AI interview was skipped. You can still proceed to file your FIR.
                </div>
              )}

              {aiSummary && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div className="section-label" style={{ marginBottom: '0.5rem' }}>AI Case Summary</div>
                  <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#0c4a6e', lineHeight: 1.6 }}>
                    {aiSummary}
                  </div>
                </div>
              )}

              {suggestedIPC ? (
                <>
                  <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '0.875rem' }}>
                    Based on your complaint and interview, the AI suggests the following IPC sections apply to your case. Accept them to include them in your FIR, or skip.
                  </p>
                  <div className="ipc-suggestion-box">
                    {suggestedIPC.split('\n').filter(Boolean).map((line, i) => (
                      <div key={i} className="ipc-suggestion-row">
                        <span className="ipc-dot">§</span>
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                    <button type="button" className="btn-primary" onClick={acceptIPC}>
                      Accept & Continue
                    </button>
                    <button type="button" className="btn-secondary" onClick={skipIPC}>
                      Skip
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8', fontSize: '0.875rem' }}>
                  <p>No IPC suggestions available.</p>
                  <button type="button" className="btn-primary" onClick={skipIPC} style={{ marginTop: '0.75rem' }}>
                    Continue to Review
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ══ Step 5 — Review ══ */}
          {currentStep === 5 && (
            <div>
              <div className="form-section-title">Review Your Complaint</div>
              <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.25rem' }}>
                Please review all details before submitting.
              </p>

              <div className="fir-review-block">
                <div className="fir-review-head">Incident</div>
                <div className="fir-review-row">
                  <span>Type</span><span>{INCIDENT_LABELS[form.incident_type as IncidentType] || '—'}</span>
                </div>
                <div className="fir-review-row">
                  <span>Date</span>
                  <span>{form.incident_date ? new Date(form.incident_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</span>
                </div>
                {form.incident_time && (
                  <div className="fir-review-row"><span>Time</span><span>{form.incident_time}</span></div>
                )}
              </div>

              <div className="fir-review-block">
                <div className="fir-review-head">Location & Station</div>
                <div className="fir-review-row"><span>Location</span><span>{form.incident_location}</span></div>
                <div className="fir-review-row"><span>Station</span><span>{selectedStation?.name || '—'}</span></div>
                {selectedStation?.address && (
                  <div className="fir-review-row"><span>Address</span><span>{selectedStation.address}</span></div>
                )}
              </div>

              <div className="fir-review-block">
                <div className="fir-review-head">Description</div>
                <div className="fir-review-desc">{form.description}</div>
                {form.witness_info && (
                  <>
                    <div className="fir-review-head" style={{ marginTop: '0.75rem' }}>Witness Information</div>
                    <div style={{ fontSize: '0.875rem', color: '#334155' }}>{form.witness_info}</div>
                  </>
                )}
              </div>

              <div className="fir-review-block">
                <div className="fir-review-head">Complainant</div>
                <div className="fir-review-row"><span>Name</span><span>{user?.full_name}</span></div>
                <div className="fir-review-row"><span>Phone</span><span>{user?.phone}</span></div>
                <div className="fir-review-row"><span>Address</span><span>{form.complainant_address}</span></div>
              </div>

              {aiSummary && (
                <div className="fir-review-block" style={{ borderLeft: '3px solid #3b82f6' }}>
                  <div className="fir-review-head" style={{ color: '#1d4ed8' }}>AI Interview Summary</div>
                  <div style={{ fontSize: '0.875rem', color: '#1e3a5f', lineHeight: 1.6 }}>{aiSummary}</div>
                </div>
              )}

              {ipcAccepted && suggestedIPC && (
                <div className="fir-review-block" style={{ borderLeft: '3px solid #8b5cf6' }}>
                  <div className="fir-review-head" style={{ color: '#7c3aed' }}>Suggested IPC Sections</div>
                  <div style={{ fontSize: '0.875rem', color: '#4c1d95', whiteSpace: 'pre-line' }}>{suggestedIPC}</div>
                </div>
              )}
            </div>
          )}

          {/* ── Navigation ── */}
          {currentStep < 3 && (
            <div className="action-bar" style={{ marginTop: '1.75rem', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {currentStep > 0 && (
                  <button type="button" className="btn-secondary" onClick={goBack}>← Back</button>
                )}
                <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
              </div>
              <button type="button" className="btn-primary" onClick={goNext} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                Next
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
            </div>
          )}

          {/* Interview step footer */}
          {currentStep === 3 && !interviewDone && !summarizing && (
            <div className="action-bar" style={{ marginTop: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" className="btn-secondary" onClick={goBack}>← Back</button>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={skipInterview}
              >
                Skip AI Interview
              </button>
            </div>
          )}

          {currentStep === 5 && (
            <div className="action-bar" style={{ marginTop: '1.75rem', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" className="btn-secondary" onClick={goBack} disabled={loading}>← Back</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Filing FIR…' : 'Submit FIR'}
              </button>
            </div>
          )}

        </form>
      </div>
    </>
  );
}
