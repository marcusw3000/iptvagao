import { VodService } from './vod.service'
import { TorrentioService } from './torrentio.service'

describe('VodService direct stream validation', () => {
  let service: VodService

  beforeEach(() => {
    service = new VodService({} as unknown as TorrentioService)
  })

  it('keeps only supported direct playback URLs', () => {
    expect((service as any).normalizePlaybackUrl('https://example.com/video.m3u8')).toBe('https://example.com/video.m3u8')
    expect((service as any).normalizePlaybackUrl('http://localhost:3001/api/v1/stream')).toBe('http://10.0.2.2:3001/api/v1/stream')
    expect((service as any).normalizePlaybackUrl('magnet:?xt=urn:btih:abc123')).toBeNull()
    expect((service as any).normalizePlaybackUrl('udp://tracker.example')).toBeNull()
  })

  it('preserves magnet URLs so the TV app can prepare torrent playback', () => {
    const stream = {
      title: 'Example',
      infoHash: 'abc123',
      url: 'magnet:?xt=urn:btih:abc123',
    }

    expect((service as any).buildTorrentUrl(stream)).toBe('magnet:?xt=urn:btih:abc123')
  })
})
