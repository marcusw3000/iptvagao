import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { EpgService } from './epg.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'

const ADMIN_ROLES = [UserRole.master_admin, UserRole.support]

@Controller('epg')
@UseGuards(JwtAuthGuard)
export class EpgController {
  constructor(private readonly epgService: EpgService) {}

  @Post('import')
  @Roles(...ADMIN_ROLES)
  importXmltv(@Body() body: { url: string }) {
    return this.epgService.importFromXmltv(body.url)
  }
}
