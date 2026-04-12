import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, DollarSign, Trash2, Plus, Upload, Mail, Monitor, LogOut, TrendingDown,
  CheckCircle2, XCircle, AlertTriangle, Lightbulb, Sparkles, RefreshCw
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';

// ── API base ──────────────────────────────────────────────────────────────────
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
    setAuthRequired(true);
  };

  return { user, checking, authRequired, logout };
}

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

const CATEGORIES = ['auto', 'writing', 'coding', 'design', 'research', 'other'];
const CAT_OPTIONS = ['writing', 'coding', 'design', 'research', 'other'];

// Badge variant mapping
const CAT_BADGE = {
  writing:  'bg-blue-100 text-blue-800 border-blue-200',
  coding:   'bg-purple-100 text-purple-800 border-purple-200',
  design:   'bg-pink-100 text-pink-800 border-pink-200',
  research: 'bg-green-100 text-green-800 border-green-200',
  other:    'bg-gray-100 text-gray-700 border-gray-200',
  auto:     'bg-gray-100 text-gray-700 border-gray-200',
};

function CategoryBadge({ category }) {
  const cls = CAT_BADGE[category] || CAT_BADGE.other;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {category}
    </span>
  );
}

// ── Auth Screen ───────────────────────────────────────────────────────────────
function AuthScreen() {
  const params = new URLSearchParams(window.location.search);
  const failed = params.get('auth') === 'failed';

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardContent className="pt-8 pb-8 px-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'linear-gradient(135deg, #1E3A8A, #1e40af)' }}>
              <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
                <circle cx="16" cy="16" r="7" stroke="white" strokeWidth="2.2" fill="none" opacity="0.9"/>
                <line x1="21" y1="21" x2="27" y2="27" stroke="white" strokeWidth="2.4" strokeLinecap="round"/>
                <text x="16" y="20" textAnchor="middle" fill="white" fontSize="9" fontWeight="800" fontFamily="Inter, sans-serif">$</text>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">AI Spend Optimizer</h1>
            <p className="text-sm text-slate-500 mt-1">Track · Optimize · Save on your AI stack</p>
          </div>

          {failed && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">
              Sign-in failed. Please try again or check your OAuth credentials.
            </div>
          )}

          <p className="text-center text-xs text-slate-400 uppercase tracking-wider font-medium mb-4">
            Sign in to get started
          </p>

          <div className="flex flex-col gap-3">
            <a href={`${API}/auth/google`} className="no-underline">
              <Button variant="outline" className="w-full gap-2 h-11">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </Button>
            </a>

            <a href={`${API}/auth/github`} className="no-underline">
              <Button variant="outline" className="w-full gap-2 h-11">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                </svg>
                Continue with GitHub
              </Button>
            </a>

            <Button variant="outline" className="w-full gap-2 h-11 opacity-50 cursor-not-allowed" disabled>
              <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
                <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
              </svg>
              Continue with Microsoft
              <span className="ml-auto text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Soon</span>
            </Button>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6 leading-relaxed">
            By signing in you agree to our Terms of Service.<br/>
            Your data is stored securely and never sold.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Scan overlay ──────────────────────────────────────────────────────────────
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
        <div className="text-white font-semibold text-lg">Scanning for subscriptions…</div>
        <div className="text-blue-200 text-sm mt-1">Detecting AI tools and pricing patterns</div>
      </div>
    </div>
  );
}

// ── Skeleton loading ──────────────────────────────────────────────────────────
function SkeletonStack() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-3 p-4 border rounded-lg">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

