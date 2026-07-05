import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { GithubReleasesService } from '../github/github-releases.service'

const ALLOWED_MIME = ['application/vnd.android.package-archive', 'application/octet-stream']

export interface CreateAppReleaseInput {
  versionCode: number
  versionName: string
  changelog?: string
  mandatory?: boolean
}

@Injectable()
export class AppReleasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly github: GithubReleasesService,
  ) {}

  async create(input: CreateAppReleaseInput, file: { buffer: Buffer; filename: string; mimetype: string }) {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Arquivo deve ser um APK (.apk)')
    }
    const existing = await this.prisma.appRelease.findUnique({ where: { versionCode: input.versionCode } })
    if (existing) throw new BadRequestException(`Já existe uma versão com versionCode ${input.versionCode}`)

    const apkUrl = await this.github.publishApk(input.versionCode, input.versionName, input.changelog, file)

    return this.prisma.appRelease.create({
      data: {
        versionCode: input.versionCode,
        versionName: input.versionName,
        changelog: input.changelog,
        mandatory: input.mandatory ?? false,
        apkUrl,
      },
    })
  }

  async latest() {
    const release = await this.prisma.appRelease.findFirst({ orderBy: { versionCode: 'desc' } })
    if (!release) throw new NotFoundException('Nenhuma versão publicada ainda')
    return release
  }
}
