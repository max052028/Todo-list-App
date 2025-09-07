import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { headers, fetchWithCreds } from '../lib/api'

export default function Join() {
  const { token } = useParams()
  const [status, setStatus] = useState<'idle'|'ok'|'error'>('idle')

  useEffect(() => {
    const run = async () => {
  const res = await fetchWithCreds(`/api/join/${token}`, { method: 'POST', headers: headers() })
      setStatus(res.ok ? 'ok' : 'error')
    }
    run()
  }, [token])

  return (
    <main>
      <h2>Join</h2>
      {status==='idle' && <p>Joining...</p>}
      {status==='ok' && <p>Joined! <Link to="/">Go to lists</Link></p>}
      {status==='error' && <p>Invalid or expired invite.</p>}
    </main>
  )
}