// ── ImportPanel ───────────────────────────────────────────────────────────────
function ImportPanel({ onImported, user }) {
  const [tab, setTab]               = useState('email');
  const [input, setInput]           = useState('');
  const [emailAddr, setEmailAddr]   = useState('');
  const [scanning, setScanning]     = useState(false);
  const [gmailScanning, setGmailScanning] = useState(false);
  const [gmailMsg, setGmailMsg]     = useState('');
  const [candidates, setCandidates] = useState([]);
  const [importing, setImporting]   = useState(false);
  const [result, setResult]         = useState(null);
  const [fileInfo, setFileInfo]     = useState(null);
  const [fileStatus, setFileStatus] = useState('');
  const [fileDragOver, setFileDragOver] = useState(false);

  const reset = () => { setCandidates([]); setResult(null); setGmailMsg(''); setFileInfo(null); setFileStatus(''); };

  const scanGmail = async () => {
    setGmailScanning(true);
    reset();
    try {
      const res = await apiFetch(`${API}/scan/gmail`);
      const data = await res.json();
      if (data.error) { setGmailMsg(data.error); }
      else if (data.candidates?.length === 0) { setGmailMsg(data.message || 'No AI subscriptions found in inbox.'); }
      else {
        setGmailMsg(`Found ${data.candidates.length} subscription(s) across ${data.scanned} emails.`);
        setCandidates(data.candidates.map(c => ({
          ...c, accepted: true,
          editName: c.name, editCost: String(c.cost), editCat: c.category,
        })));
      }
    } catch (e) { setGmailMsg('Scan failed. Please try again.'); }
    setGmailScanning(false);
  };

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

  const scanFile = async (file) => {
    if (!file) return;
    setScanning(true);
    reset();
    setFileInfo({ name: file.name, size: file.size });
    const ext = file.name.split('.').pop().toLowerCase();
    try {
      if (ext === 'csv') {
        setFileStatus('Reading CSV file…');
        const text = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsText(file);
        });
        const res = await apiFetch(`${API}/scan/csv`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv: text }),
        });
        const data = await res.json();
        setCandidates((data.candidates || []).map(c => ({ ...c, accepted: true, editName: c.name, editCost: String(c.cost), editCat: c.category })));
        setFileStatus('');
      } else if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
        setFileStatus('Reading text from image…');
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        if (!window.Tesseract) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        const { data: { text } } = await window.Tesseract.recognize(dataUrl, 'eng');
        setFileStatus('Scanning extracted text…');
        const res = await apiFetch(`${API}/scan/text`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        setCandidates((data.candidates || []).map(c => ({ ...c, accepted: true, editName: c.name, editCost: String(c.cost), editCat: c.category })));
        setFileStatus('');
      } else {
        setFileStatus(ext === 'pdf' ? 'Extracting text from PDF…' : 'Reading text file…');
        const formData = new FormData();
        formData.append('file', file);
        const res = await apiFetch(`${API}/scan/file`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.error) { setFileStatus('Error: ' + data.error); }
        else {
          setCandidates((data.candidates || []).map(c => ({ ...c, accepted: true, editName: c.name, editCost: String(c.cost), editCat: c.category })));
          setFileStatus('');
        }
      }
    } catch (e) {
      console.error('File scan error:', e);
      setFileStatus('Scan failed. Please try again.');
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
      <Tabs value={tab} onValueChange={(v) => { setTab(v); reset(); setInput(''); setEmailAddr(''); }}>
        <TabsList className="w-full grid grid-cols-4 mb-4">
          <TabsTrigger value="email" className="gap-1.5 text-xs">
            <Mail className="w-3.5 h-3.5" /> Email
          </TabsTrigger>
          <TabsTrigger value="csv" className="gap-1.5 text-xs">
            <Upload className="w-3.5 h-3.5" /> CSV
          </TabsTrigger>
          <TabsTrigger value="text" className="gap-1.5 text-xs">
            <Search className="w-3.5 h-3.5" /> Text
          </TabsTrigger>
          <TabsTrigger value="computer" className="gap-1.5 text-xs">
            <Monitor className="w-3.5 h-3.5" /> File
          </TabsTrigger>
        </TabsList>

        {/* Email tab */}
        <TabsContent value="email">
          {user?.provider === 'google' && (
            <div className="gmail-auto-scan">
              <div className="gmail-auto-title">Auto-scan your Gmail inbox</div>
              <div className="gmail-auto-desc">Searches your last 6 months of billing emails from AI tools automatically.</div>
              <Button
                size="sm"
                onClick={scanGmail}
                disabled={gmailScanning}
                className="mt-1"
              >
                <Mail className="w-3.5 h-3.5 mr-1.5" />
                {gmailScanning ? 'Scanning inbox…' : 'Scan My Gmail Inbox'}
              </Button>
              {gmailMsg && <div className="gmail-msg">{gmailMsg}</div>}
            </div>
          )}
          {!user?.provider && (
            <div className="gmail-auto-scan">
              <div className="gmail-auto-title">Auto Gmail Scan</div>
              <div className="gmail-auto-desc">Sign in with Google to auto-scan your inbox for AI billing emails.</div>
            </div>
          )}
          <div className="email-or-divider">— or paste email text manually —</div>
          <textarea
            className="import-textarea"
            placeholder={"Paste the full email text here:\n\nFrom: billing@openai.com\nSubject: Your ChatGPT Plus subscription\n\nYour monthly subscription of $20.00 has been renewed..."}
            value={emailAddr}
            onChange={e => { setEmailAddr(e.target.value); reset(); }}
          />
          <div className="import-hint">Supports billing receipts, renewal notices, and subscription confirmation emails</div>
          <Button
            className="mt-3 w-full"
            onClick={() => scan()}
            disabled={scanning || !emailAddr.trim()}
          >
            <Search className="w-4 h-4 mr-2" /> Scan Email Text
          </Button>
        </TabsContent>

        {/* CSV tab */}
        <TabsContent value="csv">
          <div
            className={`file-drop-zone mb-3 ${fileDragOver ? 'drag-over' : ''}`}
            onClick={() => {
              const inp = document.createElement('input');
              inp.type = 'file'; inp.accept = '.csv,text/csv';
              inp.onchange = e => { if (e.target.files[0]) { const r = new FileReader(); r.onload = ev => { setInput(ev.target.result); reset(); }; r.readAsText(e.target.files[0]); } };
              inp.click();
            }}
            onDragOver={e => { e.preventDefault(); setFileDragOver(true); }}
            onDragLeave={() => setFileDragOver(false)}
            onDrop={e => { e.preventDefault(); setFileDragOver(false); const f = e.dataTransfer.files[0]; if (f) { const r = new FileReader(); r.onload = ev => { setInput(ev.target.result); reset(); }; r.readAsText(f); } }}
          >
            <div className="file-drop-icon"><Upload className="w-8 h-8 mx-auto text-slate-400" /></div>
            <div className="file-drop-title">Drag & drop CSV file, or click to browse</div>
            <div className="file-drop-formats">Supports .csv · name, cost, category columns</div>
          </div>
          <textarea
            className="import-textarea"
            placeholder={"Or paste CSV directly:\nname,cost,category\nChatGPT,20,writing\nCursor,20,coding"}
            value={input}
            onChange={e => { setInput(e.target.value); reset(); }}
          />
          <div className="import-hint">Header row optional · Columns: name, cost, category</div>
          <Button
            className="mt-3 w-full"
            onClick={() => scan()}
            disabled={scanning || !input.trim()}
          >
            <Search className="w-4 h-4 mr-2" /> Scan CSV
          </Button>
        </TabsContent>

        {/* Paste text tab */}
        <TabsContent value="text">
          <textarea
            className="import-textarea"
            placeholder={"Paste any text — bank statement, email, notes:\n  ChatGPT Plus $20/month\n  Paid Cursor Pro - $20\n  Midjourney Standard plan $30"}
            value={input}
            onChange={e => { setInput(e.target.value); reset(); }}
          />
          <div className="import-hint">Detects AI tool names + dollar amounts in free-form text</div>
          <Button
            className="mt-3 w-full"
            onClick={() => scan()}
            disabled={scanning || !input.trim()}
          >
            <Search className="w-4 h-4 mr-2" /> Scan Pasted Text
          </Button>
        </TabsContent>

        {/* File/Computer tab */}
        <TabsContent value="computer">
          <div
            className={`file-drop-zone ${fileDragOver ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setFileDragOver(true); }}
            onDragLeave={() => setFileDragOver(false)}
            onDrop={e => { e.preventDefault(); setFileDragOver(false); const f = e.dataTransfer.files[0]; if (f) scanFile(f); }}
            onClick={() => {
              const inp = document.createElement('input');
              inp.type = 'file';
              inp.accept = '.pdf,.txt,.csv,.png,.jpg,.jpeg';
              inp.onchange = e => { if (e.target.files[0]) scanFile(e.target.files[0]); };
              inp.click();
            }}
          >
            <div className="file-drop-icon"><Monitor className="w-8 h-8 mx-auto text-slate-400" /></div>
            <div className="file-drop-title">
              {scanning && fileInfo
                ? (fileStatus || 'Processing…')
                : 'Drop a file here or click to browse'}
            </div>
            {fileInfo && <div className="file-drop-meta">{fileInfo.name} · {(fileInfo.size / 1024).toFixed(1)} KB</div>}
            {!fileInfo && <div className="file-drop-formats">Supported: PDF · TXT · CSV · PNG · JPG</div>}
          </div>
        </TabsContent>
      </Tabs>

      {/* Success message */}
      {result != null && (
        <div className="flex items-center gap-2 mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Imported {result} tool{result !== 1 ? 's' : ''} successfully.
        </div>
      )}

      {/* Candidates review */}
      {candidates.length > 0 && (
        <div className="candidates-panel mt-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            {candidates.length} tools detected — review before importing
          </h3>
          {candidates.map(c => (
            <div key={c.id} className={`candidate-row ${!c.accepted ? 'rejected' : ''}`}>
              <input type="checkbox" checked={c.accepted} onChange={() => toggle(c.id)} className="w-4 h-4" />
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={c.editName}
                  onChange={e => update(c.id, 'editName', e.target.value)}
                  className="w-full border border-slate-200 rounded px-2 py-1 text-xs"
                />
                <div className="conf-bar" style={{ width: `${c.confidence * 100}%` }} />
                <div className="conf-label">{Math.round(c.confidence * 100)}% confidence · {c.source}</div>
              </div>
              <input
                type="number" value={c.editCost} min="0" step="0.01"
                onChange={e => update(c.id, 'editCost', e.target.value)}
                className="w-20 border border-slate-200 rounded px-2 py-1 text-xs"
              />
              <select
                className="cand-cat-sel"
                value={c.editCat}
                onChange={e => update(c.id, 'editCat', e.target.value)}
              >
                {CAT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <button
                onClick={() => toggle(c.id)}
                className={`text-sm font-semibold ${c.accepted ? 'text-red-500' : 'text-green-600'}`}
              >
                {c.accepted ? '✕' : '✓'}
              </button>
            </div>
          ))}
          <Button
            className="w-full mt-3"
            onClick={confirmImport}
            disabled={importing || accepted.length === 0}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {importing ? 'Importing…' : `Import ${accepted.length} Tool${accepted.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      )}
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
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" />
      </div>
    );
  }

  if (authRequired && !user) return <AuthScreen />;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #1E3A8A, #2563eb)' }}>
              <svg width="20" height="20" viewBox="0 0 36 36" fill="none">
                <circle cx="16" cy="16" r="7" stroke="white" strokeWidth="2.2" fill="none"/>
                <line x1="21" y1="21" x2="27" y2="27" stroke="white" strokeWidth="2.4" strokeLinecap="round"/>
                <text x="16" y="20" textAnchor="middle" fill="white" fontSize="9" fontWeight="800" fontFamily="Inter,sans-serif">$</text>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900">AI Spend Optimizer</h1>
                <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-semibold tracking-wide">BETA</span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Track · Optimize · Save on your AI stack</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {tools.length > 0 && insights && (
              <div className="hidden sm:flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2">
                <TrendingDown className="w-4 h-4 text-blue-600" />
                <div>
                  <div className="text-[10px] text-blue-500 font-semibold uppercase tracking-wider">Monthly Spend</div>
                  <div className="text-lg font-bold text-blue-900 leading-tight">${animatedSpend.toFixed(2)}</div>
                </div>
                {insights.potentialSavings > 0 && (
                  <>
                    <Separator orientation="vertical" className="h-8 mx-1" />
                    <div>
                      <div className="text-[10px] text-emerald-500 font-semibold uppercase tracking-wider">Potential Savings</div>
                      <div className="text-lg font-bold text-emerald-700 leading-tight">-${insights.potentialSavings.toFixed(2)}</div>
                    </div>
                  </>
                )}
              </div>
            )}
            {user && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl pl-1 pr-3 py-1">
                <Avatar className="w-7 h-7">
                  {user.avatar && <AvatarImage src={user.avatar} alt={user.displayName} />}
                  <AvatarFallback className="text-xs font-bold bg-blue-100 text-blue-800">
                    {user.displayName?.[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-slate-700 hidden sm:block">
                  {user.displayName?.split(' ')[0]}
                </span>
                <Button variant="ghost" size="sm" onClick={logout} title="Sign out"
                  className="h-7 w-7 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg ml-1">
                  <LogOut className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero stats bar (shown when tools exist) ── */}
      {tools.length > 0 && insights && (
        <div style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #1d4ed8 100%)' }} className="text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">${animatedSpend.toFixed(2)}</div>
              <div className="text-blue-200 text-xs font-medium mt-0.5">Monthly Spend</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{tools.length}</div>
              <div className="text-blue-200 text-xs font-medium mt-0.5">AI Tools</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-300">${insights.potentialSavings.toFixed(2)}</div>
              <div className="text-blue-200 text-xs font-medium mt-0.5">Potential Savings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{Object.keys(insights.byCategory || {}).length}</div>
              <div className="text-blue-200 text-xs font-medium mt-0.5">Categories</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">

          {/* ── LEFT COLUMN ── */}
          <div className="flex flex-col gap-5">

            {/* Import panel */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Upload className="w-4 h-4 text-blue-600" />
                  Import Your Subscriptions
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <ImportPanel onImported={fetchAll} user={user} />
              </CardContent>
            </Card>

            {/* Add tool form */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-600" />
                  Add AI Tool Manually
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <form onSubmit={handleAdd} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="tool-name" className="text-xs font-medium text-slate-600">Tool Name</Label>
                    <Input
                      id="tool-name"
                      placeholder="e.g. ChatGPT, Cursor, Midjourney"
                      value={form.name}
                      onChange={e => handleNameChange(e.target.value)}
                      className="h-9 text-sm"
                    />
                    {detectedCat && form.category === 'auto' && (
                      <div className="flex items-center gap-1.5 text-xs text-blue-600">
                        <Sparkles className="w-3 h-3" />
                        Auto-detected: <CategoryBadge category={detectedCat} />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="tool-cost" className="text-xs font-medium text-slate-600">
                      Monthly Cost ($)
                    </Label>
                    <Input
                      id="tool-cost"
                      type="number" min="0" step="0.01"
                      placeholder="e.g. 20"
                      value={form.cost}
                      onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="tool-cat" className="text-xs font-medium text-slate-600">
                      Category <span className="font-normal text-slate-400">(auto-detected)</span>
                    </Label>
                    <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger id="tool-cat" className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => (
                          <SelectItem key={c} value={c}>
                            {c === 'auto' ? 'Auto-detect' : c.charAt(0).toUpperCase() + c.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {error && (
                    <p className="text-xs text-red-500">{error}</p>
                  )}

                  <Button type="submit" disabled={loading} className="w-full">
                    <Plus className="w-4 h-4 mr-1.5" />
                    {loading ? 'Adding…' : 'Add Tool'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Quick tips */}
            <Card className="shadow-sm bg-blue-50 border-blue-100">
              <CardContent className="px-5 py-4">
                <h3 className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-3">Quick Tips</h3>
                <ul className="tips-list">
                  <li>Add all active AI subscriptions including annual plans</li>
                  <li>Category and plan tier are auto-detected from tool name</li>
                  <li>Import a whole stack at once via CSV or pasted text</li>
                  <li>Alternatives show cheaper tools with the same capability</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="flex flex-col gap-5">

            {/* Tool stack */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-blue-600" />
                  Your AI Stack {tools.length > 0 && (
                    <span className="text-xs font-normal text-slate-400 ml-1">· {tools.length} tools</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {initialLoad ? (
                  <SkeletonStack />
                ) : tools.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <div className="text-4xl mb-3">🤖</div>
                    <p className="text-sm text-center">Add your first AI tool using the form,<br />or import from CSV.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead className="w-1/2">Tool</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Cost/mo</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tools.map(t => (
                        <TableRow key={t.id} className="group">
                          <TableCell>
                            <div>
                              <span className="font-medium text-sm text-slate-900">{t.name}</span>
                              {t.planName && (
                                <span className="tool-plan">{t.planName}</span>
                              )}
                              {t.autoDetected && (
                                <Sparkles className="inline w-3 h-3 ml-1 text-blue-400" />
                              )}
                            </div>
                            {t.usageHint && <div className="tool-hint">{t.usageHint}</div>}
                            {t.renewalDate && (
                              <div className={`tool-renewal${t.daysUntilRenewal <= 5 ? ' urgent' : ''}`}>
                                <RefreshCw className="inline w-3 h-3 mr-1" />
                                Renews {t.renewalDate} · {t.daysUntilRenewal}d
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <CategoryBadge category={t.category} />
                          </TableCell>
                          <TableCell className="text-right font-semibold text-slate-900 text-sm">
                            ${t.cost.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(t.id)}
                              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Insights */}
            {tools.length > 0 && insights && (
              <div className="flex flex-col gap-4">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest px-1">
                  Insights &amp; Recommendations
                </h2>

                {/* Redundancy alerts */}
                {insights.redundancies.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-sm font-semibold text-amber-800">Redundancy Detected</span>
                      <p className="text-xs text-amber-700 mt-0.5">{r.message}</p>
                    </div>
                  </div>
                ))}

                {/* Keep / Remove recommendations */}
                {(keeps.length > 0 || removes.length > 0) && (
                  <Card className="shadow-sm border-orange-100">
                    <CardHeader className="pb-2 pt-4 px-5">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2 text-orange-700">
                        <TrendingDown className="w-4 h-4" />
                        Recommended Optimizations
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-4">
                      <div className="flex flex-col gap-2">
                        {keeps.map((r, i) => (
                          <div key={`k-${i}`} className="flex items-start gap-2.5 p-3 bg-green-50 rounded-lg border border-green-100">
                            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="text-xs font-semibold text-slate-800">
                                Keep: {r.tool.name} <span className="text-green-600 font-medium">(${r.tool.cost}/mo)</span>
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">{r.reason}</div>
                            </div>
                          </div>
                        ))}
                        {removes.map((r, i) => (
                          <div key={`r-${i}`} className="flex items-start gap-2.5 p-3 bg-red-50 rounded-lg border border-red-100">
                            <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="text-xs font-semibold text-slate-800">
                                Remove: {r.tool.name} <span className="text-red-500 font-medium">(${r.tool.cost}/mo)</span>
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">{r.reason}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {removeSavings > 0 && (
                        <div className="savings-box mt-3">
                          <div className="savings-amount">Save ${removeSavings.toFixed(2)}/mo</div>
                          <div className="savings-label">= ${(removeSavings * 12).toFixed(0)}/yr by removing redundant tools</div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Cheaper alternatives */}
                {alts.length > 0 && (
                  <Card className="shadow-sm border-amber-100">
                    <CardHeader className="pb-2 pt-4 px-5">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-700">
                        <Lightbulb className="w-4 h-4" />
                        Cheaper Alternatives Available
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-4">
                      <div className="flex flex-col gap-2">
                        {alts.map((a, i) => (
                          <div key={`a-${i}`} className="flex items-start gap-2.5 p-3 bg-amber-50 rounded-lg border border-amber-100">
                            <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-slate-800 flex flex-wrap items-center gap-1">
                                <span>{a.tool.name}</span>
                                <span className="text-slate-400">(${a.tool.cost}/mo)</span>
                                <span className="text-slate-400">→</span>
                                <span className="text-amber-700">{a.altName}</span>
                                <span className="text-green-600">(${a.altCost}/mo)</span>
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">{a.reason}</div>
                            </div>
                            <div className="text-right flex-shrink-0 pl-2">
                              <div className="text-xs font-bold text-amber-600">−${a.savings}/mo</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {altSavings > 0 && (
                        <div className="savings-box alt mt-3">
                          <div className="savings-amount">Save ${altSavings.toFixed(2)}/mo</div>
                          <div className="savings-label">= ${(altSavings * 12).toFixed(0)}/yr by switching to cheaper alternatives</div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Optimization insight */}
                {insights.optimizationInsight && (
                  <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-blue-800">{insights.optimizationInsight}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
