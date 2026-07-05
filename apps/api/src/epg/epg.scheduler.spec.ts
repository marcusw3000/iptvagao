import { Test } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { EpgScheduler } from './epg.scheduler'
import { EpgService } from './epg.service'

describe('EpgScheduler', () => {
  let scheduler: EpgScheduler
  const epgService = { importFromXmltv: jest.fn() }
  const config = { get: jest.fn() }

  beforeEach(async () => {
    jest.clearAllMocks()
    const module = await Test.createTestingModule({
      providers: [
        EpgScheduler,
        { provide: EpgService, useValue: epgService },
        { provide: ConfigService, useValue: config },
      ],
    }).compile()
    scheduler = module.get(EpgScheduler)
  })

  it('skips import when EPG_SOURCE_URL is not configured', async () => {
    config.get.mockReturnValue(undefined)
    await scheduler.handleScheduledImport()
    expect(epgService.importFromXmltv).not.toHaveBeenCalled()
  })

  it('imports from the configured URL', async () => {
    config.get.mockReturnValue('http://epg-grabber:3000/guide.xml')
    epgService.importFromXmltv.mockResolvedValue({ totalInFeed: 10, matched: 5, imported: 5 })
    await scheduler.handleScheduledImport()
    expect(epgService.importFromXmltv).toHaveBeenCalledWith('http://epg-grabber:3000/guide.xml')
  })

  it('swallows errors from a failed import so the cron does not crash', async () => {
    config.get.mockReturnValue('http://epg-grabber:3000/guide.xml')
    epgService.importFromXmltv.mockRejectedValue(new Error('network down'))
    await expect(scheduler.handleScheduledImport()).resolves.toBeUndefined()
  })
})
