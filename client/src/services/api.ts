export interface Member { id: string; displayName: string; role: 'member' | 'lead' | 'support'; active: boolean }
export interface Standup { id: string; memberId: string; displayName: string; teamDate: string; tasks: string[]; blockers: string; createdAtUtc: string; updatedAtUtc: string }
export interface Dashboard { teamDate: string; previousWorkingDay: string; panels: Array<{ teamDate: string; submittedMembers: Standup[]; missingMembers: Member[] }> }

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  } catch {
    throw new Error('Cannot reach the standup service. Make sure the local app is running, then try again.');
  }
  if (response.status === 304) throw new Error('The service returned a cached response. Refresh the page and try again.');
  if (response.status === 204) throw new Error('The service returned an empty response. Refresh the page and try again.');
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) throw new Error('The service returned an unexpected response. Refresh the page and try again.');
  const payload = await response.json() as { success: boolean; data?: T; error?: { message: string } };
  if (!response.ok || !payload.success || payload.data === undefined) throw new Error(payload.error?.message ?? 'The request could not be completed.');
  return payload.data;
}

export const api = {
  members: () => request<Member[]>('/api/v1/members'),
  dashboard: () => request<Dashboard>('/api/v1/dashboard'),
  history: (date: string, memberId: string) => request<{ teamDate: string; standups: Standup[] }>(`/api/v1/history?teamDate=${encodeURIComponent(date)}${memberId ? `&memberId=${encodeURIComponent(memberId)}` : ''}`),
  create: (value: { memberId: string; teamDate: string; tasks: string[]; blockers: string }) => request<Standup>('/api/v1/standups', { method: 'POST', body: JSON.stringify(value) }),
  update: (id: string, value: { tasks: string[]; blockers: string }) => request<Standup>(`/api/v1/standups/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(value) }),
  export: (date: string) => request<{ teamDate: string; markdown: string }>(`/api/v1/export/${encodeURIComponent(date)}`),
};
