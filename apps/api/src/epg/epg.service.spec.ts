import { Test } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { EpgService } from './epg.service'
import { PrismaService } from '../prisma/prisma.service'

const XMLTV_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <programme channel="globo.br" start="20260705060000 +0000" stop="20260705070000 +0000">
    <title>Jornal Hoje</title>
    <desc>Notícias do dia</desc>
  </programme>
  <programme channel="globo.br" start="20260705070000 +0000" stop="20260705080000 +0000">
    <title>Novela</title>
  </programme>
  <programme channel="unknown.br" start="20260705060000 +0000" stop="20260705070000 +0000">
    <title>Canal sem match</title>
  </programme>
</tv>`

describe('EpgService', () => {
  let service: EpgService
  const prisma = {
    channel: { findMany: jest.fn() },
    epgProgram: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
  }
  const originalFetch = global.fetch

  beforeEach(async () => {
    jest.clearAllMocks()
    const module = await Test.createTestingModule({
      providers: [EpgService, { provide: PrismaService, useValue: prisma }],
    }).compile()
    service = module.get(EpgService)
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('importFromXmltv', () => {
    it('blocks localhost feeds', async () => {
      await expect(service.importFromXmltv('http://127.0.0.1/epg.xml')).rejects.toThrow(BadRequestException)
    })

    it('throws when the feed cannot be fetched', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 })
      await expect(service.importFromXmltv('http://x/epg.xml')).rejects.toThrow(BadRequestException)
    })

    it('imports only programmes matching known tvg-ids, replacing the future window', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => XMLTV_FIXTURE })
      prisma.channel.findMany.mockResolvedValue([{ id: 'ch1', tvgId: 'globo.br' }])
      prisma.epgProgram.deleteMany.mockResolvedValue({})
      prisma.epgProgram.createMany.mockResolvedValue({})

      const result = await service.importFromXmltv('http://x/epg.xml')

      expect(prisma.epgProgram.deleteMany).toHaveBeenCalledWith({
        where: { channelId: { in: ['ch1'] }, endTime: { gte: expect.any(Date) } },
      })
      expect(prisma.epgProgram.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ channelId: 'ch1', title: 'Jornal Hoje', description: 'Notícias do dia' }),
          expect.objectContaining({ channelId: 'ch1', title: 'Novela' }),
        ],
      })
      expect(result).toEqual({ totalInFeed: 3, matched: 1, imported: 2 })
    })

    it('returns zero imported when no tvg-id matches an existing channel', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => XMLTV_FIXTURE })
      prisma.channel.findMany.mockResolvedValue([])

      const result = await service.importFromXmltv('http://x/epg.xml')

      expect(prisma.epgProgram.createMany).not.toHaveBeenCalled()
      expect(result).toEqual({ totalInFeed: 3, matched: 0, imported: 0 })
    })
  })

  describe('nowNextForChannels', () => {
    it('returns null now/next when there is no data', async () => {
      prisma.epgProgram.findMany.mockResolvedValue([])
      const result = await service.nowNextForChannels(['ch1'])
      expect(result).toEqual({ ch1: { now: null, next: null } })
    })

    it('splits programmes into now (in progress) and next (upcoming)', async () => {
      const now = new Date()
      const current = { channelId: 'ch1', title: 'Ao vivo', startTime: new Date(now.getTime() - 1000), endTime: new Date(now.getTime() + 1000) }
      const upcoming = { channelId: 'ch1', title: 'Depois', startTime: new Date(now.getTime() + 2000), endTime: new Date(now.getTime() + 3000) }
      prisma.epgProgram.findMany.mockResolvedValue([current, upcoming])

      const result = await service.nowNextForChannels(['ch1'])

      expect(result.ch1.now).toMatchObject({ title: 'Ao vivo' })
      expect(result.ch1.next).toMatchObject({ title: 'Depois' })
    })
  })
})
