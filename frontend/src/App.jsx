import { useState, useEffect, useCallback, useRef } from 'react';

// In production the frontend is on Vercel and backend on Railway — different origins
const API = import.meta.env.VITE_API_URL || '';

// ── Token helpers (localStorage) ──────────────────────────────────────────────
function getToken() { return localStorage.getItem('auth_token'); }
function setToken(t) { localStorage.setItem('auth_token', t); }
function clearToken() { localStorage.removeItem('auth_token'); }
function apiFetch(url, opts = {}) {
  const token = getToken();
  const headers = { ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...opts, headers });
}

// ── Auth hook ─────────────────────────────────────────────────────────────────
function useAuth() {
  const [user, setUser]           = useState(null);
  const [checking, setChecking]   = useState(true);
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    // Read token from URL if just redirected from OAuth
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      setToken(urlToken);
      window.history.replaceState({}, '', window.location.pathname);
    }

    Promise.all([
      apiFetch(`${API}/auth/status`).then(r => r.json()).catch(() => ({ authRequired: false })),
      apiFetch(`${API}/auth/me`).then(r => { if (!r.ok) { clearToken(); return null; } return r.json(); }).catch(() => null),
    ]).then(([status, me]) => {
      setAuthRequired(status.authRequired || false);
      setUser(me);
      setChecking(false);
    });
  }, []);

  const logout = () => {
    clearToken();
    setUser(null);
    window.location.href = `${API}/auth/logout`;
  };

  return { user, checking, authRequired, logout };
}

// ── Auth Screen ───────────────────────────────────────────────────────────────
function AuthScreen() {
  const params = new URLSearchParams(window.location.search);
  const failed = params.get('auth') === 'failed';

  const googleConfigured = true; // always show — backend guards if not configured
  const githubConfigured = true;

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
          <svg width="52" height="52" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="36" height="36" rx="9" fill="#1E3A8A"/>
            <text x="18" y="25" textAnchor="middle" fill="white" fontSize="18" fontWeight="700" fontFamily="Georgia, serif">$</text>
            <circle cx="27" cy="9" r="1.5" fill="#60A5FA"/>
            <line x1="27" y1="6" x2="27" y2="7.5" stroke="#60A5FA" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="27" y1="10.5" x2="27" y2="12" stroke="#60A5FA" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="24" y1="9" x2="25.5" y2="9" stroke="#60A5FA" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="28.5" y1="9" x2="30" y2="9" stroke="#60A5FA" strokeWidth="1.2" strokeLinecap="round"/>
            <polyline points="22,28 25,25 28,26" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
          <div className="auth-logo-name">AI Spend Optimizer</div>
          <div className="auth-logo-tagline">Track · Optimize · Save on your AI stack</div>
        </div>

        {failed && (
          <div className="auth-error">Sign-in failed. Please try again or check your OAuth credentials.</div>
        )}

        <div className="auth-divider-label">Sign in to get started</div>

        <div className="auth-providers">
          <a href={`${API}/auth/google`} className="auth-btn auth-btn-google">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </a>

          <a href={`${API}/auth/github`} className="auth-btn auth-btn-github">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
            </svg>
            Continue with GitHub
          </a>

          <div className="auth-btn auth-btn-microsoft auth-btn-soon">
            <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
              <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
            </svg>
            Continue with Microsoft
            <span className="auth-soon-pill">Soon</span>
          </div>
        </div>

        <div className="auth-footer">
          By signing in you agree to our Terms of Service.<br/>
          Your data is stored securely and never sold.
        </div>
      </div>
    </div>
  );
}

const CATEGORIES = ['auto', 'writing', 'coding', 'design', 'research', 'other'];
const CAT_OPTIONS = ['writing', 'coding', 'design', 'research', 'other'];

const BADGE_CLASS = {
  writing: 'badge-writing', coding: 'badge-coding',
  design: 'badge-design', research: 'badge-research', other: 'badge-other',
};

