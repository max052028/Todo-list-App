import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchWithCreds, headers } from '../lib/api'

type Profile = {
  id: string
  email: string
  name: string
  avatar: string | null
  gender: 'male' | 'female' | 'other' | null
  birthday: string | null // YYYY-MM-DD
  hasPassword: boolean
}

export default function Profile() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pwdSaving, setPwdSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [p, setP] = useState<Profile | null>(null)
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const nav = useNavigate()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetchWithCreds('/api/users/me', { headers: headers() })
        if (res.status === 401) { nav('/login'); return }
        const j = await res.json()
        setP(j)
      } catch (e) {
        setError('載入失敗')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [nav])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!p) return
    setSaving(true)
    setMsg(null)
    setError(null)
    try {
      const payload = { name: p.name, avatar: p.avatar, gender: p.gender, birthday: p.birthday }
      const res = await fetchWithCreds('/api/users/me', { method: 'PATCH', headers: headers(), body: JSON.stringify(payload) })
      const j = await res.json().catch(()=>({}))
      if (!('id' in (j||{}))) {
        setError((j as any).error || '儲存失敗')
      } else {
        setMsg('已更新')
        // 通知全域重新載入使用者資訊（更新頭像 / 名稱）
        window.dispatchEvent(new Event('auth:changed'))
      }
    } catch (e) {
      setError('儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (!p) return
    setPwdSaving(true)
    setMsg(null)
    setError(null)
    if (newPwd.length < 8) { setError('新密碼至少 8 碼'); setPwdSaving(false); return }
    if (newPwd !== confirmPwd) { setError('兩次新密碼不一致'); setPwdSaving(false); return }
    try {
      const res = await fetchWithCreds('/api/users/me/password', { method: 'PATCH', headers: headers(), body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }) })
      if (!res.ok) {
        const j = await res.json().catch(()=>({}))
        setError((j as any).error || '變更密碼失敗')
      } else {
        setMsg('密碼已更新')
        setOldPwd(''); setNewPwd(''); setConfirmPwd('')
      }
    } catch (e) {
      setError('變更密碼失敗')
    } finally {
      setPwdSaving(false)
    }
  }

  if (loading) return <div>載入中…</div>
  if (error && !p) return <div style={{ color: '#b91c1c' }}>{error}</div>
  if (!p) return null

  return (
    <div style={{ maxWidth: 640, display: 'grid', gap: 16 }}>
      <h2>編輯個人檔案</h2>
      {msg && <div style={{ background: '#ecfeff', color: '#0e7490', padding: 8, borderRadius: 8 }}>{msg}</div>}
      {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 8, borderRadius: 8 }}>{error}</div>}

      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <AvatarWithUpload avatar={p.avatar} name={p.name || p.email} onUploaded={(url)=>{ setP({ ...(p as Profile), avatar: url }); window.dispatchEvent(new Event('auth:changed')) }} />
        <div style={{ fontSize: 12, color: '#6b7280' }}>{p.email}</div>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>姓名</span>
          <input value={p.name} onChange={e=>setP({ ...(p as Profile), name: e.target.value })} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>性別（可選）</span>
          <select value={p.gender ?? ''} onChange={e=>setP({ ...(p as Profile), gender: (e.target.value || null) as any })}>
            <option value="">未設定</option>
            <option value="male">男</option>
            <option value="female">女</option>
            <option value="other">其他</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>生日（可選）</span>
          <input type="date" value={p.birthday ?? ''} onChange={e=>setP({ ...(p as Profile), birthday: e.target.value || null })} />
        </label>
        <div>
          <button type="submit" disabled={saving}>{saving ? '儲存中…' : '儲存'}</button>
        </div>
      </form>

      <section style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
        <h3>變更密碼</h3>
        {!p.hasPassword && (
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>此帳號尚未設定密碼，無法變更。</div>
        )}
        <form onSubmit={changePassword} style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
          <input type="password" placeholder="舊密碼" value={oldPwd} onChange={e=>setOldPwd(e.target.value)} disabled={!p.hasPassword} required />
          <input type="password" placeholder="新密碼（至少 8 碼）" value={newPwd} onChange={e=>setNewPwd(e.target.value)} disabled={!p.hasPassword} required />
          <input type="password" placeholder="再次輸入新密碼" value={confirmPwd} onChange={e=>setConfirmPwd(e.target.value)} disabled={!p.hasPassword} required />
          <div>
            <button type="submit" disabled={!p.hasPassword || pwdSaving}>{pwdSaving ? '儲存中…' : '更新密碼'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

function Avatar({ src, name, size=28 }: { src?: string | null, name?: string, size?: number }) {
  const fallback = (name || '?').trim()
  const initials = fallback ? fallback[0]?.toUpperCase() : '?'
  if (src) return <img src={src} alt="avatar" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '1px solid #e5e7eb' }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#e5e7eb', color: '#374151', fontWeight: 700, fontSize: size*0.45, border: '1px solid #d1d5db' }}>
      {initials}
    </div>
  )
}

function AvatarWithUpload({ avatar, name, onUploaded }: { avatar: string | null, name?: string, onUploaded: (url: string) => void }) {
  const [busy, setBusy] = useState(false)
  const inputId = 'file-' + Math.random().toString(36).slice(2,8)
  const pick = async (file: File) => {
    if (!file) return
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/api/users/me/avatar', { method: 'POST', body: fd, credentials: 'include' })
      if (!r.ok) {
        const j = await r.json().catch(()=>({}))
        alert((j as any).error || '上傳失敗')
        return
      }
      const j = await r.json()
      const url = j.clientUrl || j.url
      onUploaded(url)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div style={{ position: 'relative', width: 80, height: 80 }}>
      <Avatar src={avatar ? (avatar.startsWith('/uploads') ? `/api${avatar}` : avatar) : null} name={name} size={80} />
      <label htmlFor={inputId} title={busy ? '上傳中…' : '變更頭像'} style={{ position: 'absolute', right: -6, bottom: -6, width: 28, height: 28, borderRadius: '50%', background: '#111827', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: busy ? 'progress' : 'pointer', border: '2px solid #fff', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          <path fill="#fff" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
        </svg>
      </label>
      <input id={inputId} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e)=>{ const f = e.target.files?.[0]; if (f) pick(f); e.currentTarget.value = '' }} />
    </div>
  )
}

// no external assets needed; using inline SVG for pencil icon
