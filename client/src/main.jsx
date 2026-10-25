import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const api = async (path, options = {}) => {
  const response = await fetch(path, { credentials: 'include', headers: { 'content-type': 'application/json', ...(options.headers || {}) }, ...options });
  const body = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || 'Request failed.');
  return body;
};

function App() {
  const [user, setUser] = useState(null);
  const [loginRole, setLoginRole] = useState('tester');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [page, setPage] = useState('overview');
  const [reports, setReports] = useState([]);
  const [catalog, setCatalog] = useState({ games: [], builds: [], sessions: [] });
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme); }, [theme]);
  const clearProtectedState = () => {
    setUser(null);
    setReports([]);
    setCatalog({ games: [], builds: [], sessions: [] });
    setSelected(null);
    setPage('overview');
  };
  const revalidateSession = () => api('/api/auth/me').then(({ user: current }) => {
    setUser(current);
    setLoginRole(current.role);
  }).catch(() => clearProtectedState());
  useEffect(() => {
    revalidateSession();
    const handlePageShow = () => revalidateSession();
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);
  useEffect(() => { if (user) Promise.all([api('/api/reports'), api('/api/games')]).then(([reportData, catalogData]) => { setReports(reportData.reports); setCatalog(catalogData); }).catch((error) => setToast(error.message)); }, [user]);
  const isDeveloper = user?.role === 'developer';
  const nav = isDeveloper ? [['overview', 'Overview'], ['reports', 'Feedback explorer'], ['issues', 'Issue board'], ['games', 'Games & builds']] : [['overview', 'Overview'], ['reports', 'My reports'], ['submit', 'Submit feedback'], ['games', 'My games']];
  const signOut = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await api('/api/auth/logout', { method: 'POST' });
      setLoginRole(user.role);
      clearProtectedState();
    } catch (error) {
      setToast(error.message);
    } finally {
      setIsLoggingOut(false);
    }
  };
  if (!user) return <Login initialRole={loginRole} onLogin={(current) => { setLoginRole(current.role); setUser(current); }} />;
  const refresh = () => api('/api/reports').then(({ reports: next }) => setReports(next));
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">S</span><span>Signal<span>Forge</span><small>PLAYTEST INTELLIGENCE</small></span></div>
      <div className="portal-label">{isDeveloper ? 'DEVELOPER CONSOLE' : 'TESTER PORTAL'}</div>
      <nav>{nav.map(([key, label]) => <button className={page === key ? 'nav-item active' : 'nav-item'} onClick={() => { setPage(key); setSelected(null); }} key={key}><i>{key === 'overview' ? '◈' : key === 'reports' ? '▤' : key === 'submit' ? '+' : key === 'issues' ? '⊞' : '◆'}</i>{label}</button>)}</nav>
      <div className="sidebar-footer"><div className="user-chip"><span className="avatar">{user.name.split(' ').map((x) => x[0]).join('')}</span><span><b>{user.name}</b><small>{isDeveloper ? 'Lead developer' : 'Playtester'}</small></span></div><button className="text-button" onClick={signOut} disabled={isLoggingOut}>{isLoggingOut ? 'Signing out…' : 'Sign out'}</button></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div><span className="eyebrow">WORKSPACE / {isDeveloper ? 'CONTROL ROOM' : 'FIELD NOTES'}</span><h1>{selected ? selected.reportId : nav.find(([key]) => key === page)?.[1]}</h1></div><div className="top-actions"><span className="system-status"><span className="status-dot" /> SYSTEMS NOMINAL</span><button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'cyber' : 'light')}>{theme === 'light' ? 'Dark mode' : 'Light mode'}</button></div></header>
      {toast && <div className="toast">{toast}<button onClick={() => setToast('')}>×</button></div>}
      {selected ? <ReportDetail report={selected} user={user} onBack={() => setSelected(null)} onToast={setToast} onRefresh={refresh} /> : page === 'overview' ? <Dashboard developer={isDeveloper} reports={reports} catalog={catalog} onSelect={setSelected} onNavigate={setPage} /> : page === 'submit' ? <Submit catalog={catalog} onDone={(report) => { setReports([report, ...reports]); setSelected(report); }} onToast={setToast} /> : page === 'games' ? <Games catalog={catalog} developer={isDeveloper} onToast={setToast} /> : <ReportList developer={isDeveloper} reports={reports} onSelect={setSelected} onNavigate={setPage} />}
    </main>
  </div>;
}

