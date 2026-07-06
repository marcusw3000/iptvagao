import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { TorrentioService, TorrentioStreamItem } from './torrentio.service'

export interface VodCatalogItemDto {
  id: string
  title: string
  translatedTitle?: string
  type: 'movie' | 'series'
  posterUrl?: string
  description?: string
  year?: string
  genres: string[]
}

export interface VodCatalogPageDto {
  items: VodCatalogItemDto[]
  page: number
  limit: number
  hasMore: boolean
}

export interface VodStreamDto {
  id: string
  label: string
  url: string
  source?: string
}

export interface VodItemDetailsDto extends VodCatalogItemDto {
  backdropUrl?: string
  streams: VodStreamDto[]
}

interface CinemetaMetaPreview {
  id: string
  type: 'movie' | 'series'
  name?: string
  description?: string
  poster?: string
  background?: string
  releaseInfo?: string
  genres?: string[]
}

interface CinemetaTrailerStream {
  source?: string
  ytId?: string
}

interface CinemetaMetaDetails extends CinemetaMetaPreview {
  trailerStreams?: CinemetaTrailerStream[]
}

interface CinemetaCatalogResponse {
  metas?: CinemetaMetaPreview[]
  hasMore?: boolean
}

interface CinemetaMetaResponse {
  meta?: CinemetaMetaDetails
}

@Injectable()
export class VodService {
  private readonly baseUrl = 'https://v3-cinemeta.strem.io'
  private readonly userAgent = 'Mozilla/5.0 (compatible; iptvagao/1.0)'
  private readonly torrentioService: TorrentioService

  constructor(torrentioService: TorrentioService) {
    this.torrentioService = torrentioService
  }
  private readonly translationCache = new Map<string, string | undefined>()
  private readonly knownTitleTranslations = new Map<string, string>([
    ['The Matrix', 'Matrix'],
    ['Breaking Bad', 'Breaking Bad'],
    ['Game of Thrones', 'Game of Thrones'],
    ['Interstellar', 'Interestelar'],
    ['Spirited Away', 'A Viagem de Chihiro'],
    ['Money Heist', 'La Casa de Papel'],
    ['The Avengers', 'Os Vingadores'],
  ])

