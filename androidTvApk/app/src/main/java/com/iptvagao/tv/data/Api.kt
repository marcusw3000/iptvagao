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
