package com.iptvagao.tv.data

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import com.iptvagao.tv.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

object UpdateManager {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.MINUTES)
        .build()

    // Retorna a versão publicada se for mais nova que a instalada, senão null
    suspend fun checkForUpdate(): AppReleaseDto? {
        return try {
            val release = Api.service.latestRelease()
            if (release.versionCode > BuildConfig.VERSION_CODE) release else null
        } catch (e: Exception) {
            null
        }
    }

    suspend fun downloadAndInstall(context: Context, release: AppReleaseDto, onProgress: (Float) -> Unit) {
        withContext(Dispatchers.IO) {
            val request = Request.Builder().url(release.apkUrl).build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) throw IOException("Download falhou: ${response.code}")
                val body = response.body ?: throw IOException("Resposta vazia")
                val total = body.contentLength()

                val updatesDir = File(context.cacheDir, "updates").apply { mkdirs() }
                val file = File(updatesDir, "update-${release.versionCode}.apk")

                body.byteStream().use { input ->
                    file.outputStream().use { output ->
                        val buffer = ByteArray(8 * 1024)
                        var downloaded = 0L
                        var read: Int
                        while (input.read(buffer).also { read = it } != -1) {
                            output.write(buffer, 0, read)
                            downloaded += read
                            if (total > 0) onProgress(downloaded.toFloat() / total)
                        }
                    }
                }

                withContext(Dispatchers.Main) { installApk(context, file) }
            }
        }
    }

    private fun installApk(context: Context, file: File) {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }
}
