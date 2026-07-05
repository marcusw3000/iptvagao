import { Module } from '@nestjs/common'
import { GithubReleasesService } from './github-releases.service'

@Module({
  providers: [GithubReleasesService],
  exports: [GithubReleasesService],
})
export class GithubModule {}
