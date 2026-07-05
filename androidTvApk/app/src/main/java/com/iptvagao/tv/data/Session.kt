package com.iptvagao.tv.data

import android.content.Context
import android.content.SharedPreferences

class Session(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("iptvagao_session", Context.MODE_PRIVATE)

    var token: String?
        get() = prefs.getString("token", null)
        set(value) = prefs.edit().putString("token", value).apply()

    var deviceName: String?
        get() = prefs.getString("deviceName", null)
        set(value) = prefs.edit().putString("deviceName", value).apply()

    val bearer: String? get() = token?.let { "Bearer $it" }

    fun clear() = prefs.edit().clear().apply()
}
