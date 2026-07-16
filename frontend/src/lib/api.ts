import type {
  DocumentItem,
  DocumentListResponse,
  DocumentPreview,
  ChatSettings,
  ChatStreamEvent,
  ChatSession,
  SessionDetail,
  SessionListResponse,
  AdminLoginResponse,
  UserQuestionListResponse,
  ChatSource,
  AdminSettings,
  AdminSettingsUpdate,
  AdminStats,
  AdminSessionListResponse,
  AdminSessionDetail,
  ClearResponse,
  TestConnectionResult,
} from './types'

const API_BASE = import.meta.env.VITE_API_BASE || ''

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function getToken(): string | null {
  return localStorage.getItem('admin_token')
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  withAuth = false,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...((init.headers as Record<string, string>) || {}),
  }
  if (withAuth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }
  const resp = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new ApiError(text || `HTTP ${resp.status}`, resp.status)
  }
  const ct = resp.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    return (await resp.json()) as T
  }
  return undefined as unknown as T
}

// ============= 鉴权 =============
export async function adminLogin(password: string): Promise<AdminLoginResponse> {
  return request<AdminLoginResponse>('/api/auth/admin', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

// ============= 文档 =============
export async function listDocuments(): Promise<DocumentListResponse> {
  return request<DocumentListResponse>('/api/documents')
}

export async function uploadDocument(file: File): Promise<DocumentItem> {
  const form = new FormData()
  form.append('file', file)
  const token = getToken()
  const resp = await fetch(`${API_BASE}/api/documents/upload`, {
    method: 'POST',
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new ApiError(text || `HTTP ${resp.status}`, resp.status)
  }
  return (await resp.json()) as DocumentItem
}

export async function deleteDocument(id: number): Promise<void> {
  await request<{ message: string }>(`/api/documents/${id}`, { method: 'DELETE' }, true)
}

// ============= 会话 =============
export async function previewDocument(id: number): Promise<DocumentPreview> {
  return request<DocumentPreview>(`/api/documents/${id}/preview`, {}, true)
}

export async function listSessions(): Promise<SessionListResponse> {
  return request<SessionListResponse>('/api/chat/sessions')
}

export async function createSession(title?: string): Promise<ChatSession> {
  return request<ChatSession>('/api/chat/sessions', {
    method: 'POST',
    body: JSON.stringify({ title: title || '新对话' }),
  })
}

export async function getSession(id: number): Promise<SessionDetail> {
  return request<SessionDetail>(`/api/chat/sessions/${id}`)
}

export async function renameSession(id: number, title: string): Promise<ChatSession> {
  return request<ChatSession>(`/api/chat/sessions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  })
}

export async function deleteSession(id: number): Promise<void> {
  await request<{ message: string }>(`/api/chat/sessions/${id}`, { method: 'DELETE' })
}

// ============= 设置 =============
export async function getSettings(): Promise<ChatSettings> {
  return request<ChatSettings>('/api/settings')
}

// ============= 管理员：完整设置 =============
export async function getAdminSettings(): Promise<AdminSettings> {
  return request<AdminSettings>('/api/admin/settings', {}, true)
}

export async function updateAdminSettings(payload: AdminSettingsUpdate): Promise<AdminSettings> {
  return request<AdminSettings>(
    '/api/admin/settings',
    { method: 'PUT', body: JSON.stringify(payload) },
    true,
  )
}

export async function resetAdminSettings(): Promise<{ message: string; reset_keys: string[] }> {
  return request<{ message: string; reset_keys: string[] }>(
    '/api/admin/reset-settings',
    { method: 'POST' },
    true,
  )
}

export async function testLlmConnection(payload: {
  deepseek_api_key?: string | null
  deepseek_base_url?: string | null
  llm_model?: string | null
  embedding_base_url?: string | null
  embedding_api_key?: string | null
  embedding_model?: string | null
}): Promise<TestConnectionResult> {
  return request<TestConnectionResult>(
    '/api/admin/test-llm',
    { method: 'POST', body: JSON.stringify(payload) },
    true,
  )
}

// ============= 管理员：统计 =============
export async function getAdminStats(): Promise<AdminStats> {
  return request<AdminStats>('/api/admin/stats', {}, true)
}

// ============= 管理员：用户对话 =============
export async function adminListSessions(
  limit = 200,
  offset = 0,
): Promise<AdminSessionListResponse> {
  return request<AdminSessionListResponse>(
    `/api/admin/sessions?limit=${limit}&offset=${offset}`,
    {},
    true,
  )
}

export async function adminGetSession(id: number): Promise<AdminSessionDetail> {
  return request<AdminSessionDetail>(`/api/admin/sessions/${id}`, {}, true)
}

export async function adminDeleteSession(id: number): Promise<ClearResponse> {
  return request<ClearResponse>(
    `/api/admin/sessions/${id}`,
    { method: 'DELETE' },
    true,
  )
}

export async function adminClearSessions(): Promise<ClearResponse> {
  return request<ClearResponse>('/api/admin/sessions', { method: 'DELETE' }, true)
}

// ============= 管理员：用户提问摘要 =============
export async function listUserQuestions(): Promise<UserQuestionListResponse> {
  return request<UserQuestionListResponse>('/api/admin/questions', {}, true)
}

export async function loadSession(id: number): Promise<SessionDetail> {
  return request<SessionDetail>(`/api/chat/sessions/${id}`)
}

// ============= 问答流 =============
export async function* chatStream(
  question: string,
  sessionId: number | null,
  signal: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  const resp = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ question, session_id: sessionId }),
    signal,
  })
  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => '')
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[chatStream] HTTP', resp.status, text.slice(0, 200))
    }
    throw new ApiError(text || `HTTP ${resp.status}`, resp.status)
  }
  const reader = resp.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let chunkCount = 0

  const processBuffer = (raw: string, isFinal: boolean) => {
    // 解析 raw 里的完整事件（SSE 事件之间以 \n\n 或 \r\n\r\n 分隔 — 都兼容）
    // 同时去掉每行末尾的 \r，避免 regex 误匹配
    const normalized = raw.replace(/\r\n/g, '\n')
    const parts = normalized.split('\n\n')
    const tail = parts.pop() || ''
    const events: ChatStreamEvent[] = []
    for (const p of parts) {
      const m = p.match(/^data: ?(.+)$/m)
      if (!m) continue
      try {
        const ev = JSON.parse(m[1]) as ChatStreamEvent
        chunkCount++
        if (import.meta.env.DEV && ev.type === 'chunk') {
          // eslint-disable-next-line no-console
          console.debug('[chatStream] chunk:', JSON.stringify(ev.content ?? '').slice(0, 80))
        }
        if (import.meta.env.DEV && isFinal) {
          // eslint-disable-next-line no-console
          console.debug('[chatStream] flush, total so far:', chunkCount)
        }
        events.push(ev)
      } catch (e) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('[chatStream] malformed event:', m[1]?.slice(0, 80), e)
        }
      }
    }
    return { tail, events }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (value) {
      buf += dec.decode(value, { stream: true })
      const { tail, events } = processBuffer(buf, false)
      buf = tail
      for (const ev of events) yield ev
    }
    if (done) break
  }
  // 兜底：服务端最后一条事件可能没以换行结尾就关连接，把残留的也消费掉
  if (buf.trim()) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug('[chatStream] flushing tail, len=', buf.length)
    }
    const { events } = processBuffer(buf + '\n\n', true)
    for (const ev of events) yield ev
  }
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[chatStream] stream end, total events:', chunkCount)
  }
}

export { ApiError, type ChatSource }
