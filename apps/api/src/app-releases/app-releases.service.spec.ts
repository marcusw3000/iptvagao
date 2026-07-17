import { AppReleaseChannel } from '@prisma/client'
import { Test } from '@nestjs/testing'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { AppReleasesService } from './app-releases.service'
import { PrismaService } from '../prisma/prisma.service'
import { GithubReleasesService } from '../github/github-releases.service'

describe('AppReleasesService', () => {
  let service: AppReleasesService
  const prisma = {
    appRelease: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  }
  const github = { publishApk: jest.fn() }
  const file = { buffer: Buffer.from('apk'), filename: 'app.apk', mimetype: 'application/vnd.android.package-archive' }
  const channel: AppReleaseChannel = 'prod'

  beforeEach(async () => {
    jest.clearAllMocks()
    const module = await Test.createTestingModule({
      providers: [
        AppReleasesService,
        { provide: PrismaService, useValue: prisma },
        { provide: GithubReleasesService, useValue: github },
      ],
    }).compile()
    service = module.get(AppReleasesService)
  })

  describe('create', () => {
    it('rejects a file that is not an APK', async () => {
      await expect(
        service.create({ channel, versionCode: 2, versionName: '1.1' }, { ...file, mimetype: 'image/png' }),
      ).rejects.toThrow(BadRequestException)
      expect(github.publishApk).not.toHaveBeenCalled()
    })

    it('rejects a duplicate versionCode inside the same channel', async () => {
      prisma.appRelease.findUnique.mockResolvedValue({ id: 'existing' })
      await expect(service.create({ channel, versionCode: 2, versionName: '1.1' }, file)).rejects.toThrow(
        BadRequestException,
      )
      expect(prisma.appRelease.findUnique).toHaveBeenCalledWith({
        where: {
          channel_versionCode: {
            channel,
            versionCode: 2,
          },
        },
      })
      expect(github.publishApk).not.toHaveBeenCalled()
    })

    it('publishes the APK to GitHub Releases and creates the release record', async () => {
      prisma.appRelease.findUnique.mockResolvedValue(null)
      github.publishApk.mockResolvedValue('https://github.com/owner/repo/releases/download/app-prod-v2/prod-app.apk')
      prisma.appRelease.create.mockResolvedValue({ id: 'rel1', versionCode: 2, channel })

      const result = await service.create(
        { channel, versionCode: 2, versionName: '1.1', changelog: 'fixes', mandatory: true },
        file,
      )

      expect(github.publishApk).toHaveBeenCalledWith(channel, 2, '1.1', 'fixes', file)
      expect(prisma.appRelease.create).toHaveBeenCalledWith({
        data: {
          channel,
          versionCode: 2,
          versionName: '1.1',
          changelog: 'fixes',
          mandatory: true,
          apkUrl: 'https://github.com/owner/repo/releases/download/app-prod-v2/prod-app.apk',
        },
      })
      expect(result).toEqual({ id: 'rel1', versionCode: 2, channel })
    })
  })

  describe('latest', () => {
    it('throws when no release exists for the requested channel', async () => {
      prisma.appRelease.findFirst.mockResolvedValue(null)
      await expect(service.latest(channel)).rejects.toThrow(NotFoundException)
    })

    it('returns the release with the highest versionCode inside the channel', async () => {
      prisma.appRelease.findFirst.mockResolvedValue({ id: 'rel2', versionCode: 3, channel })
      const result = await service.latest(channel)
      expect(prisma.appRelease.findFirst).toHaveBeenCalledWith({
        where: { channel },
        orderBy: { versionCode: 'desc' },
      })
      expect(result).toEqual({ id: 'rel2', versionCode: 3, channel })
    })
  })
})
