import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.js';
import { api, type Member, type Standup } from '../services/api.js';

const roster: Member[] = [{ id: 'member-01', displayName: 'Member 01', role: 'member', active: true }];
const dashboard = { teamDate: '2026-10-17', previousWorkingDay: '2026-10-16', panels: [
  { teamDate: '2026-10-17', submittedMembers: [], missingMembers: roster },
  { teamDate: '2026-10-16', submittedMembers: [], missingMembers: roster },
] };
afterEach(() => vi.restoreAllMocks());

const previousRecord: Standup = { id: 'previous-id', memberId: 'member-01', displayName: 'Member 01', teamDate: '2026-10-16', tasks: ['Previous-day saved task'], blockers: 'Original blocker', createdAtUtc: '2026-10-16T06:00:00.000Z', updatedAtUtc: '2026-10-16T06:00:00.000Z' };
function mockDashboard(today = dashboard.teamDate, record?: Standup) {
  vi.spyOn(api, 'members').mockResolvedValue(roster as Awaited<ReturnType<typeof api.members>>);
  vi.spyOn(api, 'dashboard').mockResolvedValue({ ...dashboard, teamDate: today, panels: [
    { teamDate: today, submittedMembers: [], missingMembers: roster as Awaited<ReturnType<typeof api.members>> },
    { teamDate: dashboard.previousWorkingDay, submittedMembers: record ? [record] : [], missingMembers: record ? [] : roster as Awaited<ReturnType<typeof api.members>> },
  ] });
}

