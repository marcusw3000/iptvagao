import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

interface GithubReleaseResponse {
  id: number
}

interface GithubAssetResponse {
  browser_download_url: string
}

@Injectable()
export class GithubReleasesService {
  private readonly token: string
  private readonly repo: string

  constructor(private readonly config: ConfigService) {
    this.token = this.config.getOrThrow<string>('GITHUB_TOKEN')
    this.repo = this.config.getOrThrow<string>('GITHUB_REPO')
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
  }

  async publishApk(
    versionCode: number,
    versionName: string,
    changelog: string | undefined,
    file: { buffer: Buffer; filename: string; mimetype: string },
  ): Promise<string> {
    const tag = `app-v${versionCode}`

    const releaseRes = await fetch(`https://api.github.com/repos/${this.repo}/releases`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag_name: tag,
        name: `App ${versionName}`,
        body: changelog ?? '',
        draft: false,
        prerelease: false,
      }),
    })
    if (!releaseRes.ok) {
      throw new BadRequestException(`Falha ao criar release no GitHub: ${releaseRes.status} ${await releaseRes.text()}`)
    }
    const release = (await releaseRes.json()) as GithubReleaseResponse

    const uploadUrl = `https://uploads.github.com/repos/${this.repo}/releases/${release.id}/assets?name=${encodeURIComponent(file.filename)}`
    const assetRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': file.mimetype,
        'Content-Length': file.buffer.length.toString(),
      },
      body: file.buffer as unknown as BodyInit,
    })
    if (!assetRes.ok) {
      throw new BadRequestException(`Falha ao enviar APK pro GitHub: ${assetRes.status} ${await assetRes.text()}`)
    }
    const asset = (await assetRes.json()) as GithubAssetResponse
    return asset.browser_download_url
  }
}
