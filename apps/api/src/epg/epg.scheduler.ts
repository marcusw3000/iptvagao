import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import { EpgService } from './epg.service'

@Injectable()
export class EpgScheduler {
  private readonly logger = new Logger(EpgScheduler.name)

  constructor(
    private readonly epgService: EpgService,
    private readonly config: ConfigService,
  ) {}

  // Roda depois do horário do grabber (EPG_GRABBER_CRON, default 05:00) pra dar tempo do guide.xml ficar pronto
  @Cron(process.env.EPG_IMPORT_CRON || '0 6 * * *')
  async handleScheduledImport() {
    const url = this.config.get<string>('EPG_SOURCE_URL')
    if (!url) {
      this.logger.debug('EPG_SOURCE_URL não configurada, pulando import agendado')
      return
    }

    try {
      const result = await this.epgService.importFromXmltv(url)
      this.logger.log(`Import agendado de EPG concluído: ${JSON.stringify(result)}`)
    } catch (e: any) {
      this.logger.error(`Falha no import agendado de EPG: ${e?.message}`)
    }
  }
}
