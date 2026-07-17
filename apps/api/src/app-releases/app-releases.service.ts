import { AppReleaseChannel } from '@prisma/client'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { GithubReleasesService } from '../github/github-releases.service'

const ALLOWED_MIME = ['application/vnd.android.package-archive', 'application/octet-stream']

export interface CreateAppReleaseInput {
  channel: AppReleaseChannel
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

    const existing = await this.prisma.appRelease.findUnique({
      where: {
        channel_versionCode: {
          channel: input.channel,
          versionCode: input.versionCode,
        },
      },
    })
    if (existing) {
      throw new BadRequestException(`Ja existe uma versao ${input.versionCode} no canal ${input.channel}`)
    }

    const apkUrl = await this.github.publishApk(input.channel, input.versionCode, input.versionName, input.changelog, file)

    return this.prisma.appRelease.create({
      data: {
        channel: input.channel,
        versionCode: input.versionCode,
        versionName: input.versionName,
        changelog: input.changelog,
        mandatory: input.mandatory ?? false,
        apkUrl,
      },
    })
  }

  async latest(channel: AppReleaseChannel) {
    const release = await this.prisma.appRelease.findFirst({
      where: { channel },
      orderBy: { versionCode: 'desc' },
    })
    if (!release) throw new NotFoundException(`Nenhuma versao publicada ainda para o canal ${channel}`)
    return release
  }
}