function Login({ initialRole = 'tester', onLogin }) {
  const [role, setRole] = useState(initialRole); const [email, setEmail] = useState(initialRole === 'developer' ? 'developer@signalforge.demo' : 'tester@signalforge.demo'); const [password, setPassword] = useState('DemoPass123!'); const [error, setError] = useState('');
  const submit = (event) => { event.preventDefault(); api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password, role }) }).then(({ user }) => onLogin(user)).catch((e) => setError(e.message)); };
  return <div className="login-page"><div className="login-visual"><div className="brand"><span className="brand-mark">S</span><span>Signal<span>Forge</span><small>PLAYTEST INTELLIGENCE</small></span></div><div className="visual-copy"><span className="eyebrow">BUILD BETTER. TOGETHER.</span><h1>Turn player friction<br /><em>into forward motion.</em></h1><p>Evidence-led feedback intelligence for indie teams who care about every moment of play.</p></div><div className="visual-footer">LOCAL WORKSPACE · 2026 / V1.0</div></div><div className="login-form-wrap"><div className="login-form"><span className="eyebrow">WELCOME BACK</span><h2>Enter the workspace</h2><p className="muted">Choose your portal to continue.</p><div className="role-tabs"><button className={role === 'tester' ? 'selected' : ''} onClick={() => { setRole('tester'); setEmail('tester@signalforge.demo'); }}>Tester portal</button><button className={role === 'developer' ? 'selected' : ''} onClick={() => { setRole('developer'); setEmail('developer@signalforge.demo'); }}>Developer portal</button></div><form onSubmit={submit}><label>EMAIL ADDRESS<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" /></label><label>PASSWORD<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" /></label>{error && <div className="form-error">{error}</div>}<button className="primary-button wide">Open {role} portal <span>→</span></button></form><p className="demo-hint">Demo credentials are prefilled · Password: DemoPass123!</p></div></div></div>;
}

function Dashboard({ developer, reports, catalog, onSelect, onNavigate }) {
  const stats = developer ? [['TOTAL REPORTS', reports.length, 'All incoming feedback'], ['UNRESOLVED', reports.filter((r) => !['Closed', 'Verified'].includes(r.status)).length, 'Needs attention'], ['HIGH PRIORITY', reports.filter((r) => r.priority === 'High').length, 'Across all builds'], ['AWAITING RETEST', reports.filter((r) => r.status === 'Awaiting Retest').length, 'Pending verification']] : [['SUBMITTED', reports.length, 'Your field notes'], ['AWAITING REVIEW', reports.filter((r) => r.status === 'New').length, 'Recently submitted'], ['IN INVESTIGATION', reports.filter((r) => r.status === 'Under Investigation').length, 'Being looked into'], ['AWAITING RETEST', reports.filter((r) => r.status === 'Awaiting Retest').length, 'Pending your verification']];
  return <div className="dashboard"><div className="hero-row"><div><span className="eyebrow">{developer ? 'GOOD MORNING, MAYA' : 'FIELD NOTES / OCTOBER 23'}</span><h2>{developer ? 'The signal is getting clearer.' : 'Your feedback makes the difference.'}</h2><p>{developer ? 'Here is the latest pulse from your playtest workspace.' : 'Every detail helps the team turn rough edges into better moments.'}</p></div><button className="primary-button" onClick={() => onNavigate(developer ? 'reports' : 'submit')}>{developer ? 'Open feedback explorer' : 'Submit feedback'} <span>→</span></button></div><div className="stat-grid">{stats.map(([label, value, note]) => <div className="stat-card" key={label}><span className="eyebrow">{label}</span><strong>{value}</strong><small>{note}</small></div>)}</div><div className="section-heading"><div><span className="eyebrow">RECENT ACTIVITY</span><h3>{developer ? 'Feedback that needs your eye' : 'Your recently updated reports'}</h3></div><button className="text-button" onClick={() => onNavigate('reports')}>View all →</button></div><div className="activity-list">{reports.slice(0, 4).map((report) => <button className="activity-row" key={report._id} onClick={() => onSelect(report)}><span className={`category-mark ${report.category === 'Bug' ? 'bug' : 'note'}`}>{report.category === 'Bug' ? '!' : 'i'}</span><span className="activity-copy"><b>{report.title}</b><small>{report.reportId} · {report.category} · {new Date(report.updatedAt || report.createdAt).toLocaleDateString()}</small></span><Status status={report.status} /><span className="chevron">›</span></button>)}{!reports.length && <Empty title="No feedback yet" body="Your workspace will become more useful as reports arrive." />}</div>{developer && <div className="detective-banner"><div><span className="eyebrow">SIGNATURE AI FEATURE</span><h3>Playtest Detective</h3><p>Trace the evidence behind an issue without losing the human context.</p></div><span className="detective-orbit">✦</span></div>}</div>;
}

