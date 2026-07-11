import { ConfigService } from '@nestjs/config'

jest.mock('webtorrent', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({
      files: [{ path: 'video.mp4' }],
      done: true,
      once: jest.fn(),
    }),
  })),
}))

import { TorrentEngineService } from './torrent-engine.service'

describe('TorrentEngineService', () => {
  it('prepara uma URL de stream local a partir de um magnet', async () => {
    const downloadSpy = jest.fn().mockResolvedValue({
      files: [{ path: 'video.mp4' }],
      done: true,
      once: jest.fn(),
    })

    const service = new TorrentEngineService(
      {
        get: jest.fn().mockReturnValue('/tmp/iptvagao-torrents'),
      } as unknown as ConfigService,
      {
        download: downloadSpy,
      } as any,
    )

    const result = await service.prepareStream('magnet:?xt=urn:btih:abc123')

    expect(downloadSpy).toHaveBeenCalledWith('magnet:?xt=urn:btih:abc123', expect.objectContaining({ path: '/tmp/iptvagao-torrents' }))
    expect(result.status).toBe('ready')
    expect(result.streamUrl).toContain('/tv/torrent/file/')
    expect(result.fileName).toBe('video.mp4')
    expect(result.mimeType).toBe('video/mp4')
  })
})
