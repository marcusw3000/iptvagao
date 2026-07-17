import { Test } from '@nestjs/testing'
import { ForbiddenException } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { ChannelsController } from './channels.controller'
import { ChannelsService } from './channels.service'
import { FavoritesService } from './favorites.service'

describe('ChannelsController', () => {
  let controller: ChannelsController
  let channelsService: { findForClient: jest.Mock }
  let favoritesService: {
    annotateChannels: jest.Mock
    addFavorite: jest.Mock
    removeFavorite: jest.Mock
  }

  beforeEach(async () => {
    channelsService = {
      findForClient: jest.fn().mockResolvedValue([{ id: 'ch-1', name: 'TV Globo' }]),
    }
    favoritesService = {
      annotateChannels: jest.fn().mockResolvedValue([{ id: 'ch-1', name: 'TV Globo', isFavorite: true }]),
      addFavorite: jest.fn().mockResolvedValue({ channelId: 'ch-1', isFavorite: true }),
      removeFavorite: jest.fn().mockResolvedValue({ channelId: 'ch-1', isFavorite: false }),
    }

    const module = await Test.createTestingModule({
      controllers: [ChannelsController],
      providers: [
        { provide: ChannelsService, useValue: channelsService },
        { provide: FavoritesService, useValue: favoritesService },
      ],
    }).compile()

    controller = module.get(ChannelsController)
  })

  it('returns annotated channels for the same client user', async () => {
    const user = { role: UserRole.client_user, clientId: 'client-1' }

    const result = await controller.findForClient(user, 'client-1')

    expect(channelsService.findForClient).toHaveBeenCalledWith('client-1')
    expect(favoritesService.annotateChannels).toHaveBeenCalledWith('client-1', [{ id: 'ch-1', name: 'TV Globo' }])
    expect(result).toEqual([{ id: 'ch-1', name: 'TV Globo', isFavorite: true }])
  })

  it('blocks findForClient for another client', async () => {
    const user = { role: UserRole.client_user, clientId: 'client-1' }
    await expect(controller.findForClient(user, 'client-2')).rejects.toThrow(ForbiddenException)
  })

  it('allows admin to add favorite for an arbitrary client', async () => {
    const user = { role: UserRole.master_admin, clientId: null }

    const result = await controller.addFavorite(user, 'ch-1', 'client-9')

    expect(favoritesService.addFavorite).toHaveBeenCalledWith('client-9', 'ch-1')
    expect(result).toEqual({ channelId: 'ch-1', isFavorite: true })
  })

  it('uses logged client when toggling favorite without explicit clientId', async () => {
    const user = { role: UserRole.client_admin, clientId: 'client-1' }

    await controller.removeFavorite(user, 'ch-1', undefined)

    expect(favoritesService.removeFavorite).toHaveBeenCalledWith('client-1', 'ch-1')
  })
})
