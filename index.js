require('dotenv').config();
const express        = require('express');
const cors           = require('cors');
const session        = require('express-session');
const passport       = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const { Pool }       = require('pg');

// ── PostgreSQL ────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,
      display_name TEXT,
      email        TEXT,
      avatar       TEXT,
      provider     TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id                 SERIAL PRIMARY KEY,
      user_id            TEXT REFERENCES users(id),
      name               TEXT NOT NULL,
      cost               REAL NOT NULL DEFAULT 0,
      category           TEXT NOT NULL DEFAULT 'other',
      auto_detected      BOOLEAN NOT NULL DEFAULT FALSE,
      plan_name          TEXT,
      usage_hint         TEXT,
      start_date         TEXT,
      renewal_date       TEXT,
      days_until_renewal INTEGER,
      created_at         TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

function rowToSub(row) {
  if (!row) return null;
  return {
    id:               row.id,
    name:             row.name,
    cost:             parseFloat(row.cost),
    category:         row.category,
    autoDetected:     row.auto_detected,
    planName:         row.plan_name,
    usageHint:        row.usage_hint,
    startDate:        row.start_date,
    renewalDate:      row.renewal_date,
    daysUntilRenewal: row.days_until_renewal,
  };
}

async function getAllSubs(userId) {
  const r = await pool.query(
    'SELECT * FROM subscriptions WHERE user_id=$1 ORDER BY created_at DESC', [userId]);
  return r.rows.map(rowToSub);
}

