import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { api } from '../lib/api'
import type { Channel } from '../types'

interface Props {
  channel: Channel
  onBack: () => void
}

type Status = 'loading' | 'playing' | 'error'

export function PlayerScreen({ channel, onBack }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let cancelled = false
    let hls: Hls | null = null

    const startPlayback = async (sourceUrl: string, mimeType?: string) => {
      if (cancelled) return

      setStatus('loading')

      if (Hls.isSupported() && mimeType === 'application/vnd.apple.mpegurl') {
        hls = new Hls()
        hls.loadSource(sourceUrl)
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!cancelled) video.play().catch(() => {})
        })
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!cancelled && data.fatal) setStatus('error')
        })
      } else if (video.canPlayType(mimeType ?? 'video/mp4') || mimeType === 'video/mp4' || mimeType === 'video/webm') {
        video.src = sourceUrl
        video.play().catch(() => {})
        video.addEventListener('error', () => setStatus('error'))
      } else {
        setStatus('error')
      }
    }

    const loadSource = async () => {
      if (channel.url.startsWith('magnet:') || channel.url.endsWith('.torrent')) {
        try {
          const response = await api.get('/tv/torrent/prepare', {
            params: { source: channel.url },
          })
          const prepared = response.data
          if (!cancelled && prepared?.streamUrl) {
            await startPlayback(prepared.streamUrl, prepared.mimeType)
          } else {
            setStatus('error')
          }
        } catch {
          setStatus('error')
        }
        return
      }

      await startPlayback(channel.url)
    }

    loadSource()

    function handlePlaying() {
      setStatus('playing')
    }
    video.addEventListener('playing', handlePlaying)

    return () => {
      cancelled = true
      video.removeEventListener('playing', handlePlaying)
      hls?.destroy()
    }
  }, [channel.url])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'Backspace') onBack()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onBack])

  return (
    <div className="w-screen h-screen bg-black relative">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        autoPlay
        playsInline
      />

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80">
          <p className="text-white text-2xl font-semibold">Não foi possível carregar este canal</p>
          <p className="text-gray-400 text-sm">O canal pode estar temporariamente fora do ar</p>
        </div>
      )}

      <div className="absolute top-6 left-6 flex items-center gap-4 bg-black/60 px-5 py-3 rounded-xl">
        {channel.logoUrl && (
          <img src={channel.logoUrl} alt="" className="w-10 h-10 object-contain" />
        )}
        <span className="text-white text-xl font-semibold">{channel.name}</span>
      </div>

      <button
        onClick={onBack}
        className="absolute bottom-6 right-6 bg-black/60 hover:bg-black/80 text-white px-6 py-3 rounded-xl text-lg transition-colors"
      >
        ← Voltar
      </button>
    </div>
  )
}
