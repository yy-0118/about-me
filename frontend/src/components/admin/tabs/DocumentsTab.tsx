import React, { useEffect, useRef, useState } from 'react'
import { deleteDocument, listDocuments, previewDocument, updateDocumentContent, uploadDocument } from '../../../lib/api'
import type { DocumentItem, DocumentPreview } from '../../../lib/types'

interface Props {
  onChanged?: () => void
}

const fmtFileSize = (n: number) => {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

const fmtTime = (s: string) => {
  const d = new Date(s)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const FILE_ICONS: Record<string, string> = {
  pdf: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13h6 M9 17h4',
  docx: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13l2 2 4-4',
  doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13l2 2 4-4',
  md: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 15V9l2 2 2-2v6',
  txt: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13h6 M9 17h4',
}

export const DocumentsTab: React.FC<Props> = ({ onChanged }) => {
  const [docs, setDocs] = useState<DocumentItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [preview, setPreview] = useState<DocumentPreview | null>(null)
  const [previewLoadingId, setPreviewLoadingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = async () => {
    try {
      const resp = await listDocuments()
      setDocs(resp.items)
    } catch (e: any) {
      setError(e?.message || '加载失败')
    }
  }

  useEffect(() => {
    reload()
  }, [])

  const handleFile = async (file: File) => {
    setUploading(true)
    setError('')
    setSuccess('')
    try {
      await uploadDocument(file)
      setSuccess(`已上传 ${file.name}`)
      await reload()
      onChanged?.()
    } catch (e: any) {
      setError(e?.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('确认删除该文档？关联的向量索引也会被删除')) return
    setDeletingId(id)
    setError('')
    setSuccess('')
    try {
      await deleteDocument(id)
      setDocs((items) => items.filter((item) => item.id !== id))
      setPreview((current) => (current?.id === id ? null : current))
      setSuccess('文档已删除')
      await reload()
      onChanged?.()
    } catch (e: any) {
      setError(e?.message || '删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  const handleEdit = async (id: number) => {
    setEditingId(id)
    setEditContent('')
    setEditLoading(true)
    setError('')
    setSuccess('')
    try {
      const resp = await previewDocument(id)
      setEditContent(resp.content)
    } catch (e: any) {
      setError(e?.message || '加载文档内容失败')
      setEditingId(null)
    } finally {
      setEditLoading(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editContent.trim()) return
    setSavingEdit(true)
    setError('')
    setSuccess('')
    try {
      await updateDocumentContent(editingId, editContent)
      setSuccess('文档内容已更新，已重新索引')
      setEditingId(null)
      setEditContent('')
      await reload()
      onChanged?.()
    } catch (e: any) {
      setError(e?.message || '保存失败')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleCancelEdit = () => {
    if (editContent && !window.confirm('放弃编辑？未保存的内容将丢失')) return
    setEditingId(null)
    setEditContent('')
  }

  const handlePreview = async (id: number) => {
    setPreviewLoadingId(id)
    setError('')
    setSuccess('')
    try {
      const resp = await previewDocument(id)
      setPreview(resp)
    } catch (e: any) {
      setError(e?.message || '预览失败')
    } finally {
      setPreviewLoadingId(null)
    }
  }

  return (
    <div className="admin-tab">
      <div className="admin-tab__head">
        <div>
          <h2 className="admin-tab__title">文档管理</h2>
          <p className="admin-tab__subtitle">上传、删除知识库文档；上传时会自动分块并生成向量</p>
        </div>
      </div>

      {error && <div className="admin-error">⚠ {error}</div>}
      {success && <div className="admin-success">✓ {success}</div>}

      <div
        className={`doc-upload ${dragOver ? 'doc-upload--over' : ''}`}
        style={{ marginBottom: 20 }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const f = e.dataTransfer.files?.[0]
          if (f) handleFile(f)
        }}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          hidden
          accept=".pdf,.md,.txt,.docx"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.target.value = ''
          }}
        />
        <div className="doc-upload__icon">
          {uploading ? (
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          )}
        </div>
        <div className="doc-upload__title">{uploading ? '正在处理…' : '拖拽文件到此处，或点击选择'}</div>
        <div className="doc-upload__hint">支持 PDF / DOCX / MD / TXT · 单文件 ≤ 20MB</div>
      </div>

      <div className="admin-card">
        <div className="admin-card__head">
          <div className="admin-card__head-l">
            <div className="admin-card__head-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div>
              <h3 className="admin-card__title">已上传文档</h3>
              <p className="admin-card__hint">共 {docs.length} 个</p>
            </div>
          </div>
          <button className="admin-btn admin-btn--ghost" onClick={reload}>
            刷新列表
          </button>
        </div>

        <div className="doc-list">
          {docs.length === 0 && <div className="doc-list__empty">暂无文档，请上传第一个文档开始</div>}
          {docs.map((d) => {
            const iconPath = FILE_ICONS[d.file_type] || FILE_ICONS.txt
            return (
              <div key={d.id} className="doc-item">
                <div className="doc-item__icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={iconPath} />
                  </svg>
                </div>
                <div className="doc-item__info">
                  <div className="doc-item__name">{d.filename}</div>
                  <div className="doc-item__meta">
                    <span>{fmtFileSize(d.file_size)}</span>
                    <span className="doc-item__meta-dot" />
                    <span>{d.chunk_count} 块</span>
                    <span className="doc-item__meta-dot" />
                    <span>{d.file_type.toUpperCase()}</span>
                    <span className="doc-item__meta-dot" />
                    <span>{fmtTime(d.created_at)}</span>
                  </div>
                </div>
                <div className="doc-item__actions">
                  <button
                    className="doc-item__preview"
                    onClick={() => handlePreview(d.id)}
                    disabled={previewLoadingId === d.id}
                  >
                    {previewLoadingId === d.id ? '加载中' : '预览'}
                  </button>
                  <button
                    className="doc-item__edit"
                    onClick={() => handleEdit(d.id)}
                    disabled={editingId === d.id}
                  >
                    {editingId === d.id ? '编辑中' : '编辑'}
                  </button>
                  <button
                    className="doc-item__del"
                    onClick={() => handleDelete(d.id)}
                    disabled={deletingId === d.id}
                  >
                    {deletingId === d.id ? '删除中' : '删除'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {preview && (
        <div className="doc-preview" role="dialog" aria-modal="true" aria-label="文档预览">
          <div className="doc-preview__panel">
            <div className="doc-preview__head">
              <div className="doc-preview__title-wrap">
                <div className="doc-preview__eyebrow">{preview.file_type.toUpperCase()} 预览</div>
                <h3 className="doc-preview__title">{preview.filename}</h3>
              </div>
              <button
                className="doc-preview__close"
                onClick={() => setPreview(null)}
                aria-label="关闭预览"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <pre className="doc-preview__content">
              {preview.content.trim() || '该文档暂未解析出可预览文本。'}
            </pre>
          </div>
        </div>
      )}

      {editingId && (
        <div className="doc-preview" role="dialog" aria-modal="true" aria-label="文档编辑">
          <div className="doc-preview__panel doc-preview__panel--edit">
            <div className="doc-preview__head">
              <div className="doc-preview__title-wrap">
                <div className="doc-preview__eyebrow">编辑文档</div>
                <h3 className="doc-preview__title">{docs.find((d) => d.id === editingId)?.filename || ''}</h3>
              </div>
              <button className="doc-preview__close" onClick={handleCancelEdit} aria-label="关闭编辑">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            {editLoading ? (
              <div className="doc-preview__loading">加载中…</div>
            ) : (
              <textarea
                className="doc-preview__editor"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="在此编辑文档内容…"
              />
            )}
            {!editLoading && (
              <div className="doc-preview__actions">
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {editContent.length} 字 · 保存后会自动重新分块并生成向量
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="admin-btn" onClick={handleCancelEdit} disabled={savingEdit}>
                    取消
                  </button>
                  <button
                    className="admin-btn admin-btn--primary"
                    onClick={handleSaveEdit}
                    disabled={savingEdit || !editContent.trim()}
                  >
                    {savingEdit ? '保存中…' : '保存修改'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