async function insertSub(userId, fields) {
  const r = await pool.query(
    `INSERT INTO subscriptions
      (user_id,name,cost,category,auto_detected,plan_name,usage_hint,start_date,renewal_date,days_until_renewal)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [userId, fields.name, fields.cost, fields.category, !!fields.autoDetected,
     fields.planName||null, fields.usageHint||null, fields.startDate||null,
     fields.renewalDate||null, fields.daysUntilRenewal||null]
  );
  return rowToSub(r.rows[0]);
}

async function deleteSubById(userId, id) {
  const r = await pool.query(
    'DELETE FROM subscriptions WHERE id=$1 AND user_id=$2', [id, userId]);
  return r.rowCount > 0;
}

async function upsertUserDB({ id, displayName, email, avatar, provider }) {
  await pool.query(
    `INSERT INTO users (id,display_name,email,avatar,provider)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT(id) DO UPDATE SET display_name=$2,email=$3,avatar=$4`,
    [id, displayName, email, avatar, provider]
  );
  return { id, displayName, email, avatar, provider };
}

async function getUserById(id) {
  const r = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
  if (!r.rows[0]) return null;
  const u = r.rows[0];
  return { id: u.id, displayName: u.display_name, email: u.email, avatar: u.avatar, provider: u.provider };
}

// ── Signed tokens (survive restarts — no server-side storage needed) ──────────
const crypto = require('crypto');
const TOKEN_SECRET = process.env.SESSION_SECRET || 'ai-spend-dev-secret-change-in-prod';

function createToken(userId) {
  const payload = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

async function getUserByToken(token) {
  if (!token) return null;
  try {
    const [payload, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
    if (sig !== expected) return null;
    const { userId } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return await getUserById(userId);
  } catch { return null; }
}

async function authMiddleware(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.query.token;
  if (token) {
    const user = await getUserByToken(token);
    if (user) { req.user = user; }
  }
  next();
}

const app = express();

const isProd = process.env.NODE_ENV === 'production';
if (isProd) app.set('trust proxy', 1);

// ── CORS ─────────────────────────────────────────────────────────────────────
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({ origin: [FRONTEND_URL, /localhost/], credentials: true }));
app.use(express.json());

// ── Session ──────────────────────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'ai-spend-dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: isProd, sameSite: isProd ? 'none' : 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

// ── Passport ─────────────────────────────────────────────────────────────────
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const user = await getUserById(id);
  done(null, user || null);
});

async function upsertUser(profile) {
  return await upsertUserDB(profile);
}

// Google
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// In-memory access token store (survives as long as process is up)
const accessTokens = {};

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  `${BACKEND_URL}/auth/google/callback`,
  }, async (accessToken, refreshToken, profile, done) => {
    const user = await upsertUser({
      id:          `google:${profile.id}`,
      displayName: profile.displayName,
      email:       profile.emails?.[0]?.value || '',
      avatar:      profile.photos?.[0]?.value || '',
      provider:    'google',
    });
    accessTokens[user.id] = accessToken;
    done(null, user);
  }));
}

// GitHub
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID:     process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL:  `${BACKEND_URL}/auth/github/callback`,
    scope:        ['user:email'],
  }, async (accessToken, refreshToken, profile, done) => {
    const user = await upsertUser({
      id:          `github:${profile.id}`,
      displayName: profile.displayName || profile.username,
      email:       profile.emails?.[0]?.value || '',
      avatar:      profile.photos?.[0]?.value || '',
      provider:    'github',
    });
    done(null, user);
  }));
}

// ── Auth routes ───────────────────────────────────────────────────────────────
app.use(authMiddleware);

app.get('/auth/me', (req, res) => {
  if (req.user) return res.json(req.user);
  res.status(401).json({ error: 'Not authenticated' });
});

app.get('/auth/status', (req, res) => {
  res.json({
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    microsoft: false,
    authRequired: !!(process.env.GOOGLE_CLIENT_ID || process.env.GITHUB_CLIENT_ID),
  });
});

app.get('/auth/logout', (req, res) => {
  res.redirect(FRONTEND_URL);
});

// Google
app.get('/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/gmail.readonly'],
    accessType: 'online',
    session: false,
  }));
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: `${FRONTEND_URL}?auth=failed`, session: false }),
  (req, res) => {
    const token = createToken(req.user.id);
    res.redirect(`${FRONTEND_URL}?token=${token}`);
  });

// GitHub
app.get('/auth/github',
  passport.authenticate('github', { scope: ['user:email'], session: false }));
app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: `${FRONTEND_URL}?auth=failed`, session: false }),
  (req, res) => {
    const token = createToken(req.user.id);
    res.redirect(`${FRONTEND_URL}?token=${token}`);
  });


// ── Auto-category detection ──────────────────────────────────────────────────
const CATEGORY_MAP = {
  writing:  ['chatgpt', 'claude', 'jasper', 'copy.ai', 'copyai', 'notion ai', 'writesonic',
             'grammarly', 'quillbot', 'sudowrite', 'rytr', 'anyword', 'wordtune', 'lex',
             'hyperwrite', 'peppertype', 'simplified', 'longshot', 'cohesive', 'ink for all'],
  coding:   ['cursor', 'github copilot', 'copilot', 'tabnine', 'codeium', 'codium',
             'replit', 'cody', 'amazon codewhisperer', 'codewhisperer', 'codex',
             'sourcegraph', 'bito', 'blackbox', 'deepseek', 'devin', 'aider', 'continue'],
  design:   ['midjourney', 'dall-e', 'dalle', 'stable diffusion', 'adobe firefly', 'firefly',
             'canva', 'ideogram', 'runway', 'kling', 'pika', 'sora', 'heygen', 'synthesia',
             'leonardo', 'clipdrop', 'remove.bg', 'magnific', 'magnify', 'krea'],
  research: ['perplexity', 'elicit', 'consensus', 'you.com', 'you ', 'semantic scholar',
             'scite', 'undermind', 'typeset', 'research rabbit', 'litmaps', 'iris.ai'],
};

function detectCategory(name) {
  const lower = name.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  return null; // unknown
}

// ── Plan tier + known pricing dictionary ─────────────────────────────────────
// Each entry: { tiers: [{name, cost}], usageHint }
const VENDOR_DICT = {
  chatgpt:          { tiers: [{ name: 'Free', cost: 0 }, { name: 'Plus', cost: 20 }, { name: 'Team', cost: 25 }, { name: 'Enterprise', cost: 60 }], usageHint: 'General writing, chat, coding assistance' },
  claude:           { tiers: [{ name: 'Free', cost: 0 }, { name: 'Pro', cost: 20 }, { name: 'Team', cost: 25 }], usageHint: 'Long-context writing, coding, analysis' },
  cursor:           { tiers: [{ name: 'Hobby', cost: 0 }, { name: 'Pro', cost: 20 }, { name: 'Business', cost: 40 }], usageHint: 'AI-powered code editor' },
  'github copilot': { tiers: [{ name: 'Free', cost: 0 }, { name: 'Individual', cost: 10 }, { name: 'Business', cost: 19 }], usageHint: 'Inline code completion in IDE' },
  copilot:          { tiers: [{ name: 'Free', cost: 0 }, { name: 'Individual', cost: 10 }, { name: 'Business', cost: 19 }], usageHint: 'Inline code completion in IDE' },
  midjourney:       { tiers: [{ name: 'Basic', cost: 10 }, { name: 'Standard', cost: 30 }, { name: 'Pro', cost: 60 }, { name: 'Mega', cost: 120 }], usageHint: 'AI image generation' },
  perplexity:       { tiers: [{ name: 'Free', cost: 0 }, { name: 'Pro', cost: 20 }], usageHint: 'AI-powered research & search' },
  jasper:           { tiers: [{ name: 'Creator', cost: 39 }, { name: 'Pro', cost: 59 }, { name: 'Business', cost: 99 }], usageHint: 'Marketing & long-form content' },
  grammarly:        { tiers: [{ name: 'Free', cost: 0 }, { name: 'Premium', cost: 12 }, { name: 'Business', cost: 15 }], usageHint: 'Grammar & writing assistant' },
  notion:           { tiers: [{ name: 'Free', cost: 0 }, { name: 'Plus', cost: 10 }, { name: 'Business', cost: 15 }], usageHint: 'Notes, docs, project management' },
  runway:           { tiers: [{ name: 'Free', cost: 0 }, { name: 'Standard', cost: 12 }, { name: 'Pro', cost: 28 }, { name: 'Unlimited', cost: 76 }], usageHint: 'AI video generation' },
  canva:            { tiers: [{ name: 'Free', cost: 0 }, { name: 'Pro', cost: 13 }, { name: 'Teams', cost: 10 }], usageHint: 'Design & visual content' },
  replit:           { tiers: [{ name: 'Free', cost: 0 }, { name: 'Core', cost: 25 }], usageHint: 'Cloud coding environment' },
  tabnine:          { tiers: [{ name: 'Basic', cost: 0 }, { name: 'Pro', cost: 12 }, { name: 'Enterprise', cost: 39 }], usageHint: 'AI code completion' },
  elicit:           { tiers: [{ name: 'Free', cost: 0 }, { name: 'Plus', cost: 10 }], usageHint: 'AI research assistant for papers' },
  heygen:           { tiers: [{ name: 'Free', cost: 0 }, { name: 'Creator', cost: 29 }, { name: 'Business', cost: 89 }], usageHint: 'AI avatar video creation' },
  synthesia:        { tiers: [{ name: 'Starter', cost: 18 }, { name: 'Creator', cost: 64 }], usageHint: 'AI presenter videos' },
};

// ── Cheaper alternative dictionary ───────────────────────────────────────────
// Keyed by lowercase vendor fragment → { altName, altCost, reason, category }
const ALTERNATIVES = {
  // Writing
  'jasper':        { altName: 'ChatGPT Plus',    altCost: 20, reason: 'ChatGPT handles long-form marketing copy at $29/mo less', category: 'writing' },
  'writesonic':    { altName: 'ChatGPT Plus',    altCost: 20, reason: 'ChatGPT covers AI writing at a lower price', category: 'writing' },
  'copy.ai':       { altName: 'Claude Pro',      altCost: 20, reason: 'Claude handles copywriting at the same price with broader capability', category: 'writing' },
  'copyai':        { altName: 'Claude Pro',      altCost: 20, reason: 'Claude handles copywriting at the same price with broader capability', category: 'writing' },
  'grammarly':     { altName: 'ChatGPT Plus',    altCost: 20, reason: 'ChatGPT/Claude catch grammar and improve writing natively', category: 'writing' },
  'quillbot':      { altName: 'Claude Pro',      altCost: 20, reason: 'Claude paraphrases and rewrites with better context understanding', category: 'writing' },
  'anyword':       { altName: 'ChatGPT Plus',    altCost: 20, reason: 'ChatGPT covers performance-driven copy at lower cost', category: 'writing' },
  'rytr':          { altName: 'Claude Free',     altCost: 0,  reason: "Claude's free tier outperforms Rytr for most writing tasks", category: 'writing' },
  'wordtune':      { altName: 'Claude Free',     altCost: 0,  reason: "Claude's free tier rewrites and tones text without a subscription", category: 'writing' },
  'longshot':      { altName: 'ChatGPT Plus',    altCost: 20, reason: 'ChatGPT produces SEO-friendly long-form content with better accuracy', category: 'writing' },
  // Coding
  'github copilot':{ altName: 'Codeium',         altCost: 0,  reason: 'Codeium is free with comparable multi-IDE inline completion', category: 'coding' },
  'copilot':       { altName: 'Codeium',         altCost: 0,  reason: 'Codeium is free with comparable multi-IDE inline completion', category: 'coding' },
  'tabnine':       { altName: 'Codeium',         altCost: 0,  reason: 'Codeium is free and matches Tabnine on completions', category: 'coding' },
  'codewhisperer': { altName: 'Codeium',         altCost: 0,  reason: 'Codeium is free and IDE-agnostic', category: 'coding' },
  'sourcegraph':   { altName: 'Cursor Pro',      altCost: 20, reason: 'Cursor Pro combines code search + AI chat in one tool', category: 'coding' },
  'blackbox':      { altName: 'Codeium',         altCost: 0,  reason: 'Codeium offers free AI code completion across more editors', category: 'coding' },
  // Design
  'adobe firefly': { altName: 'Ideogram',        altCost: 7,  reason: 'Ideogram excels at text-in-image for a fraction of the cost', category: 'design' },
  'firefly':       { altName: 'Ideogram',        altCost: 7,  reason: 'Ideogram excels at text-in-image for a fraction of the cost', category: 'design' },
  'synthesia':     { altName: 'HeyGen Starter',  altCost: 29, reason: 'HeyGen Starter provides AI avatars at significantly lower cost', category: 'design' },
  'heygen':        { altName: 'Synthesia Starter',altCost: 18, reason: 'Synthesia Starter covers presenter videos at lower cost', category: 'design' },
  'runway':        { altName: 'CapCut AI',       altCost: 0,  reason: "CapCut's free AI video tools cover most short-form generation needs", category: 'design' },
  'pika':          { altName: 'CapCut AI',       altCost: 0,  reason: "CapCut's free tier covers short video generation", category: 'design' },
  // Research
  'elicit':        { altName: 'Perplexity Free', altCost: 0,  reason: "Perplexity's free tier handles most research Q&A needs", category: 'research' },
  'consensus':     { altName: 'Perplexity Pro',  altCost: 20, reason: 'Perplexity Pro answers research questions with cited sources', category: 'research' },
  'you.com':       { altName: 'Perplexity Free', altCost: 0,  reason: "Perplexity's free tier is a stronger AI search alternative", category: 'research' },
};

const MIN_SAVINGS = 5; // only suggest if saves at least $5/mo

function findAlternatives(subs) {
  const ownedNames = new Set(subs.map(s => s.name.toLowerCase()));
  const alts = [];

  for (const sub of subs) {
    const lower = sub.name.toLowerCase();
    const key = Object.keys(ALTERNATIVES).find(k => lower.includes(k));
    if (!key) continue;

    const { altName, altCost, reason, category } = ALTERNATIVES[key];
    const savings = sub.cost - altCost;
    if (savings < MIN_SAVINGS) continue;                         // not meaningful enough
    if (ownedNames.has(altName.toLowerCase())) continue;         // already in stack

    alts.push({
      action: 'alternative',
      tool: sub,
      altName,
      altCost,
      savings,
      reason,
      category,
    });
  }
  return alts;
}

function detectPlan(name, cost) {
  const lower = name.toLowerCase();
  const vendor = Object.keys(VENDOR_DICT).find(k => lower.includes(k));
  if (!vendor) return { planName: null, usageHint: null, closestCost: null };
  const { tiers, usageHint } = VENDOR_DICT[vendor];
  // Find closest tier by cost
  const sorted = [...tiers].sort((a, b) => Math.abs(a.cost - cost) - Math.abs(b.cost - cost));
  return { planName: sorted[0]?.name || null, usageHint, closestCost: sorted[0]?.cost ?? null };
}

function nextRenewal(startDate) {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().split('T')[0];
}

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / 86400000);
}

// Preferred tools per category (order = priority)
const PREFS = {
  writing:  ['chatgpt', 'claude', 'jasper', 'copy.ai'],
  research: ['perplexity', 'chatgpt', 'claude', 'elicit'],
  coding:   ['cursor', 'github copilot', 'chatgpt', 'claude', 'tabnine'],
  design:   ['midjourney', 'dall-e', 'stable diffusion', 'firefly'],
};

function prefScore(name, category) {
  const list = PREFS[category] || [];
  const idx = list.findIndex(p => name.toLowerCase().includes(p));
  return idx === -1 ? 999 : idx;
}

function generateInsights(subs) {
  if (subs.length === 0) {
    return {
      totalSpend: 0,
      byCategory: {},
      redundancies: [],
      recommendations: [],
      potentialSavings: 0,
      summary: 'No tools added yet.',
      optimizationInsight: null,
    };
  }

  const totalSpend = subs.reduce((s, t) => s + t.cost, 0);

  // Group by category
  const byCategory = {};
  for (const sub of subs) {
    (byCategory[sub.category] = byCategory[sub.category] || []).push(sub);
  }

  const redundancies = [];
  const recommendations = [];
  let potentialSavings = 0;

  for (const [cat, tools] of Object.entries(byCategory)) {
    if (tools.length < 2) {
      // single tool — just mark as keep
      recommendations.push({
        action: 'keep',
        tool: tools[0],
        reason: `Only ${cat} tool — no redundancy.`,
      });
      continue;
    }

    // Sort by preference score then by cost descending (keep cheaper preferred)
    const sorted = [...tools].sort((a, b) => {
      const ps = prefScore(a.name, cat) - prefScore(b.name, cat);
      return ps !== 0 ? ps : b.cost - a.cost;
    });

    if (tools.length > 2) {
      redundancies.push({
        category: cat,
        count: tools.length,
        message: `You have ${tools.length} tools in the ${cat} category — this is redundant.`,
      });
    }

    // Keep top 1 (or 2 if only 2 tools and neither is redundant)
    const keepCount = tools.length === 2 ? 1 : 1;
    const keep = sorted.slice(0, keepCount);
    const remove = sorted.slice(keepCount);

    for (const t of keep) {
      recommendations.push({
        action: 'keep',
        tool: t,
        reason: `Top ${cat} tool${prefScore(t.name, cat) < 999 ? ' (preferred)' : ' (lowest cost)'}`,
      });
    }
    for (const t of remove) {
      recommendations.push({
        action: 'remove',
        tool: t,
        reason: `Overlapping with ${keep[0].name} in ${cat}`,
      });
      potentialSavings += t.cost;
    }
  }

  const alternatives = findAlternatives(subs);
  const altSavings = alternatives.reduce((s, a) => s + a.savings, 0);
  const totalPotential = potentialSavings + altSavings;

  const optimizationInsight =
    totalPotential > 0
      ? `You can save ~$${totalPotential.toFixed(2)}/month by consolidating tools and switching to cheaper alternatives.`
      : 'Your stack looks lean — no major redundancies or cheaper alternatives detected.';

  return {
    totalSpend,
    byCategory,
    redundancies,
    recommendations,
    alternatives,
    potentialSavings: totalPotential,
    summary: `You are spending $${totalSpend.toFixed(2)}/month on AI tools.`,
    optimizationInsight,
  };
}

// Routes
app.get('/subscriptions', async (req, res) => {
  const userId = req.user?.id || 'anonymous';
  res.json(await getAllSubs(userId));
});

app.get('/detect-category', (req, res) => {
  const name = req.query.name || '';
  const category = detectCategory(name);
  res.json({ category, autoDetected: !!category });
});

app.post('/subscriptions', async (req, res) => {
  const userId = req.user?.id || 'anonymous';
  const { name, cost, category } = req.body;
  if (!name || cost == null) return res.status(400).json({ error: 'name and cost are required.' });
  const trimmedName = name.trim();
  let resolvedCategory = category && category !== 'auto' ? category.toLowerCase() : null;
  let autoDetected = false;
  if (!resolvedCategory) { resolvedCategory = detectCategory(trimmedName) || 'other'; autoDetected = true; }
  const parsedCost = parseFloat(cost);
  const { planName, usageHint } = detectPlan(trimmedName, parsedCost);
  const today = new Date().toISOString().split('T')[0];
  const startDate = req.body.startDate || today;
  const renewal = nextRenewal(startDate);
  const tool = await insertSub(userId, {
    name: trimmedName, cost: parsedCost, category: resolvedCategory,
    autoDetected, planName: planName||null, usageHint: usageHint||null,
    startDate, renewalDate: renewal, daysUntilRenewal: daysUntil(renewal),
  });
  res.status(201).json(tool);
});

// ── Phase 1: Scan engine ─────────────────────────────────────────────────────

// All known vendor names for text scanning (lower-case)
const ALL_VENDORS = [
  'chatgpt', 'openai', 'claude', 'anthropic', 'gemini', 'google one',
  'cursor', 'github copilot', 'copilot', 'tabnine', 'codeium', 'replit',
  'midjourney', 'dall-e', 'dalle', 'stable diffusion', 'firefly', 'runway',
  'canva', 'ideogram', 'leonardo', 'heygen', 'synthesia', 'pika', 'kling',
  'perplexity', 'elicit', 'consensus', 'you.com',
  'jasper', 'copy.ai', 'copyai', 'writesonic', 'grammarly', 'quillbot',
  'notion', 'notion ai', 'lex', 'anyword', 'rytr', 'wordtune',
  'sourcegraph', 'cody', 'blackbox', 'deepseek', 'devin', 'aider',
  'eleven labs', 'elevenlabs', 'murf', 'descript', 'otter', 'fireflies',
  'tome', 'gamma', 'beautiful.ai', 'pitch', 'slides ai',
  'zapier', 'make', 'n8n', 'activepieces',
];

const AMOUNT_RE = /\$\s*([\d,]+(?:\.\d{1,2})?)\s*(?:\/\s*(?:mo(?:nth)?|month|yr|year))?/gi;
const VENDOR_CONFIDENCE = { exact: 0.95, partial: 0.75, amount_only: 0.5 };

function normalizeCost(raw) {
  // Convert yearly to monthly if hinted
  return parseFloat(String(raw).replace(/,/g, '')) || 0;
}

function scanText(text) {
  const candidates = [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Find amount in line
    AMOUNT_RE.lastIndex = 0;
    const amtMatch = AMOUNT_RE.exec(line);
    const cost = amtMatch ? normalizeCost(amtMatch[1]) : null;

    // Find vendor in line
    const vendor = ALL_VENDORS.find(v => lower.includes(v));

    if (!vendor && cost === null) continue; // nothing useful

    let name = vendor
      ? vendor.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
      : null;
    const confidence = vendor && cost !== null
      ? VENDOR_CONFIDENCE.exact
      : vendor
      ? VENDOR_CONFIDENCE.partial
      : VENDOR_CONFIDENCE.amount_only;

    // If no vendor found but there's an amount, use surrounding text as name hint
    if (!name) {
      name = line.replace(AMOUNT_RE, '').replace(/[^a-zA-Z0-9 ]/g, ' ').trim().slice(0, 40) || 'Unknown';
    }

    const category = detectCategory(name) || 'other';
    const { planName, usageHint } = detectPlan(name, cost || 0);

    candidates.push({
      id: `cand-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      cost: cost || 0,
      category,
      planName,
      usageHint,
      confidence,
      evidence: line.slice(0, 120),
      source: 'text',
    });
  }

  // Deduplicate by lowercased name
  const seen = new Set();
  return candidates.filter(c => {
    const key = c.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scanCSV(text) {
  const rows = text.split(/\r?\n/).map(r => r.trim()).filter(Boolean);
  if (rows.length === 0) return [];

  // Try to detect header row
  const firstLower = rows[0].toLowerCase();
  const hasHeader = ['name', 'tool', 'cost', 'price', 'amount', 'category'].some(h => firstLower.includes(h));
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const header = hasHeader
    ? rows[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
    : null;

  const colIdx = (names) => {
    if (!header) return -1;
    for (const n of names) {
      const i = header.findIndex(h => h.includes(n));
      if (i !== -1) return i;
    }
    return -1;
  };

  const nameCol     = colIdx(['name', 'tool', 'service', 'product']);
  const costCol     = colIdx(['cost', 'price', 'amount', 'monthly', 'spend']);
  const categoryCol = colIdx(['category', 'type', 'cat']);

  const candidates = [];

  for (const row of dataRows) {
    if (!row) continue;
    // Simple CSV split (doesn't handle quoted commas — good enough for P1)
    const cols = row.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length === 0 || cols.every(c => !c)) continue;

    const name     = cols[nameCol !== -1 ? nameCol : 0] || '';
    const rawCost  = cols[costCol !== -1 ? costCol : 1] || '0';
    const rawCat   = cols[categoryCol !== -1 ? categoryCol : 2] || '';
    const cost     = normalizeCost(rawCost.replace(/[$,]/g, ''));

    if (!name) continue;

    const category = rawCat.toLowerCase() || detectCategory(name) || 'other';
    const { planName, usageHint } = detectPlan(name, cost);
    const confidence = detectCategory(name) ? VENDOR_CONFIDENCE.exact : VENDOR_CONFIDENCE.partial;

    candidates.push({
      id: `cand-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.slice(0, 60),
      cost,
      category,
      planName,
      usageHint,
      confidence,
      evidence: row.slice(0, 120),
      source: 'csv',
    });
  }

  return candidates;
}

// GET /scan/gmail  — auto-scan signed-in user's Gmail inbox
app.get('/scan/gmail', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.provider !== 'google') return res.status(400).json({ error: 'Gmail scan requires Google sign-in' });

  const accessToken = accessTokens[req.user.id];
  if (!accessToken) return res.status(400).json({ error: 'No Gmail access token — please sign out and sign in again with Google' });

  try {
    // Search all mail including spam/trash — no label filter
    const query = encodeURIComponent(
      '(from:(openai.com OR anthropic.com OR cursor.sh OR github.com OR midjourney.com OR ' +
      'perplexity.ai OR notion.so OR runway.ml OR canva.com OR replit.com OR jasper.ai OR ' +
      'grammarly.com OR tabnine.com OR heygen.com OR elevenlabs.io OR zapier.com OR ' +
      'adobe.com OR figma.com OR loom.com OR otter.ai OR descript.com OR murf.ai) ' +
      'OR subject:(receipt OR invoice OR subscription OR renewal OR billing OR payment OR ' +
      'charged OR "your plan" OR ChatGPT OR Claude OR Cursor OR Midjourney OR ' +
      'Copilot OR Perplexity OR Notion OR Grammarly OR Jasper OR Runway OR Canva))'
    );

    // Search across ALL mail (inbox + spam + trash) by querying without label restriction
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=100&includeSpamTrash=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listData = await listRes.json();

    if (!listData.messages || listData.messages.length === 0) {
      return res.json({ candidates: [], message: 'No AI billing emails found. Try the paste text option and paste an email manually.' });
    }

    // Fetch up to 40 emails in parallel
    const emails = await Promise.all(
      listData.messages.slice(0, 40).map(async ({ id }) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        return msgRes.json();
      })
    );

    // Recursively extract plain text from all MIME parts
    function extractText(payload) {
      if (!payload) return '';
      const mimeType = payload.mimeType || '';
      if (mimeType === 'text/plain' && payload.body?.data) {
        return Buffer.from(payload.body.data, 'base64').toString('utf8');
      }
      if (mimeType === 'text/html' && payload.body?.data) {
        const html = Buffer.from(payload.body.data, 'base64').toString('utf8');
        return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      }
      if (payload.parts) {
        return payload.parts.map(p => extractText(p)).join('\n');
      }
      if (payload.body?.data) {
        return Buffer.from(payload.body.data, 'base64').toString('utf8');
      }
      return '';
    }

    // Build text per email: from + subject + snippet + body
    const allText = emails.map(e => {
      const subject = e.payload?.headers?.find(h => h.name === 'Subject')?.value || '';
      const from    = e.payload?.headers?.find(h => h.name === 'From')?.value || '';
      const snippet = e.snippet || '';
      const body    = extractText(e.payload);
      return `${from}\n${subject}\n${snippet}\n${body}`;
    }).join('\n---\n');

    const candidates = scanText(allText);
    res.json({ candidates, scanned: emails.length, found: listData.messages.length });
  } catch (err) {
    console.error('Gmail scan error:', err);
    res.status(500).json({ error: 'Gmail scan failed — ' + err.message });
  }
});

// ── File upload (multer) ──────────────────────────────────────────────────────
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// POST /scan/file  — upload PDF or TXT file
app.post('/scan/file', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required.' });
  const mime = req.file.mimetype;
  const originalName = req.file.originalname || '';
  const ext = originalName.split('.').pop().toLowerCase();
  try {
    let text = '';
    if (mime === 'application/pdf' || ext === 'pdf') {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(req.file.buffer);
      text = data.text;
    } else {
      // TXT or any other text-based file
      text = req.file.buffer.toString('utf8');
    }
    res.json({ candidates: scanText(text) });
  } catch (err) {
    console.error('File scan error:', err);
    res.status(500).json({ error: 'File scan failed — ' + err.message });
  }
});

// POST /scan/text  — paste raw text
app.post('/scan/text', (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required.' });
  res.json({ candidates: scanText(text) });
});

// POST /scan/csv  — paste or upload CSV content
app.post('/scan/csv', (req, res) => {
  const { csv } = req.body;
  if (!csv) return res.status(400).json({ error: 'csv is required.' });
  res.json({ candidates: scanCSV(csv) });
});

// POST /scan/confirm  — bulk-import accepted candidates
app.post('/scan/confirm', (req, res) => {
  const { candidates } = req.body; // array of {name,cost,category,startDate?}
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return res.status(400).json({ error: 'candidates array is required.' });
  }
  const userId = req.user?.id || 'anonymous';
  const today = new Date().toISOString().split('T')[0];
  const added = await Promise.all(candidates.map(async c => {
    const name = (c.name || '').trim();
    const cost = parseFloat(c.cost) || 0;
    const resolvedCategory = c.category && c.category !== 'auto'
      ? c.category.toLowerCase() : detectCategory(name) || 'other';
    const { planName, usageHint } = detectPlan(name, cost);
    const startDate = c.startDate || today;
    const renewal = nextRenewal(startDate);
    return await insertSub(userId, {
      name, cost, category: resolvedCategory,
      autoDetected: true, planName: planName||null, usageHint: usageHint||null,
      startDate, renewalDate: renewal, daysUntilRenewal: daysUntil(renewal),
    });
  }));
  res.status(201).json({ imported: added.length, tools: added });
});

app.delete('/subscriptions/:id', async (req, res) => {
  const userId = req.user?.id || 'anonymous';
  const id = parseInt(req.params.id);
  if (!await deleteSubById(userId, id)) return res.status(404).json({ error: 'Not found.' });
  res.json({ success: true });
});

app.get('/insights', async (req, res) => {
  const userId = req.user?.id || 'anonymous';
  res.json(generateInsights(await getAllSubs(userId)));
});

const PORT = process.env.PORT || 3001;
initDB()
  .then(() => app.listen(PORT, '0.0.0.0', () => console.log(`Backend running on port ${PORT}`)))
  .catch(err => { console.error('DB init failed:', err); process.exit(1); });