// ── Animated number counter hook ─────────────────────────────────────────────
function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (target == null) return;
    const start = prev.current;
    const diff  = target - start;
    if (diff === 0) return;
    const startTime = performance.now();
    const raf = (now) => {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setValue(start + diff * ease);
      if (t < 1) requestAnimationFrame(raf);
      else { setValue(target); prev.current = target; }
    };
    requestAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

// ── Shimmer skeleton ──────────────────────────────────────────────────────────
function SkeletonStack() {
  return (
    <div className="tools-grid">
      {[1, 2, 3].map(i => <div key={i} className="skeleton-card" />)}
    </div>
  );
}

// ── Scan animation overlay ────────────────────────────────────────────────────
function ScanOverlay({ active }) {
  if (!active) return null;
  return (
    <div className="scan-overlay">
      <div className="scan-spinner">
        <div className="scan-spinner-ring outer" />
        <div className="scan-spinner-ring mid" />
        <div className="scan-spinner-dot" />
      </div>
      <div className="scan-line" />
      <div>
        <div className="scan-overlay-title">Scanning for subscriptions…</div>
        <div className="scan-overlay-sub">Detecting AI tools and pricing patterns</div>
      </div>
    </div>
  );
}

// ── Upload drop zone ──────────────────────────────────────────────────────────
function DropZone({ onFile }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handle = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => onFile(e.target.result);
    reader.readAsText(file);
  };

  return (
    <div
      className={`drop-zone${dragging ? ' drag' : ''}`}
      onClick={() => inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]); }}
    >
      <div className="drop-zone-icon">📂</div>
      <div className="drop-zone-text">
        {dragging ? 'Drop to upload' : 'Drag & drop CSV file, or click to browse'}
      </div>
      <div className="drop-zone-hint">Supports .csv · name, cost, category columns</div>
      <input ref={inputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
        onChange={e => handle(e.target.files[0])} />
    </div>
  );
}

