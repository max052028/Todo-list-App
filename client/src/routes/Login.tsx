import { FormEvent, useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { fetchWithCreds, headers } from '../lib/api'

export default function Login() {
  const [mode, setMode] = useState<'login'|'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()
  const googleDivRef = useRef<HTMLDivElement>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
    const res = await fetchWithCreds(path, { method: 'POST', headers: headers(), body: JSON.stringify({ email, password, name }) })
    if (!res.ok) {
      const err = await res.json().catch(()=>({error:'Failed'}))
      setError(err.error || 'Failed')
      return
    }
  window.dispatchEvent(new Event('auth:changed'))
  nav('/')
  }

  // Google Identity Services button
  useEffect(() => {
    const boot = async () => {
      let clientId = (window as any).__GOOGLE_CLIENT_ID || ''
      if (!clientId) {
        try {
          const r = await fetch('/api/auth/config')
          const j = await r.json()
          clientId = j.googleClientId || ''
          ;(window as any).__GOOGLE_CLIENT_ID = clientId
        } catch {}
      }
      if (!clientId || !googleDivRef.current) return
      // @ts-ignore
      if (typeof window.google === 'undefined' || !window.google.accounts) {
        const s = document.createElement('script')
        s.src = 'https://accounts.google.com/gsi/client'
        s.async = true
        s.defer = true
        s.onload = () => initGsi(clientId)
        document.head.appendChild(s)
      } else {
        initGsi(clientId)
      }
      function initGsi(cid: string) {
        // @ts-ignore
        window.google.accounts.id.initialize({
          client_id: cid,
          ux_mode: 'popup', // 強制使用 popup，避免 redirect 模式
          auto_select: false,
          callback: async (resp: any) => {
            try {
              if (!resp || !resp.credential) {
                console.error('Google callback without credential', resp)
                setError('Google 登入失敗（未取得憑證）')
                return
              }
              const idToken = resp.credential
              const r = await fetchWithCreds('/api/auth/google', { method: 'POST', headers: headers(), body: JSON.stringify({ idToken }) })
              if (r.ok) {
                window.dispatchEvent(new Event('auth:changed'))
                nav('/')
              } else {
                const j = await r.json().catch(() => ({} as any))
                console.error('Google auth failed', j)
                setError(j.error || 'Google 登入失敗')
              }
            } catch (e) {
              console.error('Google callback error', e)
              setError('Google 登入失敗（例外）')
            }
          }
        })
        // @ts-ignore
        window.google.accounts.id.renderButton(googleDivRef.current, { theme: 'outline', size: 'large' })
      }
    }
    boot()
  }, [])

  return (
    <main style={{ maxWidth: 420 }}>
      <h2>{mode === 'login' ? '登入' : '註冊'}</h2>
      {error && <div style={{ color: '#991b1b', background: '#fee2e2', padding: 8, borderRadius: 6, marginBottom: 8 }}>{error}</div>}
      <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
        {mode === 'register' && (
          <input placeholder="姓名 (可選)" value={name} onChange={e=>setName(e.target.value)} />
        )}
        <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />
        <button type="submit">{mode === 'login' ? '登入' : '註冊'}</button>
      </form>
      <div style={{ height: 12 }} />
      <div ref={googleDivRef} />
      <div style={{ height: 12 }} />
      <div>
        {mode === 'login' ? (
          <button onClick={()=>setMode('register')}>沒有帳號？前往註冊</button>
        ) : (
          <button onClick={()=>setMode('login')}>已有帳號？前往登入</button>
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        <Link to="/">返回</Link>
      </div>
    </main>
  )
}
