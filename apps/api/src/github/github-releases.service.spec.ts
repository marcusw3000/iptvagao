import { Test } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { GithubReleasesService } from './github-releases.service'

describe('GithubReleasesService', () => {
  let service: GithubReleasesService
  const config = { getOrThrow: jest.fn() }
  const file = { buffer: Buffer.from('apk'), filename: 'app.apk', mimetype: 'application/vnd.android.package-archive' }
  const originalFetch = global.fetch

  beforeEach(async () => {
    jest.clearAllMocks()
    config.getOrThrow.mockImplementation((key: string) =>
      key === 'GITHUB_TOKEN' ? 'token123' : 'owner/repo',
    )
    const module = await Test.createTestingModule({
      providers: [GithubReleasesService, { provide: ConfigService, useValue: config }],
    }).compile()
    service = module.get(GithubReleasesService)
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('creates a release then uploads the APK as an asset, returning its download URL', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 42 }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ browser_download_url: 'https://github.com/owner/repo/releases/download/app-v2/app.apk' }),
      })
    global.fetch = fetchMock as any

    const url = await service.publishApk(2, '1.1', 'fixes', file)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.github.com/repos/owner/repo/releases',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ tag_name: 'app-v2', name: 'App 1.1', body: 'fixes', draft: false, prerelease: false }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://uploads.github.com/repos/owner/repo/releases/42/assets?name=app.apk',
      expect.objectContaining({ method: 'POST', body: file.buffer }),
    )
    expect(url).toBe('https://github.com/owner/repo/releases/download/app-v2/app.apk')
  })

  it('throws when release creation fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 422, text: async () => 'tag already exists' }) as any
    await expect(service.publishApk(2, '1.1', undefined, file)).rejects.toThrow(BadRequestException)
  })

  it('throws when asset upload fails', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 42 }) })
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'server error' })
    global.fetch = fetchMock as any

    await expect(service.publishApk(2, '1.1', undefined, file)).rejects.toThrow(BadRequestException)
  })
})
