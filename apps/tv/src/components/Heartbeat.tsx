import { useEffect } from 'react'
import { api } from '../lib/api'

export function Heartbeat({ deviceId }: { deviceId: string }) {
  useEffect(() => {
    const beat = () => api.post(`/activate/heartbeat/${deviceId}`).catch(() => {})
    beat()
    const id = setInterval(beat, 60_000)
    return () => clearInterval(id)
  }, [deviceId])

  return null
}
