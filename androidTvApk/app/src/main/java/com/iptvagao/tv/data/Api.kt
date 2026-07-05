package com.iptvagao.tv.data

import com.iptvagao.tv.BuildConfig
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
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

data class ChannelDto(
    val id: String,
    val name: String,
    val url: String,
    val logoUrl: String?,
    val order: Int,
    val active: Boolean,
    val category: CategoryDto?,
)

data class DeviceDto(
    val id: String,
    val clientId: String,
    val name: String,
    val activated: Boolean,
)

// --- Retrofit service ---

interface TvApi {
    @POST("tv/activate")
    suspend fun activate(@Body body: ActivateRequest): ActivateResponse

    @GET("tv/channels")
    suspend fun channels(@Header("Authorization") bearer: String): List<ChannelDto>

    @POST("tv/heartbeat")
    suspend fun heartbeat(@Header("Authorization") bearer: String): DeviceDto
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
