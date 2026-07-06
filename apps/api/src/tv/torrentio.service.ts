import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common'

export interface TorrentioManifestResponse {
  id: string
  version: string
  name: string
  description: string
  background?: string
  logo?: string
  catalogs?: unknown[]
  resources?: unknown[]
  types?: string[]
  behaviorHints?: Record<string, unknown>
}

export interface TorrentioStreamItem {
  name?: string
  title?: string
  url?: string
  infoHash?: string
  fileIdx?: number
  behaviorHints?: { filename?: string; bingeGroup?: string }
}

export interface TorrentioStreamResponse {
  streams: TorrentioStreamItem[]
}

export interface VodItemDto {
  id: string
  title: string
  type: 'movie' | 'series' | 'anime' | 'other'
  posterUrl?: string
  description?: string
  year?: string
  imdbId: string
}

@Injectable()
export class TorrentioService {
  private readonly torrentioManifestUrl = 'https://torrentio.strem.fun/lite/manifest.json'
  private readonly torrentioBase = 'https://torrentio.strem.fun/lite'
  private readonly userAgent = 'Mozilla/5.0 (compatible; iptvagao/1.0)'

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new InternalServerErrorException(`Falha ao consultar ${url}: ${response.status}`)
    }

    return response.json() as Promise<T>
  }

  async manifest(): Promise<TorrentioManifestResponse> {
    return this.fetchJson<TorrentioManifestResponse>(this.torrentioManifestUrl)
  }

  async stream(type: string, id: string, quality?: string): Promise<TorrentioStreamResponse> {
    if (!type || !id) {
      throw new BadRequestException('Type e id são obrigatórios para stream Torrentio')
    }
    const encodedId = encodeURIComponent(id)
    const url = new URL(`${this.torrentioBase}/stream/${type}/${encodedId}.json`)
    if (quality) url.searchParams.set('quality', quality)
    return this.fetchJson<TorrentioStreamResponse>(url.toString())
  }

  async catalog(type?: string, page = 1): Promise<VodItemDto[]> {
    const currentPage = Math.max(1, page)
    const catalogMovies = `${this.torrentioBase}/catalog/Movies/${currentPage}.json`
    const catalogSeries = `${this.torrentioBase}/catalog/tpbctlg-series/${currentPage}.json`

    const mapMeta = (item: any, defaultType: 'movie' | 'series'): VodItemDto => ({
      id: item.id || item.name || 'unknown',
      title: item.name || 'Título desconhecido',
      type: item.type === 'series' ? 'series' : defaultType,
      posterUrl: item.poster || item.posterUrl || undefined,
      description: item.description?.trim() || undefined,
      year: undefined,
      imdbId: item.infoHash ?? item.id ?? 'unknown',
    })

    const fetchPage = async (url: string, defaultType: 'movie' | 'series') => {
      const response = await this.fetchJson<any>(url)
      const metas = response.metas ?? []
      return metas.map((item: any) => mapMeta(item, defaultType))
    }

    if (type === 'movie') {
      return fetchPage(catalogMovies, 'movie')
    }

    if (type === 'series') {
      return fetchPage(catalogSeries, 'series')
    }

    const [movies, series] = await Promise.all([
      fetchPage(catalogMovies, 'movie'),
      fetchPage(catalogSeries, 'series'),
    ])

    return [...movies, ...series]
  }

  async search(query: string): Promise<VodItemDto[]> {
    if (!query || !query.trim()) return []
    const normalized = query.trim()

    const movieResponse = await this.fetchJson<any>(
      `${this.torrentioBase}/catalog/Movies/1.json?search=${encodeURIComponent(normalized)}`,
    ).catch(() => ({ metas: [] }))

    const seriesResponse = await this.fetchJson<any>(
      `${this.torrentioBase}/catalog/TV%20shows/1.json?search=${encodeURIComponent(normalized)}`,
    ).catch(() => ({ metas: [] }))

    const movieItems = (movieResponse.metas ?? []).map((item: any) => ({
      id: item.id || item.name || `movie-${Math.random()}`,
      title: item.name || 'Filme desconhecido',
      type: 'movie',
      posterUrl: item.poster || item.posterUrl || undefined,
      description: item.description?.trim() || undefined,
      year: undefined,
      imdbId: item.infoHash ?? item.id ?? 'unknown',
    }))

    const seriesItems = (seriesResponse.metas ?? []).map((item: any) => ({
      id: item.id || item.name || `series-${Math.random()}`,
      title: item.name || 'Série desconhecida',
      type: 'series',
      posterUrl: item.poster || item.posterUrl || undefined,
      description: item.description?.trim() || undefined,
      year: undefined,
      imdbId: item.infoHash ?? item.id ?? 'unknown',
    }))

    const unique = new Map<string, VodItemDto>()
    ;[...movieItems, ...seriesItems].forEach((item) => {
      if (!unique.has(item.imdbId)) unique.set(item.imdbId, item)
    })

    return Array.from(unique.values())
  }
}