function ReportList({ developer, reports, onSelect, onNavigate }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => reports.filter((r) => `${r.title} ${r.reportId} ${r.category}`.toLowerCase().includes(query.toLowerCase())), [reports, query]);
  return <div className="page"><div className="toolbar"><div className="search"><span>⌕</span><input placeholder="Search reports, titles, IDs..." value={query} onChange={(e) => setQuery(e.target.value)} /></div>{!developer && <button className="primary-button" onClick={() => onNavigate('submit')}>+ New report</button>}</div><div className="table-card"><div className="table-header"><span>REPORT</span><span>CATEGORY</span><span>STATUS</span><span>PRIORITY</span><span>UPDATED</span><span /></div>{filtered.map((report) => <button className="table-row" key={report._id} onClick={() => onSelect(report)}><span><b>{report.title}</b><small>{report.reportId} · {report.game?.name || 'Starfall Outpost'}</small></span><span className="muted">{report.category}</span><Status status={report.status} /><span className={`priority ${report.priority?.toLowerCase()}`}>{report.priority || '—'}</span><span className="muted">{new Date(report.updatedAt || report.createdAt).toLocaleDateString()}</span><span>›</span></button>)}{!filtered.length && <Empty title="Nothing matched" body="Try a different search term." />}</div></div>;
}

