import { Module } from '@nestjs/common'
import { ChannelsService } from './channels.service'
import { ChannelsController } from './channels.controller'
import { FavoritesService } from './favorites.service'

@Module({
  controllers: [ChannelsController],
  providers: [ChannelsService, FavoritesService],
  exports: [ChannelsService, FavoritesService],
})
export class ChannelsModule {}
