import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import * as path from 'path'

export interface TorrentStreamPreparationResult {
  status: 'ready' | 'error'
  streamUrl?: string
  fileName?: string
  mimeType?: string
  id?: string
  message?: string
}

type TorrentClientLike = {
  add?: (source: string, options?: { path?: string; announce?: string[] }) => Promise<any>
  download?: (source: string, options?: { path?: string; announce?: string[] }) => Promise<any>
}

type TorrentFileLike = {
  path: string
  name?: string
  length?: number
}

@Injectable()
export class TorrentEngineService {
  private readonly downloadDir: string
  private readonly activeDownloads = new Map<string, { filePath: string; fileName: string; mimeType: string }>()
  private readonly trackers = [
    'udp://tracker.openbittorrent.com:80/announce',
    'udp://tracker.opentrackr.org:1337/announce',
    'wss://tracker.openwebtorrent.com',
  ]

  constructor(
    private readonly configService: ConfigService,
    @Optional() @Inject('TORRENT_CLIENT') private readonly torrentClient?: TorrentClientLike,
  ) {
    this.downloadDir = this.configService.get<string>('TORRENT_DOWNLOAD_DIR') ?? path.join(process.cwd(), 'storage', 'torrents')
  }

  async prepareStream(source: string): Promise<TorrentStreamPreparationResult> {
    if (!source || (!source.startsWith('magnet:') && !source.endsWith('.torrent'))) {
      throw new BadRequestException('Fonte inválida para torrent')
    }

    await fs.mkdir(this.downloadDir, { recursive: true })

    const torrent = await this.startDownload(source)

    await this.waitForTorrent(torrent)

    const chosenFile = this.selectBestFile(torrent.files as TorrentFileLike[])
    if (!chosenFile) {
      throw new BadRequestException('Nenhum arquivo de vídeo encontrado no torrent')
    }

    const filePath = path.resolve(this.downloadDir, chosenFile.path)
    const normalizedDownloadDir = path.resolve(this.downloadDir)
    const expectedPrefix = `${normalizedDownloadDir}${path.sep}`
    if (filePath !== normalizedDownloadDir && !filePath.startsWith(expectedPrefix)) {
      throw new BadRequestException('Caminho de torrent invalido')
    }
    const fileName = path.basename(chosenFile.path)
    const mimeType = this.detectMimeType(fileName)
    const id = this.buildDownloadId(source, filePath)

    this.activeDownloads.set(id, { filePath, fileName, mimeType })

    const baseUrl = (this.configService.get<string>('API_URL') ?? 'http://localhost:3001')
      .replace('localhost', '10.0.2.2')
      .replace('127.0.0.1', '10.0.2.2')

    return {
      status: 'ready',
      id,
      streamUrl: `${baseUrl}/api/v1/tv/torrent/file/${id}`,
      fileName,
      mimeType,
    }
  }

  async getFile(id: string): Promise<{ filePath: string; fileName: string; mimeType: string }> {
    const download = this.activeDownloads.get(id)
    if (!download) {
      throw new NotFoundException('Arquivo de torrent não encontrado')
    }

    const fileExists = await fs.stat(download.filePath).catch(() => null)
    if (!fileExists) {
      this.activeDownloads.delete(id)
      throw new NotFoundException('Arquivo de torrent não encontrado no disco')
    }

    return download
  }

  private async startDownload(source: string): Promise<any> {
    const client = this.torrentClient ?? (await this.createTorrentClient())

    if (client.add) {
      return client.add(source, {
        path: this.downloadDir,
        announce: this.trackers,
      })
    }

    if (client.download) {
      return client.download(source, {
        path: this.downloadDir,
        announce: this.trackers,
      })
    }

    throw new BadRequestException('Cliente de torrent não suportado')
  }

  private async waitForTorrent(torrent: any): Promise<void> {
    if (torrent.done) return

    if (typeof torrent.once !== 'function') {
      return
    }

    await new Promise<void>((resolve, reject) => {
      torrent.once('done', () => resolve())
      torrent.once('error', (error: Error) => reject(error))
    })
  }

  private selectBestFile(files: TorrentFileLike[] | undefined): TorrentFileLike | undefined {
    if (!files?.length) {
      return undefined
    }

    const videoFiles = files.filter((file) => {
      const normalized = (file.path || file.name || '').toLowerCase()
      return /\.(mp4|mkv|mov|webm|avi|m3u8)$/i.test(normalized)
    })

    return videoFiles[0] ?? files[0]
  }

  private detectMimeType(fileName: string): string {
    if (/\.m3u8$/i.test(fileName)) {
      return 'application/vnd.apple.mpegurl'
    }
    if (/\.mp4$/i.test(fileName)) {
      return 'video/mp4'
    }
    if (/\.mkv$/i.test(fileName)) {
      return 'video/x-matroska'
    }
    if (/\.webm$/i.test(fileName)) {
      return 'video/webm'
    }
    return 'application/octet-stream'
  }

  private buildDownloadId(source: string, filePath: string): string {
    return createHash('sha256').update(`${source}:${filePath}`).digest('hex').slice(0, 16)
  }

  private async createTorrentClient(): Promise<TorrentClientLike> {
    const module = await import('webtorrent')
    return new module.default() as TorrentClientLike
  }
}
