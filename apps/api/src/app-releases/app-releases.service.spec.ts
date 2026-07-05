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
        service.create({ versionCode: 2, versionName: '1.1' }, { ...file, mimetype: 'image/png' }),
      ).rejects.toThrow(BadRequestException)
      expect(github.publishApk).not.toHaveBeenCalled()
    })

    it('rejects a duplicate versionCode', async () => {
      prisma.appRelease.findUnique.mockResolvedValue({ id: 'existing' })
      await expect(service.create({ versionCode: 2, versionName: '1.1' }, file)).rejects.toThrow(BadRequestException)
      expect(github.publishApk).not.toHaveBeenCalled()
    })

    it('publishes the APK to GitHub Releases and creates the release record', async () => {
      prisma.appRelease.findUnique.mockResolvedValue(null)
      github.publishApk.mockResolvedValue('https://github.com/owner/repo/releases/download/app-v2/app.apk')
      prisma.appRelease.create.mockResolvedValue({ id: 'rel1', versionCode: 2 })

      const result = await service.create(
        { versionCode: 2, versionName: '1.1', changelog: 'fixes', mandatory: true },
        file,
      )

      expect(github.publishApk).toHaveBeenCalledWith(2, '1.1', 'fixes', file)
      expect(prisma.appRelease.create).toHaveBeenCalledWith({
        data: {
          versionCode: 2,
          versionName: '1.1',
          changelog: 'fixes',
          mandatory: true,
          apkUrl: 'https://github.com/owner/repo/releases/download/app-v2/app.apk',
        },
      })
      expect(result).toEqual({ id: 'rel1', versionCode: 2 })
    })
  })

  describe('latest', () => {
    it('throws when no release exists', async () => {
      prisma.appRelease.findFirst.mockResolvedValue(null)
      await expect(service.latest()).rejects.toThrow(NotFoundException)
    })

    it('returns the release with the highest versionCode', async () => {
      prisma.appRelease.findFirst.mockResolvedValue({ id: 'rel2', versionCode: 3 })
      const result = await service.latest()
      expect(prisma.appRelease.findFirst).toHaveBeenCalledWith({ orderBy: { versionCode: 'desc' } })
      expect(result).toEqual({ id: 'rel2', versionCode: 3 })
    })
  })
})
