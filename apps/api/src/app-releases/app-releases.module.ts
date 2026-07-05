import { Module } from '@nestjs/common'
import { AppReleasesController } from './app-releases.controller'
import { AppReleasesService } from './app-releases.service'
import { GithubModule } from '../github/github.module'

@Module({
  imports: [GithubModule],
  controllers: [AppReleasesController],
  providers: [AppReleasesService],
})
export class AppReleasesModule {}
