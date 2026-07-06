import { Injectable, InternalServerErrorException } from '@nestjs/common'

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

    return meta.trailerStreams
      .map((stream, index) => {
        if (stream.source === 'youtube' && stream.ytId) {
          return {
            id: `${meta.id}-trailer-${index + 1}`,
            label: `Trailer ${index + 1}`,
            url: `https://www.youtube.com/watch?v=${stream.ytId}`,
          }
        }

        return null
      })
      .filter((item): item is VodStreamDto => item !== null)
  }

  private fallbackByType(type: 'movie' | 'series'): VodCatalogItemDto[] {
    return this.fallbackCatalog[type]
  }

  async catalog(type = 'movie', page = 1, limit = 24): Promise<VodCatalogPageDto> {
    const normalizedType = this.normalizeType(type)
    const safePage = Math.max(1, page)
    const safeLimit = Math.min(50, Math.max(1, limit))
    const skip = (safePage - 1) * safeLimit

    try {
      const path =
        skip > 0 ? `/catalog/${normalizedType}/top/skip=${skip}.json` : `/catalog/${normalizedType}/top.json`
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

      const slicedMetas = metas.slice(0, safeLimit)

      return {
        items: await Promise.all(slicedMetas.map((meta) => this.enrichWithTranslation(this.mapMeta(meta, normalizedType)))),
        page: safePage,
        limit: safeLimit,
        hasMore: response.hasMore ?? metas.length >= safeLimit,
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

  async streams(id: string): Promise<VodStreamDto[]> {
    const item = await this.item(id)
    return item.streams
  }
}
