import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateChannelDto, UpdateChannelDto } from './dto/create-channel.dto'

interface M3uEntry {
  name: string
  url: string
  logoUrl?: string
  group?: string
}

const CHANNEL_SELECT = {
  id: true,
  categoryId: true,
  name: true,
  url: true,
  logoUrl: true,
  order: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
  plans: { select: { id: true, name: true, type: true } },
} as const

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name)

  constructor(private readonly prisma: PrismaService) {}

  private async getDefaultPlanIds(): Promise<string[]> {
    const plans = await this.prisma.plan.findMany({ where: { active: true }, select: { id: true } })
    return plans.map((p) => p.id)
  }

  async create(dto: CreateChannelDto) {
    const { planIds, ...rest } = dto
    const resolvedPlanIds = planIds ?? (await this.getDefaultPlanIds())
    return this.prisma.channel.create({
      data: {
        ...rest,
        plans: { connect: resolvedPlanIds.map((id) => ({ id })) },
      },
      select: CHANNEL_SELECT,
    })
  }

  async findAll({ page = 1, limit = 50 }: { page: number; limit: number }) {
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      this.prisma.channel.findMany({
        skip,
        take: limit,
        select: CHANNEL_SELECT,
        orderBy: { order: 'asc' },
      }),
      this.prisma.channel.count(),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findForClient(clientId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { clientId },
      select: { status: true, planId: true },
    })
    if (!subscription) return []
    if (subscription.status === 'suspended' || subscription.status === 'cancelled') {
      throw new ForbiddenException('Assinatura suspensa ou cancelada')
    }

    return this.prisma.channel.findMany({
      where: { active: true, plans: { some: { id: subscription.planId } } },
      select: CHANNEL_SELECT,
      orderBy: { order: 'asc' },
    })
  }

  async findOne(id: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id }, select: CHANNEL_SELECT })
    if (!channel) throw new NotFoundException('Canal não encontrado')
    return channel
  }

  async update(id: string, dto: UpdateChannelDto) {
    await this.findOne(id)
    const { planIds, ...rest } = dto
    return this.prisma.channel.update({
      where: { id },
      data: {
        ...rest,
        plans: planIds ? { set: planIds.map((id) => ({ id })) } : undefined,
      },
      select: CHANNEL_SELECT,
    })
  }

  async remove(id: string) {
    await this.findOne(id)
    return this.prisma.channel.delete({ where: { id } })
  }

  private parseM3u(text: string): M3uEntry[] {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
    const entries: M3uEntry[] = []
    let current: Partial<M3uEntry> | null = null

    for (const line of lines) {
      if (line.startsWith('#EXTINF:')) {
        const name = line.includes(',') ? line.slice(line.lastIndexOf(',') + 1).trim() : ''
        const logo = line.match(/tvg-logo="([^"]*)"/)
        const group = line.match(/group-title="([^"]*)"/)
        current = {
          name,
          logoUrl: logo?.[1] || undefined,
          group: group?.[1] || undefined,
        }
      } else if (line.startsWith('http') && current) {
        if (current.name) {
          entries.push({ name: current.name, url: line, logoUrl: current.logoUrl, group: current.group })
        }
        current = null
      } else if (!line.startsWith('#')) {
        current = null
      }
    }

    return entries
  }

  async importFromM3u(m3uUrl: string) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    let text: string
    try {
      const res = await fetch(m3uUrl, { signal: controller.signal })
      if (!res.ok) throw new BadRequestException(`Falha ao buscar M3U: ${res.status}`)
      text = await res.text()
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new BadRequestException('Timeout ao buscar M3U')
      throw e
    } finally {
      clearTimeout(timeout)
    }

    const BLOCKED_GROUPS = new Set(['Compras', 'compras', 'Sem Categoria', 'sem categoria', 'undefined', 'Undefined'])
    const SKIP_GROUPS = new Set(['Compras', 'compras']) // these channels are dropped entirely
    const STRIP_GROUPS = new Set(['Sem Categoria', 'sem categoria', 'undefined', 'Undefined']) // import without category

    const allEntries = this.parseM3u(text)
    if (allEntries.length === 0) throw new BadRequestException('Nenhum canal encontrado no M3U')

    const entries = allEntries
      .filter((e) => !e.group || !SKIP_GROUPS.has(e.group))
      .map((e) => ({
        ...e,
        group: e.group && STRIP_GROUPS.has(e.group) ? undefined : e.group,
      }))

    // Upsert categories by group name (global)
    const groupNames = [...new Set(entries.map((e) => e.group).filter(Boolean))].filter(
      (g) => !BLOCKED_GROUPS.has(g as string),
    ) as string[]
    const categoryMap = new Map<string, string>()

    for (const groupName of groupNames) {
      const existing = await this.prisma.category.findFirst({ where: { name: groupName } })
      if (existing) {
        categoryMap.set(groupName, existing.id)
      } else {
        const cat = await this.prisma.category.create({ data: { name: groupName } })
        categoryMap.set(groupName, cat.id)
      }
    }

    // Upsert channels: match by url (global) — new channels get all active plans by default
    const defaultPlanIds = await this.getDefaultPlanIds()
    let created = 0
    let updated = 0

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      const categoryId = entry.group ? categoryMap.get(entry.group) : undefined
      const existing = await this.prisma.channel.findFirst({ where: { url: entry.url } })

      if (existing) {
        await this.prisma.channel.update({
          where: { id: existing.id },
          data: { name: entry.name, logoUrl: entry.logoUrl ?? null, categoryId: categoryId ?? null },
        })
        updated++
      } else {
        await this.prisma.channel.create({
          data: {
            name: entry.name,
            url: entry.url,
            logoUrl: entry.logoUrl,
            categoryId,
            order: i,
            plans: { connect: defaultPlanIds.map((id) => ({ id })) },
          },
        })
        created++
      }
    }

    this.logger.log(`M3U import: ${created} created, ${updated} updated`)
    return { total: entries.length, created, updated }
  }
}
