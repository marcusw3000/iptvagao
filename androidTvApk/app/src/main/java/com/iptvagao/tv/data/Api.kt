package com.iptvagao.tv.data

import com.iptvagao.tv.BuildConfig
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query
import java.util.concurrent.TimeUnit

// --- DTOs ---

data class ActivateRequest(
    val activationCode: String,
    val deviceInfo: String? = null,
)

data class ActivateResponse(
    val token: String,
    val deviceId: String,
    val deviceName: String,
)

data class CategoryDto(
    val id: String,
    val name: String,
)

data class EpgProgramDto(
    val title: String,
    val startTime: String,
    val endTime: String,
)

data class ChannelDto(
    val id: String,
    val name: String,
    val url: String,
    val logoUrl: String?,
    val order: Int,
    val active: Boolean,
    val category: CategoryDto?,
    val isFavorite: Boolean = false,
    val epgNow: EpgProgramDto? = null,
    val epgNext: EpgProgramDto? = null,
)

data class DeviceDto(
    val id: String,
    val clientId: String,
    val name: String,
    val activated: Boolean,
)

data class FavoriteResponse(
    val channelId: String,
    val isFavorite: Boolean,
)

data class AccountResponse(
    val clientName: String,
    val planName: String?,
    val subscriptionStatus: String?,
    val subscriptionEndDate: String?,
)

data class AppReleaseDto(
    val versionCode: Int,
    val versionName: String,
    val apkUrl: String,
    val changelog: String?,
    val mandatory: Boolean,
)

data class TorrentioManifestResponse(
    val id: String,
    val version: String,
    val name: String,
    val description: String,
    val background: String?,
    val logo: String?,
    val catalogs: List<Any>?,
    val resources: List<Any>?,
    val types: List<String>?,
)

data class TorrentioCatalogItem(
    val id: String,
    val title: String,
    val type: String,
    val posterUrl: String?,
    val description: String?,
    val year: String?,
    val imdbId: String,
)

data class TorrentioStreamItem(
    val name: String?,
    val title: String?,
    val infoHash: String?,
    val fileIdx: Int?,
    val behaviorHints: Map<String, String>?,
)

data class TorrentioStreamResponse(
    val streams: List<TorrentioStreamItem>,
)

data class VodCatalogItemDto(
    val id: String,
    val title: String,
    val translatedTitle: String?,
    val type: String,
    val posterUrl: String?,
    val description: String?,
    val year: String?,
    val genres: List<String>,
)

data class VodCatalogResponse(
    val items: List<VodCatalogItemDto>,
    val page: Int,
    val limit: Int,
    val hasMore: Boolean,
)

data class VodStreamDto(
    val id: String,
    val label: String,
    val url: String,
    val source: String?,
)

data class VodEpisodeDto(
    val id: String,
    val title: String,
    val season: Int,
    val episode: Int,
    val description: String?,
    val thumbnailUrl: String?,
    val released: String?,
)

data class VodItemDetailsDto(
    val id: String,
    val title: String,
    val translatedTitle: String?,
    val type: String,
    val posterUrl: String?,
    val backdropUrl: String?,
    val description: String?,
    val year: String?,
    val genres: List<String>,
    val streams: List<VodStreamDto>,
    val episodes: List<VodEpisodeDto>,
)

data class VodStreamsResponse(
    val streams: List<VodStreamDto>,
)

// --- Retrofit service ---

interface TvApi {
    @POST("tv/activate")
    suspend fun activate(@Body body: ActivateRequest): ActivateResponse

    @GET("tv/channels")
    suspend fun channels(@Header("Authorization") bearer: String): List<ChannelDto>

    @POST("tv/heartbeat")
    suspend fun heartbeat(@Header("Authorization") bearer: String): DeviceDto

    @POST("tv/favorites/{channelId}")
    suspend fun addFavorite(@Header("Authorization") bearer: String, @Path("channelId") channelId: String): FavoriteResponse

    @DELETE("tv/favorites/{channelId}")
    suspend fun removeFavorite(@Header("Authorization") bearer: String, @Path("channelId") channelId: String): FavoriteResponse

    @GET("tv/account")
    suspend fun account(@Header("Authorization") bearer: String): AccountResponse

    @GET("app-releases/latest")
    suspend fun latestRelease(): AppReleaseDto

    @GET("tv/torrentio/manifest")
    suspend fun torrentioManifest(@Header("Authorization") bearer: String): TorrentioManifestResponse

    @GET("tv/torrentio/catalog")
    suspend fun torrentioCatalog(
        @Header("Authorization") bearer: String,
        @Query("type") type: String,
        @Query("page") page: Int = 1,
    ): List<TorrentioCatalogItem>

    @GET("tv/torrentio/search")
    suspend fun torrentioSearch(
        @Header("Authorization") bearer: String,
        @Query("q") query: String,
    ): List<TorrentioCatalogItem>

    @GET("tv/torrentio/stream")
    suspend fun torrentioStream(
        @Header("Authorization") bearer: String,
        @Query("type") type: String,
        @Query("id") id: String,
        @Query("quality") quality: String? = null,
    ): TorrentioStreamResponse

    @GET("tv/vod/catalog")
    suspend fun vodCatalog(
        @Header("Authorization") bearer: String,
        @Query("type") type: String,
        @Query("page") page: Int,
        @Query("limit") limit: Int = 24,
        @Query("genre") genre: String? = null,
    ): VodCatalogResponse

    @GET("tv/vod/search")
    suspend fun vodSearch(
        @Header("Authorization") bearer: String,
        @Query("q") query: String,
    ): List<VodCatalogItemDto>

    @GET("tv/vod/item/{id}")
    suspend fun vodItem(
        @Header("Authorization") bearer: String,
        @Path("id") id: String,
        @Query("type") type: String? = null,
    ): VodItemDetailsDto

    @GET("tv/vod/streams/{id}")
    suspend fun vodStreams(
        @Header("Authorization") bearer: String,
        @Path("id") id: String,
        @Query("videoId") videoId: String? = null,
        @Query("type") type: String? = null,
    ): VodStreamsResponse
}

object Api {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    val service: TvApi = Retrofit.Builder()
        .baseUrl(BuildConfig.API_BASE_URL.trimEnd('/') + "/")
        .client(client)
        .addConverterFactory(GsonConverterFactory.create())
        .build()
        .create(TvApi::class.java)
}
