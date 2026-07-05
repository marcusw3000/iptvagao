import { BadRequestException, Controller, Post, Req, UseGuards } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { UserRole } from '@prisma/client'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { SupabaseService } from '../supabase/supabase.service'

const ADMIN_ROLES = [UserRole.master_admin, UserRole.support]
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly supabase: SupabaseService) {}

  @Post('channel-logo')
  @Roles(...ADMIN_ROLES)
  async uploadChannelLogo(@Req() req: FastifyRequest) {
    const file = await req.file()
    if (!file) throw new BadRequestException('Nenhum arquivo enviado')
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Tipo de arquivo não permitido')
    }

    const buffer = await file.toBuffer()
    const url = await this.supabase.uploadChannelLogo(buffer, file.filename, file.mimetype)
    return { url }
  }
}