// ── ImportPanel ───────────────────────────────────────────────────────────────
function ImportPanel({ onImported }) {
  const [open, setOpen]             = useState(true);
  const [tab, setTab]               = useState('csv');
  const [input, setInput]           = useState('');
  const [emailAddr, setEmailAddr]   = useState('');
  const [scanning, setScanning]     = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [importing, setImporting]   = useState(false);
  const [result, setResult]         = useState(null);

  const reset = () => { setCandidates([]); setResult(null); };

  const scan = async (text) => {
    const src = text ?? input;
    if (tab !== 'email' && !src.trim()) return;
    if (tab === 'email' && !emailAddr.trim()) return;
    setScanning(true);
    reset();
    let endpoint, body;
    if (tab === 'csv')   { endpoint = '/scan/csv';  body = { csv: src }; }
    if (tab === 'text')  { endpoint = '/scan/text'; body = { text: src }; }
    if (tab === 'email') { endpoint = '/scan/text'; body = { text: emailAddr }; }
    if (!endpoint) { setScanning(false); return; }
    try {
      const res = await apiFetch(`${API}${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setCandidates((data.candidates || []).map(c => ({
        ...c, accepted: true,
        editName: c.name, editCost: String(c.cost), editCat: c.category,
      })));
    } catch (e) {
      console.error('Scan error:', e);
    }
    setScanning(false);
  };

  const toggle = (id) => setCandidates(cs => cs.map(c => c.id === id ? { ...c, accepted: !c.accepted } : c));
  const update = (id, f, v) => setCandidates(cs => cs.map(c => c.id === id ? { ...c, [f]: v } : c));

  const confirmImport = async () => {
    const accepted = candidates.filter(c => c.accepted);
    if (!accepted.length) return;
    setImporting(true);
    const res = await apiFetch(`${API}/scan/confirm`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidates: accepted.map(c => ({ name: c.editName, cost: parseFloat(c.editCost) || 0, category: c.editCat })) }),
    });
    const data = await res.json();
    setResult(data.imported);
    setCandidates([]);
    setInput('');
    setImporting(false);
    onImported();
  };

  const accepted = candidates.filter(c => c.accepted);

  return (
    <>
      <ScanOverlay active={scanning} />
      <div style={{ marginTop: 12 }}>
        <button className="import-toggle" onClick={() => setOpen(o => !o)}>
          {open ? '▲ Hide Import' : '📥 Import from CSV or paste text'}
        </button>

        {open && (
          <div className="import-panel">
            <div className="import-tabs">
              <button className={`tab-btn${tab === 'csv' ? ' active' : ''}`}
                onClick={() => { setTab('csv'); reset(); setInput(''); }}>📄 CSV</button>
              <button className={`tab-btn${tab === 'text' ? ' active' : ''}`}
                onClick={() => { setTab('text'); reset(); setInput(''); }}>📋 Paste Text</button>
              <button className={`tab-btn${tab === 'email' ? ' active' : ''}`}
                onClick={() => { setTab('email'); reset(); setInput(''); }}>✉️ Email</button>
            </div>

            {tab === 'csv' ? (
              <>
                <DropZone onFile={text => { setInput(text); reset(); }} />
                <textarea
                  placeholder={"Or paste CSV directly:\nname,cost,category\nChatGPT,20,writing\nCursor,20,coding"}
                  value={input}
                  onChange={e => { setInput(e.target.value); reset(); }}
                />
                <div className="import-hint">Header row optional · Columns: name, cost, category</div>
              </>
            ) : (
              <>
                <textarea
                  placeholder={"Paste any text — bank statement, email, notes:\n  ChatGPT Plus $20/month\n  Paid Cursor Pro - $20\n  Midjourney Standard plan $30"}
                  value={input}
                  onChange={e => { setInput(e.target.value); reset(); }}
                />
                <div className="import-hint">Detects AI tool names + dollar amounts in free-form text</div>
              </>
            )}

            {tab === 'email' && (
              <div className="email-scan-panel">
                <div className="email-scan-info">
                  <div className="email-scan-title">📧 Paste forwarded subscription emails</div>
                  <div className="email-scan-desc">
                    Forward any billing or subscription confirmation emails to yourself, then paste the full email text below. The scanner detects AI tool names, plan tiers, and pricing from email body text.
                  </div>
                </div>
                <textarea
                  placeholder={"Paste the full email text here:\n\nFrom: billing@openai.com\nSubject: Your ChatGPT Plus subscription\n\nYour monthly subscription of $20.00 has been renewed..."}
                  value={emailAddr}
                  onChange={e => { setEmailAddr(e.target.value); reset(); }}
                />
                <div className="import-hint">Supports billing receipts, renewal notices, and subscription confirmation emails from any AI provider</div>
              </div>
            )}

            <button
              className="scan-btn"
              onClick={() => scan()}
              disabled={scanning || (tab === 'email' ? !emailAddr.trim() : !input.trim())}
            >
              🔍 Scan for Subscriptions
            </button>

            {result != null && (
              <div className="optimization-insight" style={{ marginTop: 10 }}>
                <span>✅</span><span>Imported {result} tool{result !== 1 ? 's' : ''} successfully.</span>
              </div>
            )}

            {candidates.length > 0 && (
              <div className="candidates-panel">
                <h3>{candidates.length} tools detected — review before importing</h3>
                {candidates.map(c => (
                  <div key={c.id} className={`candidate-row${!c.accepted ? ' rejected' : ''}`}>
                    <input type="checkbox" checked={c.accepted} onChange={() => toggle(c.id)} />
                    <div>
                      <input type="text" value={c.editName}
                        onChange={e => update(c.id, 'editName', e.target.value)} />
                      <div className="conf-bar" style={{ '--target-width': `${c.confidence * 100}%`, width: `${c.confidence * 100}%` }} />
                      <div className="conf-label">{Math.round(c.confidence * 100)}% confidence · {c.source}</div>
                    </div>
                    <input type="number" value={c.editCost} min="0" step="0.01"
                      onChange={e => update(c.id, 'editCost', e.target.value)} />
                    <select className="cand-cat-sel" value={c.editCat}
                      onChange={e => update(c.id, 'editCat', e.target.value)}>
                      {CAT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <button onClick={() => toggle(c.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '.9rem',
                               color: c.accepted ? '#FF375F' : '#30D158' }}>
                      {c.accepted ? '✕' : '✓'}
                    </button>
                  </div>
                ))}
                <button className="import-confirm-btn" onClick={confirmImport}
                  disabled={importing || accepted.length === 0}>
                  {importing
                    ? 'Importing…'
                    : `✅ Import ${accepted.length} Tool${accepted.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { user, checking, authRequired, logout } = useAuth();
  const [tools, setTools]       = useState([]);
  const [insights, setInsights] = useState(null);
  const [form, setForm]         = useState({ name: '', cost: '', category: 'auto' });
  const [detectedCat, setDetectedCat] = useState(null);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const detectTimer             = useRef(null);

  const animatedSpend = useCountUp(insights?.totalSpend ?? null);

  const fetchAll = useCallback(async () => {
    const [t, i] = await Promise.all([
      apiFetch(`${API}/subscriptions`).then(r => r.json()),
      apiFetch(`${API}/insights`).then(r => r.json()),
    ]);
    setTools(t);
    setInsights(i);
    setInitialLoad(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleNameChange = (val) => {
    setForm(f => ({ ...f, name: val }));
    clearTimeout(detectTimer.current);
    if (val.trim().length < 2) { setDetectedCat(null); return; }
    detectTimer.current = setTimeout(async () => {
      const res = await apiFetch(`${API}/detect-category?name=${encodeURIComponent(val)}`);
      const d = await res.json();
      setDetectedCat(d.category || null);
    }, 300);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.cost) { setError('Please fill in all fields.'); return; }
    if (isNaN(parseFloat(form.cost)) || parseFloat(form.cost) < 0) { setError('Cost must be a positive number.'); return; }
    setLoading(true);
    await apiFetch(`${API}/subscriptions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), cost: parseFloat(form.cost), category: form.category }),
    });
    setForm({ name: '', cost: '', category: 'auto' });
    setDetectedCat(null);
    await fetchAll();
    setLoading(false);
  };

  const handleDelete = async (id) => {
    await apiFetch(`${API}/subscriptions/${id}`, { method: 'DELETE' });
    await fetchAll();
  };

  const keeps        = insights?.recommendations?.filter(r => r.action === 'keep')   || [];
  const removes      = insights?.recommendations?.filter(r => r.action === 'remove') || [];
  const alts         = insights?.alternatives || [];
  const altSavings   = alts.reduce((s, a) => s + a.savings, 0);
  const removeSavings = removes.reduce((s, r) => s + r.tool.cost, 0);

  if (checking) {
    return <div className="auth-loading"><div className="auth-loading-spinner" /></div>;
  }

  if (authRequired && !user) return <AuthScreen />;

  return (
    <div className="app">
      {/* ── Header ── */}
      <header>
        <div className="header-left">
          <svg className="logo-icon" width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Gradient background */}
            <defs>
              <linearGradient id="logoBg" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#1E3A8A"/>
                <stop offset="100%" stopColor="#1e40af"/>
              </linearGradient>
            </defs>
            <rect width="36" height="36" rx="9" fill="url(#logoBg)"/>
            {/* Magnifying glass — "optimizer" */}
            <circle cx="16" cy="16" r="7" stroke="white" strokeWidth="2.2" fill="none" opacity="0.9"/>
            <line x1="21" y1="21" x2="27" y2="27" stroke="white" strokeWidth="2.4" strokeLinecap="round" opacity="0.9"/>
            {/* Dollar sign inside lens */}
            <text x="16" y="20" textAnchor="middle" fill="white" fontSize="9" fontWeight="800" fontFamily="Inter, sans-serif" opacity="0.95">$</text>
          </svg>
          <div>
            <h1>AI Spend Optimizer <span className="logo-badge">Beta</span></h1>
            <div className="tagline">Track · Optimize · Save on your AI stack</div>
          </div>
        </div>
        <div className="header-right">
          {tools.length > 0 && insights && (
            <div className="header-stat">
              <div className="hs-label">Monthly AI Spend</div>
              <div className="hs-value">${animatedSpend.toFixed(2)}</div>
            </div>
          )}
          {user && (
            <div className="user-pill">
              {user.avatar
                ? <img className="user-avatar" src={user.avatar} alt={user.displayName} />
                : <div className="user-avatar-fallback">{user.displayName?.[0]?.toUpperCase() || '?'}</div>
              }
              <span className="user-name">{user.displayName?.split(' ')[0]}</span>
              <button className="sign-out-btn" onClick={logout} title="Sign out">↪</button>
            </div>
          )}
        </div>
      </header>

      <div className="main-grid">
        {/* ── LEFT ── */}
        <div>
          {/* Import panel — prominent at top */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h2>📥 Import Your Subscriptions</h2>
            <ImportPanel onImported={fetchAll} />
          </div>

          {/* Add tool form */}
          <div className="card">
            <h2>Add AI Tool Manually</h2>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label>Tool Name</label>
                <input placeholder="e.g. ChatGPT, Cursor, Midjourney"
                  value={form.name} onChange={e => handleNameChange(e.target.value)} />
                {detectedCat && form.category === 'auto' && (
                  <div className="auto-hint">
                    ✨ Auto-detected: <span className={`badge ${BADGE_CLASS[detectedCat] || 'badge-other'}`}>{detectedCat}</span>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Monthly Cost ($)</label>
                <input type="number" min="0" step="0.01" placeholder="e.g. 20"
                  value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Category <span style={{ fontWeight: 400, textTransform: 'none', color: 'var(--text-3)' }}>(auto-detected)</span></label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>
                      {c === 'auto' ? '🔍 Auto-detect' : c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              {error && <p style={{ color: 'var(--rose)', fontSize: '.78rem', marginBottom: 10 }}>{error}</p>}
              <button className="btn" type="submit" disabled={loading}>
                {loading ? 'Adding…' : '+ Add Tool'}
              </button>
            </form>
          </div>

          {/* Quick tips */}
          <div className="card" style={{ marginTop: 16 }}>
            <h2>Quick Tips</h2>
            <ul className="tips-list">
              <li>Add all active AI subscriptions including annual plans</li>
              <li>Category and plan tier are auto-detected from tool name</li>
              <li>Import a whole stack at once via CSV or pasted text</li>
              <li>Alternatives show cheaper tools with the same capability</li>
            </ul>
          </div>
        </div>

        {/* ── RIGHT ── */}
        <div>
          {/* Tool stack */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h2>Your AI Stack {tools.length > 0 && `· ${tools.length} tools`}</h2>
            {initialLoad ? (
              <SkeletonStack />
            ) : tools.length === 0 ? (
              <div className="empty">
                <div className="icon">🤖</div>
                Add your first AI tool using the form,<br />or import from CSV.
              </div>
            ) : (
              <div className="tools-grid">
                {tools.map(t => (
                  <div className="tool-card" key={t.id}>
                    <div className="tool-info">
                      <div>
                        <span className="tool-name">{t.name}</span>
                        {t.planName && <span className="tool-plan">{t.planName}</span>}
                      </div>
                      <div className="tool-meta">
                        <span className={`badge ${BADGE_CLASS[t.category] || 'badge-other'}`}>{t.category}</span>
                        {t.autoDetected && <span style={{ fontSize: '.65rem', color: 'var(--indigo)', marginLeft: 5 }}>✨</span>}
                      </div>
                      {t.usageHint && <div className="tool-hint">{t.usageHint}</div>}
                      {t.renewalDate && (
                        <div className={`tool-renewal${t.daysUntilRenewal <= 5 ? ' urgent' : ''}`}>
                          🔄 Renews {t.renewalDate} · {t.daysUntilRenewal}d
                        </div>
                      )}
                    </div>
                    <div className="tool-right">
                      <span className="tool-cost">${t.cost.toFixed(2)}/mo</span>
                      <button className="del-btn" onClick={() => handleDelete(t.id)} title="Remove">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Insights */}
          {tools.length > 0 && insights && (
            <div className="insights-section">
              <div className="section-label">Insights & Recommendations</div>

              {/* Redundancy alerts */}
              {insights.redundancies.map((r, i) => (
                <div className="redundancy-alert" key={i}>
                  <strong>⚠ Redundancy Detected</strong>{r.message}
                </div>
              ))}

              {/* Keep / Remove */}
              {(keeps.length > 0 || removes.length > 0) && (
                <div className="reco-card">
                  <div className="reco-header"><span>🔥</span> Recommended Optimizations</div>
                  <div className="reco-list">
                    {keeps.map((r, i) => (
                      <div className="reco-row reco-keep" key={`k-${i}`}>
                        <span className="reco-icon">✅</span>
                        <div>
                          <div className="reco-tool-name">Keep: {r.tool.name} <span style={{ color: 'var(--mint)' }}>(${r.tool.cost}/mo)</span></div>
                          <div className="reco-reason">{r.reason}</div>
                        </div>
                      </div>
                    ))}
                    {removes.map((r, i) => (
                      <div className="reco-row reco-remove" key={`r-${i}`}>
                        <span className="reco-icon">❌</span>
                        <div>
                          <div className="reco-tool-name">Remove: {r.tool.name} <span style={{ color: 'var(--rose)' }}>(${r.tool.cost}/mo)</span></div>
                          <div className="reco-reason">{r.reason}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {removeSavings > 0 && (
                    <div className="savings-box">
                      <div className="savings-amount">Save ${removeSavings.toFixed(2)}/mo</div>
                      <div className="savings-label">= ${(removeSavings * 12).toFixed(0)}/yr by removing redundant tools</div>
                    </div>
                  )}
                </div>
              )}

              {/* Cheaper alternatives */}
              {alts.length > 0 && (
                <div className="reco-card alt-card">
                  <div className="reco-header"><span>💰</span> Cheaper Alternatives Available</div>
                  <div className="reco-list">
                    {alts.map((a, i) => (
                      <div className="reco-row reco-alt" key={`a-${i}`}>
                        <span className="reco-icon">💡</span>
                        <div style={{ flex: 1 }}>
                          <div className="reco-tool-name">
                            {a.tool.name} <span style={{ color: 'var(--text-2)' }}>(${a.tool.cost}/mo)</span>
                            <span className="reco-arrow"> → </span>
                            <span style={{ color: 'var(--amber)' }}>{a.altName}</span>
                            <span style={{ color: 'var(--mint)' }}> (${a.altCost}/mo)</span>
                          </div>
                          <div className="reco-reason">{a.reason}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 8 }}>
                          <div style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--amber)' }}>−${a.savings}/mo</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {altSavings > 0 && (
                    <div className="savings-box alt">
                      <div className="savings-amount">Save ${altSavings.toFixed(2)}/mo</div>
                      <div className="savings-label">= ${(altSavings * 12).toFixed(0)}/yr by switching to cheaper alternatives</div>
                    </div>
                  )}
                </div>
              )}

              {/* Optimization insight */}
              {insights.optimizationInsight && (
                <div className="optimization-insight">
                  <span>💡</span><span>{insights.optimizationInsight}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