function ReportDetail({ report: initial, user, onBack, onToast, onRefresh }) {
  const [report, setReport] = useState(initial); const [messages, setMessages] = useState([]); const [content, setContent] = useState(''); const [investigation, setInvestigation] = useState(null); const [retest, setRetest] = useState('Pass');
  const load = () => api(`/api/reports/${report._id}/messages`).then(({ messages: next }) => setMessages(next)).catch((error) => onToast(error.message));
  useEffect(() => { load(); }, [report._id]);
  const send = (e) => { e.preventDefault(); if (!content.trim()) return; api(`/api/reports/${report._id}/messages`, { method: 'POST', body: JSON.stringify({ content }) }).then(({ message }) => { setMessages([...messages, message]); setContent(''); }).catch((e) => onToast(e.message)); };
  const setStatus = (status) => api(`/api/reports/${report._id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }).then(({ report: next }) => { setReport({ ...report, ...next }); onRefresh(); }).catch((e) => onToast(e.message));
  const runDetective = () => api(`/api/reports/${report._id}/investigate`, { method: 'POST', body: JSON.stringify({}) }).then(({ investigation: next }) => setInvestigation(next)).catch((e) => onToast(e.message));
  const submitRetest = () => api(`/api/reports/${report._id}/retests`, { method: 'POST', body: JSON.stringify({ result: retest, details: 'Retest submitted from the report workspace.' }) }).then(() => { setReport({ ...report, status: retest === 'Pass' ? 'Verified' : retest === 'Fail' ? 'Under Investigation' : 'Awaiting Retest' }); onRefresh(); onToast('Retest recorded.'); }).catch((e) => onToast(e.message));
  return <div className="detail-page"><button className="back-button" onClick={onBack}>← Back to reports</button><div className="detail-heading"><div><span className="eyebrow">{report.reportId} / {report.category}</span><h2>{report.title}</h2><p className="muted">Submitted by {report.tester?.name || 'Alex Rivera'} · {new Date(report.createdAt).toLocaleString()}</p></div><Status status={report.status} /></div><div className="detail-layout"><div className="detail-main"><section className="content-card"><div className="card-heading"><h3>Original report</h3><span className="priority high">{report.priority || 'Unprioritized'}</span></div><p className="report-description">{report.description}</p><div className="evidence-grid"><Evidence label="STEPS TO REPRODUCE" value={report.steps} /><Evidence label="EXPECTED BEHAVIOR" value={report.expected} /><Evidence label="ACTUAL BEHAVIOR" value={report.actual} /></div></section>{investigation && <EvidenceSummary investigation={investigation} />}<section className="content-card"><div className="card-heading"><div><span className="eyebrow">REPORT THREAD</span><h3>Message {user.role === 'developer' ? 'tester' : 'developer'}</h3></div><span className="unread-dot">● LIVE</span></div><div className="message-list">{messages.map((message) => <div className={message.senderId === user._id ? 'message own' : 'message'} key={message._id}><div className="message-meta"><b>{message.senderId === user._id ? 'You' : user.role === 'developer' ? 'Alex Rivera' : 'Maya Chen'}</b><span>{new Date(message.createdAt).toLocaleString()}</span></div><p>{message.content}</p></div>)}{!messages.length && <p className="muted">No messages yet. Start the investigation with a focused question.</p>}</div><form className="message-form" onSubmit={send}><input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Ask for reproduction details..." /><button className="primary-button">Send</button></form></section></div><aside className="detail-side"><section className="side-card"><span className="eyebrow">WORKSPACE CONTEXT</span><dl><dt>GAME</dt><dd>{report.game?.name || 'Starfall Outpost'}</dd><dt>BUILD</dt><dd>{report.build?.version || '0.8.4'}</dd><dt>SESSION</dt><dd>Bridge traversal study</dd><dt>SEVERITY</dt><dd>{report.severity || 'Not assessed'}</dd></dl></section>{user.role === 'developer' && <><section className="side-card action-card"><span className="eyebrow">ISSUE CONTROL</span><label>Status<select value={report.status} onChange={(e) => setStatus(e.target.value)}>{['New', 'Under Investigation', 'In Progress', 'Fix Available', 'Awaiting Retest', 'Verified', 'Closed'].map((s) => <option key={s}>{s}</option>)}</select></label><button className="detective-button" onClick={runDetective}>✦ Run Playtest Detective</button></section></>}{user.role === 'tester' && report.status === 'Awaiting Retest' && <section className="side-card action-card"><span className="eyebrow">RETEST REQUEST</span><label>Result<select value={retest} onChange={(e) => setRetest(e.target.value)}><option>Pass</option><option>Fail</option><option>Unable to Reproduce</option></select></label><button className="primary-button wide" onClick={submitRetest}>Submit retest</button></section>}</aside></div></div>;
}

function EvidenceSummary({ investigation }) {
  const [expanded, setExpanded] = useState(false);
  const extractSection = (heading) => {
    const match = investigation.summary?.match(new RegExp(`${heading}[^\\n]*\\n([\\s\\S]*?)(?=\\n\\s*(?:Confirmed facts|Possible explanations|Missing information|Next test|Suggested next test)\\s*:|$)`, 'i'));
    return match?.[1]?.split('\n').map((line) => line.replace(/^\s*[-*]\s*/, '').trim()).filter(Boolean) || [];
  };
  const sectionItems = (key, heading) => investigation[key]?.length ? investigation[key] : extractSection(heading);
  const sections = [
    ['Confirmed Facts', sectionItems('confirmed', 'Confirmed facts')],
    ['Similar Reports', investigation.evidence?.similarReports?.map((item) => item.reportId).filter(Boolean)],
    ['Possible Explanations', sectionItems('possible', 'Possible explanations')],
    ['Missing Information', sectionItems('missing', 'Missing information')]
  ];
  const nextTest = investigation.nextTest || extractSection('next test')[0] || 'No next test was provided.';
  return <section className={`evidence-summary content-card${expanded ? ' expanded' : ''}`}>
    <div className="evidence-summary-heading"><div><span className="eyebrow">{investigation.mode === 'ollama' ? 'OLLAMA EVIDENCE SUMMARY' : 'CONTROLLED FALLBACK'}</span><h3>Playtest Detective — Evidence Summary</h3></div><button className="text-button" onClick={() => setExpanded(!expanded)}>{expanded ? 'Show less' : 'Show more'}</button></div>
    <div className="evidence-summary-grid">{sections.map(([title, items]) => <div className="evidence-summary-section" key={title}><span className="eyebrow">{title}</span>{items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="evidence-summary-empty">No additional {title.toLowerCase()} returned.</p>}</div>)}<div className="evidence-summary-section next-test"><span className="eyebrow">Suggested Next Test</span><p>{nextTest}</p></div></div>
    <details className="evidence-summary-raw" open={expanded}><summary>AI response</summary><p>{investigation.summary}</p></details>
  </section>;
}

function Submit({ catalog, onDone, onToast }) { const [form, setForm] = useState({ title: '', category: 'Bug', description: '', steps: '', expected: '', actual: '', gameId: catalog.games[0]?._id || 'game-1' }); const update = (key, value) => setForm({ ...form, [key]: value }); const submit = (e) => { e.preventDefault(); api('/api/reports', { method: 'POST', body: JSON.stringify(form) }).then(({ report }) => onDone(report)).catch((e) => onToast(e.message)); }; return <div className="form-page"><div className="form-intro"><span className="eyebrow">FIELD NOTE / NEW</span><h2>What did you notice?</h2><p>Specific details help the team reproduce and resolve issues faster. Your original words are always preserved.</p></div><form className="content-card report-form" onSubmit={submit}><label>GAME<select value={form.gameId} onChange={(e) => update('gameId', e.target.value)}>{catalog.games.map((game) => <option key={game._id} value={game._id}>{game.name}</option>)}</select></label><label>REPORT TITLE<input required value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="A clear summary of what happened" /></label><label>CATEGORY<select value={form.category} onChange={(e) => update('category', e.target.value)}>{['Bug', 'Confusing Instruction', 'Frustration', 'Gameplay Issue', 'Performance Issue', 'Other'].map((x) => <option key={x}>{x}</option>)}</select></label><label>DESCRIBE WHAT HAPPENED<textarea required value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Tell us what you experienced..." /></label><div className="form-two"><label>STEPS TO REPRODUCE<textarea value={form.steps} onChange={(e) => update('steps', e.target.value)} /></label><label>EXPECTED BEHAVIOR<textarea value={form.expected} onChange={(e) => update('expected', e.target.value)} /></label></div><label>ACTUAL BEHAVIOR<textarea value={form.actual} onChange={(e) => update('actual', e.target.value)} /></label><div className="form-actions"><span className="muted">You can add supporting evidence later.</span><button className="primary-button">Submit field note <span>→</span></button></div></form></div>; }
function Games({ catalog, developer, onToast }) { const [name, setName] = useState(''); const add = () => api('/api/games', { method: 'POST', body: JSON.stringify({ name, description: 'New game workspace' }) }).then(() => { setName(''); onToast('Game created.'); }).catch((e) => onToast(e.message)); return <div className="page"><div className="section-heading"><div><span className="eyebrow">{developer ? 'WORKSPACE CATALOG' : 'AUTHORIZED ACCESS'}</span><h3>{developer ? 'Games and builds' : 'Your playtest spaces'}</h3></div></div><div className="game-grid">{catalog.games.map((game) => <div className="game-card" key={game._id}><div className="game-art">{game.name.slice(0, 1)}</div><div><span className="eyebrow">{game.genre || 'GAME WORKSPACE'}</span><h3>{game.name}</h3><p>{game.description}</p><small>{catalog.builds.filter((build) => build.gameId === game._id).length} builds · {game.status}</small></div></div>)}</div>{developer && <div className="inline-create"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="New game name" /><button className="primary-button" onClick={add}>Create game</button></div>}</div>; }
function Evidence({ label, value }) { return <div><span className="eyebrow">{label}</span><p>{value || 'Not provided'}</p></div>; }
function Status({ status }) { return <span className={`status status-${status?.toLowerCase().replaceAll(' ', '-')}`}><i />{status}</span>; }
function Empty({ title, body }) { return <div className="empty"><h3>{title}</h3><p>{body}</p></div>; }
createRoot(document.getElementById('root')).render(<App />);
