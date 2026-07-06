package com.iptvagao.tv.data

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class Session(context: Context) {
    private val prefs: SharedPreferences =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            EncryptedSharedPreferences.create(
                context,
                "iptvagao_session_secure",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        } else {
            context.getSharedPreferences("iptvagao_session", Context.MODE_PRIVATE)
        }

    var token: String?
        get() = prefs.getString("token", null)
        set(value) = prefs.edit().putString("token", value).apply()

    var deviceName: String?
        get() = prefs.getString("deviceName", null)
        set(value) = prefs.edit().putString("deviceName", value).apply()

    val bearer: String? get() = token?.let { "Bearer $it" }

    fun clear() = prefs.edit().clear().apply()
}