describe('standup UI', () => {
  it('renders labelled fields and missing-member dashboard', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => new Response(JSON.stringify({ success: true, data: String(input).includes('/members') ? roster : dashboard }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Today’s standup' })).toBeInTheDocument();
    expect(screen.getByLabelText(/What did you work on/)).toBeInTheDocument();
    expect(screen.getByText('Awaiting update')).toBeInTheDocument();
  });
  it('renders submitted task content for both today and the previous working day', async () => {
    const todayRecord = { id: 'today-id', memberId: 'member-01', displayName: 'Member 01', teamDate: '2026-10-17', tasks: ['Today synthetic work'], blockers: 'Waiting on review', createdAtUtc: '', updatedAtUtc: '' };
    const previousRecord = { ...todayRecord, id: 'previous-id', teamDate: '2026-10-16', tasks: ['Previous-day synthetic work'], blockers: '' };
    const withSubmissions = { ...dashboard, panels: [
      { teamDate: '2026-10-17', submittedMembers: [todayRecord], missingMembers: [] },
      { teamDate: '2026-10-16', submittedMembers: [previousRecord], missingMembers: [] },
    ] };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => new Response(JSON.stringify({ success: true, data: String(input).includes('/members') ? roster : withSubmissions }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    render(<App />);
    expect(await screen.findByText('Today synthetic work')).toBeInTheDocument();
    expect(screen.getByText('Previous-day synthetic work')).toBeInTheDocument();
    expect(screen.getByText('Waiting on review')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add standup' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Team member/)).toHaveValue('');
    expect(screen.getByLabelText(/What did you work on/)).toHaveValue('');
  });
  it('explains why a new submission is unavailable when everyone has already submitted', async () => {
    mockDashboard();
    const todayRecord = { ...previousRecord, id: 'today-id', teamDate: dashboard.teamDate };
    vi.mocked(api.dashboard).mockResolvedValue({ ...dashboard, panels: [
      { teamDate: dashboard.teamDate, submittedMembers: [todayRecord], missingMembers: [] },
      dashboard.panels[1]!,
    ] });
    render(<App />);
    await screen.findByRole('heading', { name: 'Add standup' });
    expect(screen.getByRole('status')).toHaveTextContent('Everyone has submitted for 2026-10-17');
    expect(screen.getByRole('button', { name: /Submit standup/ })).toBeDisabled();
  });
  it('shows accessible validation error without submitting empty tasks', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => new Response(JSON.stringify({ success: true, data: String(input).includes('/members') ? roster : dashboard }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    render(<App />);
    await screen.findByRole('heading', { name: 'Today’s standup' });
    fireEvent.click(screen.getByRole('button', { name: /submit standup/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Enter at least one task'));
  });

  it('starts in Add mode for a missing member even when the first member has submitted', async () => {
    mockDashboard();
    const missingMember = { ...roster[0]!, id: 'member-02', displayName: 'Member 02' };
    const todayRecord = { ...previousRecord, id: 'today-id', teamDate: dashboard.teamDate };
    vi.mocked(api.members).mockResolvedValue([...roster, missingMember] as Awaited<ReturnType<typeof api.members>>);
    vi.mocked(api.dashboard).mockResolvedValue({ ...dashboard, panels: [
      { teamDate: dashboard.teamDate, submittedMembers: [todayRecord], missingMembers: [missingMember] as Awaited<ReturnType<typeof api.members>> },
      dashboard.panels[1]!,
    ] });
    const create = vi.spyOn(api, 'create').mockResolvedValue({ ...todayRecord, id: 'new-id', memberId: missingMember.id, displayName: missingMember.displayName, tasks: ['New task'], blockers: '' });
    const update = vi.spyOn(api, 'update');
    render(<App />);
    await screen.findByRole('heading', { name: 'Add standup' });
    expect(screen.getByLabelText('Team member')).toHaveValue('member-02');
    expect(screen.getByLabelText(/What did you work on/)).toHaveValue('');
    fireEvent.change(screen.getByLabelText(/What did you work on/), { target: { value: 'New task' } });
    fireEvent.click(screen.getByRole('button', { name: /Submit standup/ }));
    await screen.findByText(/Standup submitted for Member 02/);
    expect(create).toHaveBeenCalledWith({ memberId: 'member-02', teamDate: dashboard.teamDate, tasks: ['New task'], blockers: '' });
    expect(update).not.toHaveBeenCalled();
  });

  it('requires an explicit Edit action for an existing member and date', async () => {
    mockDashboard(dashboard.teamDate, previousRecord);
    const create = vi.spyOn(api, 'create');
    const update = vi.spyOn(api, 'update');
    render(<App />);
    await screen.findByRole('heading', { name: 'Add standup' });
    fireEvent.change(screen.getByLabelText(/Standup date/), { target: { value: previousRecord.teamDate } });
    expect(screen.getByRole('heading', { name: 'Add standup' })).toBeInTheDocument();
    expect(screen.getByLabelText(/What did you work on/)).toHaveValue('');
    expect(screen.getByRole('button', { name: /Submit standup/ })).toBeDisabled();
    fireEvent.submit(screen.getByRole('button', { name: /Submit standup/ }).closest('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent('already has a standup');
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Edit existing standup' }));
    expect(screen.getByRole('heading', { name: 'Edit saved standup' })).toBeInTheDocument();
    expect(screen.getByLabelText(/What did you work on/)).toHaveValue('Previous-day saved task');
  });

  it('returns from Edit to a blank Add form using Add standup', async () => {
    mockDashboard(dashboard.teamDate, previousRecord);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Member 01 standup for 2026-10-16' }));
    fireEvent.change(screen.getByLabelText(/What did you work on/), { target: { value: 'Unsaved correction' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add standup' }));
    expect(screen.getByRole('heading', { name: 'Add standup' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Standup date/)).toHaveValue(dashboard.teamDate);
    expect(screen.getByLabelText(/What did you work on/)).toHaveValue('');
    expect(screen.getByLabelText(/Any blockers/)).toHaveValue('');
    expect(screen.getByLabelText(/What did you work on/)).toHaveFocus();
    expect(screen.getByRole('button', { name: /Submit standup/ })).toBeEnabled();
  });
  it('uses shared content limits in the form before sending a request', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => new Response(JSON.stringify({ success: true, data: String(input).includes('/members') ? roster : dashboard }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    render(<App />);
    await waitFor(() => expect(screen.getByLabelText(/Standup date/)).toHaveValue('2026-10-17'));
    fireEvent.change(screen.getByLabelText(/What did you work on/), { target: { value: 'x'.repeat(501) } });
    fireEvent.click(screen.getByRole('button', { name: /submit standup/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Must be at most 500 characters'));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('opens history and shows an empty state', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const data = url.includes('/members') ? roster : url.includes('/dashboard') ? dashboard : { teamDate: '2026-10-17', standups: [] };
      return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'History' }));
    expect(screen.getByText('Search your team history')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Search updates' }));
    expect(await screen.findByText('No updates found')).toBeInTheDocument();
    expect(screen.getByText(/No updates were found for 2026-10-17/)).toBeInTheDocument();
  });
  it('shows actionable guidance and retries a failed History request', async () => {
    let failHistoryOnce = true;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/history') && failHistoryOnce) {
        failHistoryOnce = false;
        throw new TypeError('Failed to fetch');
      }
      const data = url.includes('/members') ? roster : url.includes('/dashboard') ? dashboard : { teamDate: '2026-10-17', standups: [] };
      return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'History' }));
    fireEvent.click(screen.getByRole('button', { name: 'Search updates' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the standup service');
    fireEvent.click(screen.getByRole('button', { name: 'Retry request' }));
    expect(await screen.findByText('No updates found')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each(['2026-10-17', '2026-10-18', '2026-10-19'])('corrects Friday from the dashboard on %s without switching back to today', async (today) => {
    mockDashboard(today, previousRecord);
    const saved = { ...previousRecord, tasks: ['Corrected Friday task'], blockers: 'Corrected blocker' };
    const update = vi.spyOn(api, 'update').mockResolvedValue(saved);
    const create = vi.spyOn(api, 'create');
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Edit Member 01 standup for 2026-10-16' }));
    expect(screen.getByRole('heading', { name: 'Edit saved standup' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Standup date/)).toHaveValue('2026-10-16');
    expect(screen.getByLabelText(/What did you work on/)).toHaveFocus();
    expect(screen.getByLabelText(/What did you work on/)).toHaveValue('Previous-day saved task');
    await user.clear(screen.getByLabelText(/What did you work on/));
    await user.type(screen.getByLabelText(/What did you work on/), 'Corrected Friday task');
    await user.clear(screen.getByLabelText(/Any blockers/));
    await user.type(screen.getByLabelText(/Any blockers/), 'Corrected blocker');
    vi.mocked(api.dashboard).mockResolvedValue({ ...dashboard, teamDate: today, panels: [
      { teamDate: today, submittedMembers: [], missingMembers: roster as Awaited<ReturnType<typeof api.members>> },
      { teamDate: '2026-10-16', submittedMembers: [saved], missingMembers: [] },
    ] });
    await user.click(screen.getByRole('button', { name: /Save changes/ }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('previous-id', { tasks: ['Corrected Friday task'], blockers: 'Corrected blocker' }));
    expect(create).not.toHaveBeenCalled();
    expect(await screen.findByText(/Standup updated for Member 01 on 2026-10-16/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Standup date/)).toHaveValue('2026-10-16');
    expect(screen.getByLabelText(/What did you work on/)).toHaveValue('Corrected Friday task');
    expect(screen.getByText('Corrected Friday task', { selector: 'li' })).toBeInTheDocument();
  });

  it('submits a missing previous-day entry using POST and keeps the chosen date', async () => {
    mockDashboard();
    const create = vi.spyOn(api, 'create').mockResolvedValue(previousRecord);
    const update = vi.spyOn(api, 'update');
    render(<App />);
    await screen.findByRole('heading', { name: 'Missing submissions' });
    fireEvent.change(screen.getByLabelText(/Standup date/), { target: { value: '2026-10-16' } });
    fireEvent.change(screen.getByLabelText(/What did you work on/), { target: { value: 'Previous-day saved task' } });
    fireEvent.change(screen.getByLabelText(/Any blockers/), { target: { value: 'Original blocker' } });
    vi.mocked(api.dashboard).mockRejectedValue(new Error('Refresh unavailable'));
    fireEvent.click(screen.getByRole('button', { name: /Submit standup/ }));
    expect(await screen.findByText(/Standup submitted for Member 01 on 2026-10-16/)).toBeInTheDocument();
    expect(create).toHaveBeenCalledWith({ memberId: 'member-01', teamDate: '2026-10-16', tasks: ['Previous-day saved task'], blockers: 'Original blocker' });
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Standup date/)).toHaveValue('2026-10-16');
    expect(screen.getByRole('alert')).toHaveTextContent('Your standup was saved, but the dashboard could not refresh.');
    expect(screen.getByRole('button', { name: /Save changes/ })).toBeInTheDocument();
  });

  it('retains the correction draft when the server rejects a save', async () => {
    mockDashboard('2026-10-19', previousRecord);
    vi.spyOn(api, 'update').mockRejectedValue(new Error('Writes are accepted only for today or the previous working day.'));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Member 01 standup for 2026-10-16' }));
    fireEvent.change(screen.getByLabelText(/What did you work on/), { target: { value: 'Unsaved correction' } });
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Writes are accepted only');
    expect(screen.getByLabelText(/What did you work on/)).toHaveValue('Unsaved correction');
    expect(screen.getByLabelText(/Standup date/)).toHaveValue('2026-10-16');
    expect(screen.queryByText(/Standup updated for/)).not.toBeInTheDocument();
  });

  it('clears a previous-day draft when switching to a missing today entry', async () => {
    mockDashboard('2026-10-19', previousRecord);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Member 01 standup for 2026-10-16' }));
    fireEvent.change(screen.getByLabelText(/Standup date/), { target: { value: '2026-10-19' } });
    expect(screen.getByLabelText(/What did you work on/)).toHaveValue('');
    expect(screen.getByLabelText(/Any blockers/)).toHaveValue('');
    expect(screen.getByRole('button', { name: /Submit standup/ })).toBeInTheDocument();
  });

  it('prevents a second save while a correction is in flight', async () => {
    mockDashboard('2026-10-19', previousRecord);
    let resolveSave!: (value: Standup) => void;
    const update = vi.spyOn(api, 'update').mockImplementation(() => new Promise((resolve) => { resolveSave = resolve; }));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Member 01 standup for 2026-10-16' }));
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }));
    expect(screen.getByRole('button', { name: /Saving/ })).toBeDisabled();
    fireEvent.submit(screen.getByRole('button', { name: /Saving/ }).closest('form')!);
    expect(update).toHaveBeenCalledTimes(1);
    resolveSave(previousRecord);
    await screen.findByText(/Standup updated for Member 01/);
  });

  it('exports an arbitrary History date and allows filtering retained inactive members', async () => {
    mockDashboard();
    vi.mocked(api.members).mockResolvedValue([...roster as Awaited<ReturnType<typeof api.members>>, { id: 'retired-01', displayName: 'Retired Synthetic Member', role: 'member', active: false }]);
    const history = vi.spyOn(api, 'history').mockResolvedValue({ teamDate: '2025-01-01', standups: [] });
    const exportDay = vi.spyOn(api, 'export').mockRejectedValue(new Error('Synthetic export response'));
    render(<App />);
    await screen.findByRole('heading', { name: 'Missing submissions' });
    expect(screen.queryByRole('option', { name: /Retired Synthetic Member/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    expect(screen.getByRole('option', { name: /Retired Synthetic Member.*inactive/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Team date'), { target: { value: '2025-01-01' } });
    fireEvent.change(screen.getByLabelText('Team member'), { target: { value: 'retired-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search updates' }));
    await screen.findByText('No updates found');
    expect(history).toHaveBeenCalledWith('2025-01-01', 'retired-01');
    fireEvent.click(screen.getByRole('button', { name: 'Export selected day' }));
    await waitFor(() => expect(exportDay).toHaveBeenCalledWith('2025-01-01'));
    await screen.findByRole('alert');
  });
});
