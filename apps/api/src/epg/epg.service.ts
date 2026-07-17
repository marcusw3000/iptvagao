import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { assertSafeRemoteUrl } from '../common/security/remote-url'

interface XmltvProgramme {
  tvgId: string
  title: string
  startTime: Date
  endTime: Date
  description?: string
}

// Formato XMLTV: YYYYMMDDHHmmss +ZZZZ (offset opcional)
function parseXmltvTime(raw: string): Date | null {
  const match = raw.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?$/)
  if (!match) return null
  const [, y, mo, d, h, mi, s, offset] = match
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${offset ? `${offset.slice(0, 3)}:${offset.slice(3)}` : 'Z'}`
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

@Injectable()
export class EpgService {
  private readonly logger = new Logger(EpgService.name)

  constructor(private readonly prisma: PrismaService) {}

  private parseXmltv(xml: string): XmltvProgramme[] {
    const programmes: XmltvProgramme[] = []
    const blockRegex = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/g
    let match: RegExpExecArray | null

    while ((match = blockRegex.exec(xml)) !== null) {
      const [, attrs, body] = match
      const channelAttr = attrs.match(/channel="([^"]*)"/)
      const startAttr = attrs.match(/start="([^"]*)"/)
      const stopAttr = attrs.match(/stop="([^"]*)"/)
      const titleMatch = body.match(/<title[^>]*>([\s\S]*?)<\/title>/)
      const descMatch = body.match(/<desc[^>]*>([\s\S]*?)<\/desc>/)

      if (!channelAttr || !startAttr || !stopAttr || !titleMatch) continue

      const startTime = parseXmltvTime(startAttr[1])
      const endTime = parseXmltvTime(stopAttr[1])
      if (!startTime || !endTime) continue

      programmes.push({
        tvgId: channelAttr[1],
        title: decodeXmlEntities(titleMatch[1]).trim(),
        startTime,
        endTime,
        description: descMatch ? decodeXmlEntities(descMatch[1]).trim() : undefined,
      })
    }

    return programmes
  }

  async importFromXmltv(url: string) {
    const safeUrl = assertSafeRemoteUrl(url, process.env.EPG_IMPORT_ALLOWLIST)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60_000)
    let xml: string
    try {
      const res = await fetch(safeUrl, { signal: controller.signal })
      if (!res.ok) throw new BadRequestException(`Falha ao buscar XMLTV: ${res.status}`)
      xml = await res.text()
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new BadRequestException('Timeout ao buscar XMLTV')
      throw e
    } finally {
      clearTimeout(timeout)
    }

    const programmes = this.parseXmltv(xml)
    if (programmes.length === 0) throw new BadRequestException('Nenhuma programação encontrada no XMLTV')

    const channels = await this.prisma.channel.findMany({
      where: { tvgId: { not: null } },
      select: { id: true, tvgId: true },
    })
    const channelByTvgId = new Map(channels.map((c) => [c.tvgId as string, c.id]))

    const relevant = programmes.filter((p) => channelByTvgId.has(p.tvgId))
    if (relevant.length === 0) {
      return { totalInFeed: programmes.length, matched: 0, imported: 0 }
    }

    const matchedChannelIds = [...new Set(relevant.map((p) => channelByTvgId.get(p.tvgId)!))]

    // Substitui a janela futura por canal (evita duplicar/acumular reimportações)
    await this.prisma.epgProgram.deleteMany({
      where: { channelId: { in: matchedChannelIds }, endTime: { gte: new Date() } },
    })

    const CHUNK = 500
    let imported = 0
    for (let i = 0; i < relevant.length; i += CHUNK) {
      const chunk = relevant.slice(i, i + CHUNK)
      await this.prisma.epgProgram.createMany({
        data: chunk.map((p) => ({
          channelId: channelByTvgId.get(p.tvgId)!,
          title: p.title,
          startTime: p.startTime,
          endTime: p.endTime,
          description: p.description,
        })),
      })
      imported += chunk.length
    }

    this.logger.log(`EPG import: ${imported}/${programmes.length} programas importados (${matchedChannelIds.length} canais)`)
    return { totalInFeed: programmes.length, matched: matchedChannelIds.length, imported }
  }

  async nowNextForChannels(channelIds: string[]) {
    if (channelIds.length === 0) return {}
    const now = new Date()

    const programs = await this.prisma.epgProgram.findMany({
      where: {
        channelId: { in: channelIds },
        endTime: { gte: now },
      },
      orderBy: { startTime: 'asc' },
      select: { channelId: true, title: true, startTime: true, endTime: true },
    })

    const result: Record<string, { now: unknown; next: unknown }> = {}
    for (const channelId of channelIds) {
      const forChannel = programs.filter((p) => p.channelId === channelId)
      const current = forChannel.find((p) => p.startTime <= now && now < p.endTime)
      const upcoming = forChannel.find((p) => p.startTime > now)
      result[channelId] = {
        now: current ? { title: current.title, startTime: current.startTime, endTime: current.endTime } : null,
        next: upcoming ? { title: upcoming.title, startTime: upcoming.startTime, endTime: upcoming.endTime } : null,
      }
    }
    return result
  }
}
