export interface DocumentItem {
  id: number
  filename: string
  file_size: number
  file_type: string
  chunk_count: number
  created_at: string
}

export interface DocumentListResponse {
  total: number
  items: DocumentItem[]
}

export interface DocumentPreview {
  id: number
  filename: string
  file_type: string
  content: string
}

export interface DocumentContentUpdate {
  content: string
}

export interface ChatSource {
  document_name: string
  chunk_text: string
  score: number
}

export interface Message {
  id?: number | string
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[] | null
  streaming?: boolean
  created_at?: string
}

export interface ChatSession {
  id: number
  title: string
  created_at: string
  updated_at: string
}

export interface SessionDetail extends ChatSession {
  messages: Message[]
}

export interface SessionListResponse {
  total: number
  items: ChatSession[]
}

export interface ChatSettings {
  temperature: number
  top_k: number
  llm_model: string
  system_prompt: string
}

export interface ChatStreamEvent {
  type: 'chunk' | 'sources' | 'done' | 'error'
  content?: string
  sources?: ChatSource[]
}

export interface AdminLoginResponse {
  token: string
  expires_at: string
}

export interface UserQuestion {
  id: number
  session_id: number
  session_title: string
  content: string
  created_at: string
}

export interface UserQuestionListResponse {
  total: number
  items: UserQuestion[]
}

// ============= 管理员后端 =============
export interface AdminSettings {
  deepseek_api_key_masked: string
  deepseek_api_key_set: boolean
  deepseek_base_url: string
  llm_model: string
  embedding_base_url: string
  embedding_api_key_masked: string
  embedding_api_key_set: boolean
  embedding_use_llm_credentials: boolean
  embedding_model: string
  temperature: number
  top_k: number
  system_prompt: string
  ai_style: string
}

export interface AdminSettingsUpdate {
  deepseek_api_key?: string | null
  deepseek_base_url: string
  llm_model: string
  embedding_base_url: string
  embedding_api_key?: string | null
  embedding_model: string
  temperature: number
  top_k: number
  system_prompt: string
  ai_style: string
}

export interface AdminStats {
  documents: number
  chunks: number
  sessions: number
  messages: number
  user_messages: number
  assistant_messages: number
  latest_document_at: string | null
  latest_session_at: string | null
}

export interface AdminSessionItem {
  id: number
  title: string
  created_at: string
  updated_at: string
  message_count: number
  user_message_count: number
}

export interface AdminSessionListResponse {
  total: number
  items: AdminSessionItem[]
}

export interface AdminMessageItem {
  id: number
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[] | null
  created_at: string
}

export interface AdminSessionDetail {
  id: number
  title: string
  created_at: string
  updated_at: string
  messages: AdminMessageItem[]
}

export interface ClearResponse {
  message: string
  deleted_sessions: number
}

export interface TestConnectionResult {
  ok: boolean
  llm?: { ok: boolean; error?: string }
  embedding?: { ok: boolean; error?: string }
}

export type AiStyle = 'professional' | 'friendly' | 'concise' | 'detailed' | 'free'

export const AI_STYLE_OPTIONS: { value: AiStyle; label: string; hint: string }[] = [
  { value: 'professional', label: '专业严谨', hint: '适合文档知识库、企业知识' },
  { value: 'friendly', label: '友善亲切', hint: '适合个人助理、闲聊' },
  { value: 'concise', label: '简洁明了', hint: '直答要点，篇幅短' },
  { value: 'detailed', label: '详细展开', hint: '补充背景、举例说明' },
  { value: 'free', label: '不指定', hint: '沿用 system_prompt 的语气' },
]
