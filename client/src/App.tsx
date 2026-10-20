import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { api, type Dashboard, type Member, type Standup } from './services/api.js';
import { standupCreateSchema, standupUpdateSchema } from '../../shared/validation.js';

type Page = 'today' | 'history';
const splitTasks = (value: string) => value.split('\n').map((task) => task.trim()).filter(Boolean);

function StandupCard({ standup, onEdit }: { standup: Standup; onEdit?: ((standup: Standup) => void) | undefined }) {
  return <article className="standup-card">
    <div className="member-line"><h3>{standup.displayName}</h3><span className="badge submitted">Submitted</span></div>
    <h4>Tasks</h4><ul>{standup.tasks.map((task, index) => <li key={`${index}-${task}`}>{task}</li>)}</ul>
    <h4>Blockers</h4><p>{standup.blockers || 'None reported'}</p>
    {onEdit && <button className="button secondary" type="button" onClick={() => onEdit(standup)} aria-label={`Edit ${standup.displayName} standup for ${standup.teamDate}`}>Edit standup</button>}
  </article>;
}

export default function App() {
  const [page, setPage] = useState<Page>('today');
  const [members, setMembers] = useState<Member[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [selectedMember, setSelectedMember] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [editing, setEditing] = useState(false);
  const [tasks, setTasks] = useState('');
  const [blockers, setBlockers] = useState('');
  const [history, setHistory] = useState<Standup[]>([]);
  const [historySearched, setHistorySearched] = useState(false);
  const [historyDate, setHistoryDate] = useState('');
  const [historyMember, setHistoryMember] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const tasksRef = useRef<HTMLTextAreaElement>(null);
  const activeMembers = members.filter(({ active }) => active);

  const todayPanel = dashboard?.panels.find(({ teamDate }) => teamDate === dashboard.teamDate);
  const previousPanel = dashboard?.panels.find(({ teamDate }) => teamDate === dashboard.previousWorkingDay);
  const selectedPanel = dashboard?.panels.find(({ teamDate }) => teamDate === selectedDate);
  const selectedExisting = useMemo(() => dashboard?.panels.flatMap(({ submittedMembers }) => submittedMembers).find((item) => item.memberId === selectedMember && item.teamDate === selectedDate), [dashboard, selectedDate, selectedMember]);

  async function loadDashboard(refresh = false) {
    if (!refresh) setLoading(true);
    try {
      const [roster, nextDashboard] = await Promise.all([api.members(), api.dashboard()]);
      setMembers(roster);
      setDashboard(nextDashboard);
      setSelectedDate((current) => current === nextDashboard.teamDate || current === nextDashboard.previousWorkingDay ? current : nextDashboard.teamDate);
      setHistoryDate((current) => current || nextDashboard.teamDate);
      if (!refresh) setSelectedMember((current) => current || nextDashboard.panels.find(({ teamDate }) => teamDate === nextDashboard.teamDate)?.missingMembers[0]?.id || '');
      setError('');
    } catch (cause) { setError(`${refresh ? 'Your standup was saved, but the dashboard could not refresh. ' : ''}${cause instanceof Error ? cause.message : 'Unable to load the dashboard.'}`); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadDashboard(); }, []);
  useEffect(() => {
    if (!editing || !selectedExisting) { setTasks(''); setBlockers(''); return; }
    setTasks(selectedExisting.tasks.join('\n'));
    setBlockers(selectedExisting.blockers);
  }, [editing, selectedExisting, selectedDate, selectedMember]);

  function addStandup() {
    setEditing(false);
    setSelectedDate(dashboard?.teamDate ?? '');
    setSelectedMember(todayPanel?.missingMembers[0]?.id ?? '');
    setTasks(''); setBlockers('');
    setError(''); setNotice('');
    tasksRef.current?.focus();
  }

  function editStandup(standup: Standup) {
    setEditing(true);
    setSelectedMember(standup.memberId);
    setSelectedDate(standup.teamDate);
    setTasks(standup.tasks.join('\n'));
    setBlockers(standup.blockers);
    setError(''); setNotice('');
    tasksRef.current?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('');
    if (savingRef.current) return;
    if (!editing && selectedExisting) {
      setError('This member already has a standup for this date. Choose Edit existing standup to change it, or select another member or date.');
      return;
    }
    const taskList = splitTasks(tasks);
    let save: (() => Promise<Standup>) | undefined;
    if (editing && selectedExisting) {
      const parsed = standupUpdateSchema.safeParse({ tasks: taskList, blockers });
      if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check the standup fields and try again.'); return; }
      save = () => api.update(selectedExisting.id, parsed.data);
    } else {
      const parsed = standupCreateSchema.safeParse({ memberId: selectedMember, teamDate: selectedDate, tasks: taskList, blockers });
      if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check the standup fields and try again.'); return; }
      save = () => api.create(parsed.data);
    }
    savingRef.current = true; setSaving(true);
    try {
      const saved = await save();
      setEditing(true);
      setTasks(saved.tasks.join('\n')); setBlockers(saved.blockers);
      setNotice(`Standup ${editing ? 'updated' : 'submitted'} for ${saved.displayName} on ${saved.teamDate}. Saved ${saved.tasks.length} ${saved.tasks.length === 1 ? 'task' : 'tasks'}.`);
      setDashboard((current) => current ? { ...current, panels: current.panels.map((panel) => panel.teamDate === saved.teamDate ? {
        ...panel,
        submittedMembers: [...panel.submittedMembers.filter(({ id }) => id !== saved.id), saved],
        missingMembers: panel.missingMembers.filter(({ id }) => id !== saved.memberId),
      } : panel) } : current);
      await loadDashboard(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save this standup.'); }
    finally { savingRef.current = false; setSaving(false); }
  }

  async function searchHistory(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault(); setError('');
    try {
      setHistory((await api.history(historyDate, historyMember)).standups);
      setHistorySearched(true);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load history.'); }
  }

  async function downloadExport(date: string) {
    setError('');
    try {
      const result = await api.export(date);
      const file = new Blob([result.markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(file);
      const link = document.createElement('a'); link.href = url; link.download = `team-standup-${result.teamDate}.md`; link.click(); URL.revokeObjectURL(url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to export this date.'); }
  }

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#today" onClick={() => setPage('today')} aria-label="Team Standup home"><span className="brand-mark">S</span><span>standup<span className="brand-light">/team</span></span></a>
      <nav aria-label="Main navigation"><button className={page === 'today' ? 'nav-link active' : 'nav-link'} onClick={() => setPage('today')}>Today</button><button className={page === 'history' ? 'nav-link active' : 'nav-link'} onClick={() => setPage('history')}>History</button></nav>
      <div className="timezone-pill"><span className="pulse" /> Team timezone <strong>IST · UTC+5:30</strong></div>
    </header>
    <main>
      {error && <div className="alert error" role="alert"><span aria-hidden="true">!</span>{error}<button onClick={() => { if (page === 'history') void searchHistory(); else void loadDashboard(); }} aria-label="Retry request">Retry</button><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
      {notice && <div className="alert success" role="status">✓ {notice}</div>}
      {page === 'today' ? <>
        <section className="page-heading"><div><p className="eyebrow">TEAM WORKSPACE <span>·</span> DAILY CHECK-IN</p><h1>Today’s standup</h1><p className="subheading">A clear view of what’s moving—and what’s getting in the way.</p></div><button className="button secondary export-button" onClick={() => void downloadExport(selectedDate)} disabled={!dashboard} aria-label={`Export day ${selectedDate}`}>↧ <span>Export day · {selectedDate}</span></button></section>
        {dashboard && <div className="date-banner"><div className="calendar-icon">▦</div><div><strong>{new Date(`${dashboard.teamDate}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong><span>Team date · Asia/Kolkata</span></div><span className="date-chip">TODAY</span></div>}
        {loading ? <div className="loading" role="status">Loading team standups…</div> : <div className="dashboard-grid">
          <section className="panel submissions-panel"><div className="panel-heading"><div><p className="eyebrow">TEAM PULSE</p><h2>Team submissions</h2></div><span className="count-pill">{todayPanel?.submittedMembers.length ?? 0}<span> / {activeMembers.length}</span></span></div>
            <div className="progress-track"><span style={{ width: `${activeMembers.length ? ((todayPanel?.submittedMembers.length ?? 0) / activeMembers.length) * 100 : 0}%` }} /></div>
            <div className="submission-list">{todayPanel?.submittedMembers.map((standup) => <div className="submission-row" key={standup.id}><span className="avatar">{standup.displayName.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div className="submission-person"><strong>{standup.displayName}</strong><span>{standup.tasks.length} {standup.tasks.length === 1 ? 'task' : 'tasks'}{standup.blockers ? ' · blocker noted' : ''}</span></div><span className="badge submitted">Submitted</span></div>)}
              {todayPanel?.missingMembers.map((member) => <div className="submission-row missing-row" key={member.id}><span className="avatar muted-avatar">{member.displayName.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div className="submission-person"><strong>{member.displayName}</strong><span>Still waiting for an update</span></div><span className="badge missing">Awaiting update</span></div>)}
              {!todayPanel?.submittedMembers.length && !todayPanel?.missingMembers.length && <p className="empty-state">No active members are configured.</p>}</div>
          </section>
          <section className="panel form-panel" aria-labelledby="editor-heading"><div className="panel-heading"><div><p className="eyebrow">YOUR CHECK-IN</p><h2 id="editor-heading">{editing ? 'Edit saved standup' : 'Add standup'}</h2></div><button className="button secondary" type="button" onClick={addStandup} disabled={saving}>Add standup</button></div><p className="form-intro" role="status">{editing && selectedExisting ? `Editing ${selectedExisting.displayName} · ${selectedDate}. Saving replaces the tasks and blockers and records an audit event.` : !selectedMember && activeMembers.length > 0 && selectedPanel && selectedPanel.missingMembers.length === 0 && selectedPanel.submittedMembers.length > 0 ? `Everyone has submitted for ${selectedDate}. Choose an existing standup below to edit it; duplicate submissions are not allowed.` : 'Capture your progress and flag anything blocking you. Choose a member and date to add a new standup.'}</p>
            {!editing && selectedExisting && <div className="form-intro"><p>This member already has a standup for this date. Edit it, or choose another member or date to add a new one.</p><button className="button secondary" type="button" onClick={() => editStandup(selectedExisting)} disabled={saving}>Edit existing standup</button></div>}
            <form onSubmit={(event) => void submit(event)} noValidate>
              <div className="field"><label htmlFor="member">Team member</label><select id="member" value={selectedMember} onChange={(event) => { setEditing(false); setSelectedMember(event.target.value); setNotice(''); setError(''); }} disabled={saving} required><option value="">Choose your name</option>{activeMembers.map((member) => <option key={member.id} value={member.id}>{member.displayName} · {member.role}</option>)}</select></div>
              <div className="field"><label htmlFor="team-date">Standup date</label><select id="team-date" value={selectedDate} onChange={(event) => { setEditing(false); setSelectedDate(event.target.value); setNotice(''); setError(''); }} disabled={saving} required>{dashboard && <><option value={dashboard.teamDate}>Today · {dashboard.teamDate}</option><option value={dashboard.previousWorkingDay}>Previous working day · {dashboard.previousWorkingDay}</option></>}</select><span className="field-hint">You can update today or the previous working day. On Saturday, Sunday and Monday the previous working day is Friday.</span></div>
              <div className="field"><label htmlFor="tasks">What did you work on? <span className="required">*</span></label><textarea ref={tasksRef} id="tasks" value={tasks} onChange={(event) => setTasks(event.target.value)} placeholder={'One task per line\nExample: Review the onboarding flow'} rows={4} disabled={saving} required aria-describedby="tasks-hint"/><span id="tasks-hint" className="field-hint">One task per line · up to 20 tasks, 500 characters each</span></div>
              <div className="field"><label htmlFor="blockers">Any blockers? <span className="optional">Optional</span></label><textarea id="blockers" value={blockers} onChange={(event) => setBlockers(event.target.value)} placeholder="Anything slowing you down?" rows={2} disabled={saving}/><span className="field-hint">Up to 1,000 characters</span></div>
              <button className="button primary submit-button" type="submit" disabled={saving || !selectedDate || !selectedMember || (!editing && !!selectedExisting)}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Submit standup'} <span aria-hidden="true">→</span></button>
            </form>
          </section>
          <section className="panel previous-panel"><div className="panel-heading"><div><p className="eyebrow">TODAY’S UPDATES</p><h2>Standups &amp; blockers</h2></div><span className="date-chip subtle">{dashboard?.teamDate}</span></div>
            {todayPanel?.submittedMembers.length ? <div className="compact-list">{todayPanel.submittedMembers.map((standup) => <StandupCard key={standup.id} standup={standup} onEdit={saving ? undefined : editStandup}/>)}</div> : <p className="empty-state">No one has submitted a standup for today yet.</p>}
          </section>
          <section className="panel previous-panel" aria-labelledby="previous-heading"><div className="panel-heading"><div><p className="eyebrow">LAST WORKING DAY</p><h2 id="previous-heading">Previous working day</h2></div><span className="date-chip subtle">{dashboard?.previousWorkingDay}</span></div>
            <p className="form-intro">Correct a saved update with Edit standup, or choose this date in the form to submit a missing update.</p>
            {previousPanel?.submittedMembers.length ? <div className="compact-list">{previousPanel.submittedMembers.map((standup) => <StandupCard key={standup.id} standup={standup} onEdit={saving ? undefined : editStandup}/>)}</div> : <p className="empty-state">No previous-day updates yet.</p>}
            {!!previousPanel?.missingMembers.length && <><h3>Missing submissions</h3><ul>{previousPanel.missingMembers.map((member) => <li key={member.id}>{member.displayName} <span className="badge missing">Missing</span></li>)}</ul></>}
          </section>
        </div>}
      </> : <>
        <section className="page-heading"><div><p className="eyebrow">TEAM ARCHIVE <span>·</span> SEARCH &amp; REVIEW</p><h1>Standup history</h1><p className="subheading">Find a team update by date or member. Older entries are read-only.</p></div><button className="button secondary" onClick={() => void downloadExport(historyDate)} disabled={!historyDate}>Export selected day</button></section>
        <section className="panel history-panel"><form className="history-filters" onSubmit={(event) => void searchHistory(event)}><div className="field"><label htmlFor="history-date">Team date</label><input id="history-date" type="date" value={historyDate} onChange={(event) => { setHistoryDate(event.target.value); setHistory([]); setHistorySearched(false); }} required/></div><div className="field"><label htmlFor="history-member">Team member</label><select id="history-member" value={historyMember} onChange={(event) => { setHistoryMember(event.target.value); setHistory([]); setHistorySearched(false); }}><option value="">All members</option>{members.map((member) => <option key={member.id} value={member.id}>{member.displayName} · {member.role}{member.active ? '' : ' · inactive'}</option>)}</select></div><button className="button primary" type="submit">Search updates</button></form>
          {history.length ? <div className="history-results"><p className="result-summary">{history.length} {history.length === 1 ? 'update' : 'updates'} · {historyDate}</p>{history.map((standup) => <StandupCard key={standup.id} standup={standup}/>)}</div> : <div className="empty-history"><span className="empty-icon">⌕</span><h2>{historySearched ? 'No updates found' : 'Search your team history'}</h2><p>{historySearched ? `No updates were found for ${historyDate}${historyMember ? ` · ${members.find(({ id }) => id === historyMember)?.displayName ?? 'selected member'}` : ''}. Try another date or member.` : 'Choose a date and optional team member, then search to see saved updates. Weekend dates are available too.'}</p></div>}
        </section>
      </>}
    </main>
    <footer><span>Team standup service</span><span>Private by design <i>·</i> Local workspace</span></footer>
  </div>;
}
