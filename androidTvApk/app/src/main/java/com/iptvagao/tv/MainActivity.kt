package com.iptvagao.tv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.iptvagao.tv.data.Api
import com.iptvagao.tv.data.ChannelDto
import com.iptvagao.tv.data.Session
import com.iptvagao.tv.ui.ChannelsScreen
import com.iptvagao.tv.ui.PairingScreen
import com.iptvagao.tv.ui.PlayerScreen
import kotlinx.coroutines.delay

private const val HEARTBEAT_INTERVAL_MS = 60_000L

sealed interface Screen {
    data object Pairing : Screen
    data object Channels : Screen
    data class Player(val channels: List<ChannelDto>, val index: Int) : Screen
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val session = Session(this)

        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                Box(Modifier.fillMaxSize().background(Color(0xFF0F172A))) {
                    App(session)
                }
            }
        }
    }
}

@Composable
private fun App(session: Session) {
    var screen by remember {
        mutableStateOf<Screen>(if (session.token == null) Screen.Pairing else Screen.Channels)
    }
    var blockedMessage by remember { mutableStateOf<String?>(null) }

    // Heartbeat: mantém device online no painel e respeita limite de TVs simultâneas
    LaunchedEffect(screen is Screen.Pairing) {
        if (screen is Screen.Pairing) return@LaunchedEffect
        while (true) {
            try {
                Api.service.heartbeat(session.bearer ?: "")
                blockedMessage = null
            } catch (e: retrofit2.HttpException) {
                when (e.code()) {
                    401 -> {
                        session.clear()
                        screen = Screen.Pairing
                    }
                    403 -> blockedMessage = "Limite de TVs simultâneas atingido ou dispositivo desativado."
                }
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (_: Exception) {
                // sem rede: tenta de novo no próximo ciclo
            }
            delay(HEARTBEAT_INTERVAL_MS)
        }
    }

    when (val current = screen) {
        is Screen.Pairing -> PairingScreen(session) { screen = Screen.Channels }
        is Screen.Channels -> ChannelsScreen(
            session = session,
            onSessionExpired = { screen = Screen.Pairing },
        ) { channels, index ->
            screen = Screen.Player(channels, index)
        }
        is Screen.Player -> {
            BackHandler { screen = Screen.Channels }
            PlayerScreen(current.channels, current.index) { screen = Screen.Channels }
        }
    }

    blockedMessage?.let { message ->
        Box(Modifier.fillMaxSize().background(Color(0xE60F172A))) {
            androidx.compose.material3.Text(
                message,
                style = MaterialTheme.typography.headlineSmall,
                color = Color.White,
                modifier = Modifier.align(androidx.compose.ui.Alignment.Center),
            )
        }
    }
}
