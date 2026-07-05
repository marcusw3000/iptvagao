import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { UserRole } from '@prisma/client'
import { AppReleasesService } from './app-releases.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { Public } from '../common/decorators/public.decorator'

const ADMIN_ROLES = [UserRole.master_admin, UserRole.support]

@Controller('app-releases')
@UseGuards(JwtAuthGuard)
export class AppReleasesController {
  constructor(private readonly appReleasesService: AppReleasesService) {}

  @Post()
  @Roles(...ADMIN_ROLES)
  async create(@Req() req: FastifyRequest) {
    const parts = req.parts()
    const fields: Record<string, string> = {}
    let file: { buffer: Buffer; filename: string; mimetype: string } | null = null

    for await (const part of parts) {
      if (part.type === 'file') {
        file = { buffer: await part.toBuffer(), filename: part.filename, mimetype: part.mimetype }
      } else {
        fields[part.fieldname] = part.value as string
      }
    }

    if (!file) throw new BadRequestException('Nenhum arquivo APK enviado')
    if (!fields.versionCode || !fields.versionName) {
      throw new BadRequestException('versionCode e versionName são obrigatórios')
    }

    return this.appReleasesService.create(
      {
        versionCode: Number.parseInt(fields.versionCode, 10),
        versionName: fields.versionName,
        changelog: fields.changelog,
        mandatory: fields.mandatory === 'true',
      },
      file,
    )
  }

  @Public()
  @Get('latest')
  latest() {
    return this.appReleasesService.latest()
  }
}