  private readonly fallbackCatalog: Record<'movie' | 'series', VodCatalogItemDto[]> = {
    movie: [
      {
        id: 'tt0133093',
        title: 'The Matrix',
        translatedTitle: 'Matrix',
        type: 'movie',
        posterUrl: 'https://images.metahub.space/poster/medium/tt0133093/img',
        description: 'Um hacker descobre que o mundo em que vive pode ser uma simulacao.',
        year: '1999',
        genres: ['Action', 'Sci-Fi'],
      },
      {
        id: 'tt0816692',
        title: 'Interstellar',
        translatedTitle: 'Interestelar',
        type: 'movie',
        posterUrl: 'https://images.metahub.space/poster/medium/tt0816692/img',
        description: 'Astronautas buscam um novo lar para a humanidade.',
        year: '2014',
        genres: ['Adventure', 'Drama', 'Sci-Fi'],
      },
    ],
    series: [
      {
        id: 'tt0903747',
        title: 'Breaking Bad',
        translatedTitle: 'Breaking Bad',
        type: 'series',
        posterUrl: 'https://images.metahub.space/poster/medium/tt0903747/img',
        description: 'Um professor de quimica passa a produzir metanfetamina.',
        year: '2008-2013',
        genres: ['Crime', 'Drama', 'Thriller'],
      },
      {
        id: 'tt0944947',
        title: 'Game of Thrones',
        translatedTitle: 'Game of Thrones',
        type: 'series',
        posterUrl: 'https://images.metahub.space/poster/medium/tt0944947/img',
        description: 'Casas nobres disputam o controle de Westeros.',
        year: '2011-2019',
        genres: ['Action', 'Adventure', 'Drama'],
      },
    ],
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': this.userAgent,
      },
    })

    if (!response.ok) {
      throw new InternalServerErrorException(`Falha ao consultar Cinemeta: ${response.status}`)
    }

    return response.json() as Promise<T>
  }

  private normalizeType(type?: string): 'movie' | 'series' {
    return type === 'series' ? 'series' : 'movie'
  }

  private normalizeGenre(genre?: string): string | undefined {
    const normalizedGenre = genre?.trim()
    if (!normalizedGenre || normalizedGenre.toLowerCase() === 'all') return undefined
    return normalizedGenre
  }

  private async translateTitle(title: string): Promise<string | undefined> {
    const normalizedTitle = title.trim()
    if (!normalizedTitle) return undefined

    if (this.translationCache.has(normalizedTitle)) {
      return this.translationCache.get(normalizedTitle)
    }

    const knownTranslation = this.knownTitleTranslations.get(normalizedTitle)
    if (knownTranslation) {
      this.translationCache.set(normalizedTitle, knownTranslation)
      return knownTranslation
    }

    try {
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt-BR&dt=t&q=${encodeURIComponent(normalizedTitle)}`,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': this.userAgent,
          },
        },
      )

      if (!response.ok) {
        this.translationCache.set(normalizedTitle, undefined)
        return undefined
      }

      const payload = (await response.json()) as unknown
      const translated = Array.isArray(payload)
        ? (payload[0] as unknown[])
            .map((part) => (Array.isArray(part) ? part[0] : ''))
            .join('')
            .trim()
        : ''

      const result = translated && translated.toLowerCase() !== normalizedTitle.toLowerCase() ? translated : undefined
      this.translationCache.set(normalizedTitle, result)
      return result
    } catch {
      this.translationCache.set(normalizedTitle, undefined)
      return undefined
    }
  }

  private mapMeta(meta: CinemetaMetaPreview, fallbackType?: 'movie' | 'series'): VodCatalogItemDto {
    return {
      id: meta.id,
      title: meta.name?.trim() || 'Titulo desconhecido',
      type: meta.type === 'series' ? 'series' : fallbackType ?? 'movie',
      posterUrl: meta.poster || undefined,
      description: meta.description?.trim() || undefined,
      year: meta.releaseInfo?.trim() || undefined,
      genres: Array.isArray(meta.genres) ? meta.genres.filter(Boolean) : [],
    }
  }

  private async enrichWithTranslation(item: VodCatalogItemDto): Promise<VodCatalogItemDto> {
    return {
      ...item,
      translatedTitle: await this.translateTitle(item.title),
    }
  }

  private mapTrailers(meta?: CinemetaMetaDetails): VodStreamDto[] {
    if (!meta?.trailerStreams?.length) return []

    const trailers: Array<VodStreamDto | null> = meta.trailerStreams.map((stream, index) => {
      if (stream.source === 'youtube' && stream.ytId) {
        return {
          id: `${meta.id}-trailer-${index + 1}`,
          label: `Trailer ${index + 1}`,
          url: `https://www.youtube.com/watch?v=${stream.ytId}`,
          source: 'youtube',
        }
      }

      return null
    })

    return trailers.filter((item): item is VodStreamDto => item !== null)
  }

  private fallbackByType(type: 'movie' | 'series'): VodCatalogItemDto[] {
    return this.fallbackCatalog[type]
  }

  async catalog(type = 'movie', page = 1, limit = 24, genre?: string): Promise<VodCatalogPageDto> {
    const normalizedType = this.normalizeType(type)
    const normalizedGenre = this.normalizeGenre(genre)
    const safePage = Math.max(1, page)
    const safeLimit = Math.min(50, Math.max(1, limit))
    const skip = (safePage - 1) * safeLimit

    try {
      const path = normalizedGenre
        ? `/catalog/${normalizedType}/top/genre=${encodeURIComponent(normalizedGenre)}.json`
        : skip > 0
          ? `/catalog/${normalizedType}/top/skip=${skip}.json`
          : `/catalog/${normalizedType}/top.json`
      const response = await this.fetchJson<CinemetaCatalogResponse>(path)
      const metas = response.metas ?? []
      if (metas.length === 0) {
        return {
          items: safePage === 1 ? this.fallbackByType(normalizedType) : [],
          page: safePage,
          limit: safeLimit,
          hasMore: false,
        }
      }

      const slicedMetas = normalizedGenre ? metas.slice(skip, skip + safeLimit) : metas.slice(0, safeLimit)

      return {
        items: await Promise.all(slicedMetas.map((meta) => this.enrichWithTranslation(this.mapMeta(meta, normalizedType)))),
        page: safePage,
        limit: safeLimit,
        hasMore: normalizedGenre ? skip + safeLimit < metas.length : response.hasMore ?? metas.length >= safeLimit,
      }
    } catch {
      return {
        items: safePage === 1 ? this.fallbackByType(normalizedType) : [],
        page: safePage,
        limit: safeLimit,
        hasMore: false,
      }
    }
  }

  async search(query: string): Promise<VodCatalogItemDto[]> {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) return []

    const encodedQuery = encodeURIComponent(normalizedQuery)

    const [movieResponse, seriesResponse] = await Promise.all([
      this.fetchJson<CinemetaCatalogResponse>(`/catalog/movie/top/search=${encodedQuery}.json`).catch(() => ({ metas: [] })),
      this.fetchJson<CinemetaCatalogResponse>(`/catalog/series/top/search=${encodedQuery}.json`).catch(() => ({ metas: [] })),
    ])

    const unique = new Map<string, VodCatalogItemDto>()

    for (const meta of movieResponse.metas ?? []) {
      unique.set(meta.id, this.mapMeta(meta, 'movie'))
    }

    for (const meta of seriesResponse.metas ?? []) {
      if (!unique.has(meta.id)) {
        unique.set(meta.id, this.mapMeta(meta, 'series'))
      }
    }

    return Promise.all(Array.from(unique.values()).map((item) => this.enrichWithTranslation(item)))
  }

  async item(id: string): Promise<VodItemDetailsDto> {
    const movieResponse = await this.fetchJson<CinemetaMetaResponse>(`/meta/movie/${encodeURIComponent(id)}.json`).catch(
      () => null,
    )
    const seriesResponse =
      movieResponse?.meta
        ? null
        : await this.fetchJson<CinemetaMetaResponse>(`/meta/series/${encodeURIComponent(id)}.json`).catch(() => null)

    const meta = movieResponse?.meta ?? seriesResponse?.meta

    if (!meta) {
      const fallbackItem =
        this.fallbackCatalog.movie.find((item) => item.id === id) ??
        this.fallbackCatalog.series.find((item) => item.id === id)

      if (fallbackItem) {
        return {
          ...fallbackItem,
          backdropUrl: fallbackItem.posterUrl,
          streams: [],
        }
      }

      throw new InternalServerErrorException('Item nao encontrado no Cinemeta')
    }

    const baseItem = this.mapMeta(meta, meta.type)

    return {
      ...(await this.enrichWithTranslation(baseItem)),
      ...baseItem,
      backdropUrl: meta.background || meta.poster || undefined,
      streams: this.mapTrailers(meta),
    }
  }

  private readonly torrentTrackers = [
    'udp://tracker.openbittorrent.com:80/announce',
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://tracker.leechers-paradise.org:6969/announce',
    'udp://tracker.coppersurfer.tk:6969/announce',
  ]

  private buildTorrentUrl(stream: TorrentioStreamItem): string {
    if (stream.url) return stream.url

    const infoHash = stream.infoHash?.trim()
    if (!infoHash) return ''

    const filename = stream.behaviorHints?.filename || stream.title || stream.name || 'torrent'
    const params = new URLSearchParams({ xt: `urn:btih:${infoHash}`, dn: filename })
    for (const tracker of this.torrentTrackers) {
      params.append('tr', tracker)
    }

    return `magnet:?${params.toString()}`
  }

  private extractStreamSource(stream: TorrentioStreamItem): string | undefined {
    const titleLines = stream.title
      ?.split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    const sourceLine = titleLines?.find((line) => line.includes('⚙'))
    if (sourceLine) {
      const normalized = sourceLine.replace(/^.*⚙️?\s*/, '').trim()
      if (normalized) return normalized
    }

    const addonName = stream.name
      ?.split(/\r?\n/)[0]
      ?.trim()

    return addonName || undefined
  }

  private async searchTorrentioCandidates(item: VodItemDetailsDto): Promise<Array<{ id: string; type: 'movie' | 'series' }>> {
    const queries = new Set<string>()
    queries.add(item.title)
    if (item.translatedTitle) queries.add(item.translatedTitle)
    if (item.id) queries.add(item.id)

    const found = new Map<string, 'movie' | 'series'>()

    for (const query of queries) {
      try {
        const results = await this.torrentioService.search(query)
        for (const result of results) {
          const type = result.type === 'series' ? 'series' : 'movie'
          if (!found.has(result.id)) {
            found.set(result.id, type)
          }
        }
      } catch (error) {
        console.warn('Torrentio search fallback failed', { query, error: (error as Error).message })
      }
    }

    return Array.from(found.entries()).map(([id, type]) => ({ id, type }))
  }

  async streams(id: string): Promise<VodStreamDto[]> {
    const debug = await this.streamsDebug(id)
    return debug.streams
  }

  async streamsDebug(id: string) {
    const item = await this.item(id)
    const preferredType = item.type === 'series' ? 'series' : 'movie'
    const alternateType = preferredType === 'series' ? 'movie' : 'series'

    const buildStreams = (streams: TorrentioStreamItem[]): VodStreamDto[] =>
      streams
        .map((stream) => {
          const fileIdx = stream.fileIdx ?? 0
          const filename = stream.behaviorHints?.filename || stream.title || stream.name || 'torrent'
          const trimmedTitle = stream.title?.trim()
          const trimmedName = stream.name?.trim()
          const label = trimmedTitle && trimmedTitle.length > 0
            ? trimmedTitle
            : trimmedName && trimmedName.length > 0
              ? trimmedName
              : filename
          const url = this.buildTorrentUrl(stream)

          return {
            id: `${stream.infoHash || 'torrent'}-${fileIdx}`,
            label,
            url,
            source: this.extractStreamSource(stream),
          }
        })
        .filter((stream) => stream.url.length > 0)

    const tryTorrentioByType = async (type: string, sourceId: string) => {
      const torrentioResponse = await this.torrentioService.stream(type, sourceId)
      return {
        sourceId,
        type,
        raw: torrentioResponse,
        mapped: buildStreams(torrentioResponse.streams),
      }
    }

    const debugResults: Array<{
      step: string
      type: string
      sourceId: string
      error?: string
      raw?: unknown
      mapped?: VodStreamDto[]
    }> = []

    try {
      const primary = await tryTorrentioByType(preferredType, id)
      debugResults.push({ step: 'primary', type: preferredType, sourceId: id, raw: primary.raw, mapped: primary.mapped })
      if (primary.mapped.length > 0) return { item, streams: primary.mapped, debug: debugResults }
    } catch (error) {
      debugResults.push({ step: 'primary', type: preferredType, sourceId: id, error: (error as Error).message })
    }

    try {
      const fallback = await tryTorrentioByType(alternateType, id)
      debugResults.push({ step: 'alternate', type: alternateType, sourceId: id, raw: fallback.raw, mapped: fallback.mapped })
      if (fallback.mapped.length > 0) return { item, streams: fallback.mapped, debug: debugResults }
    } catch (error) {
      debugResults.push({ step: 'alternate', type: alternateType, sourceId: id, error: (error as Error).message })
    }

    const fallbackCandidates = await this.searchTorrentioCandidates(item)
    debugResults.push({ step: 'candidates', type: 'search', sourceId: item.title, raw: fallbackCandidates })

    for (const candidate of fallbackCandidates) {
      if (candidate.id === id) continue
      try {
        const candidateResult = await tryTorrentioByType(candidate.type, candidate.id)
        debugResults.push({ step: 'candidate', type: candidate.type, sourceId: candidate.id, raw: candidateResult.raw, mapped: candidateResult.mapped })
        if (candidateResult.mapped.length > 0) return { item, streams: candidateResult.mapped, debug: debugResults }
      } catch (error) {
        debugResults.push({ step: 'candidate', type: candidate.type, sourceId: candidate.id, error: (error as Error).message })
      }
    }

    debugResults.push({ step: 'trailerFallback', type: 'local', sourceId: id, mapped: item.streams })
    return { item, streams: item.streams, debug: debugResults }
  }
}
