package com.iptvagao.tv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
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
import com.iptvagao.tv.ui.AccountScreen
import com.iptvagao.tv.ui.ChannelsScreen
import com.iptvagao.tv.ui.HomeScreen
import com.iptvagao.tv.ui.IptvColors
import com.iptvagao.tv.ui.IptvTheme
import com.iptvagao.tv.ui.PairingScreen
import com.iptvagao.tv.ui.PlayerScreen
import com.iptvagao.tv.ui.VodScreen
import kotlinx.coroutines.delay

private const val HEARTBEAT_INTERVAL_MS = 60_000L

sealed interface Screen {
    data object Pairing : Screen
    data object Home : Screen
    data class Channels(val favoritesOnly: Boolean = false) : Screen
    data class Player(val channels: List<ChannelDto>, val index: Int, val favoritesOnly: Boolean = false) : Screen
    data object Account : Screen
    data object Vod : Screen
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val session = Session(this)

        setContent {
            IptvTheme {
                Box(Modifier.fillMaxSize().background(IptvColors.Background)) {
                    App(session)
                }
            }
        }
    }
}

@Composable
private fun App(session: Session) {
    var screen by remember {
        mutableStateOf<Screen>(if (session.token == null) Screen.Pairing else Screen.Home)
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
        is Screen.Pairing -> PairingScreen(session) { screen = Screen.Home }

        is Screen.Home -> {
            HomeScreen(
                session = session,
                onSelectLive = { screen = Screen.Channels(favoritesOnly = false) },
                onSelectFavorites = { screen = Screen.Channels(favoritesOnly = true) },
                onSelectVod = { screen = Screen.Vod },
                onSelectAccount = { screen = Screen.Account },
            )
        }

        is Screen.Channels -> {
            BackHandler { screen = Screen.Home }
            ChannelsScreen(
                session = session,
                onSessionExpired = { screen = Screen.Pairing },
                startWithFavoritesOnly = current.favoritesOnly,
                onPlay = { channels, index ->
                    screen = Screen.Player(
                        channels = channels,
                        index = index,
                        favoritesOnly = current.favoritesOnly,
                    )
                },
            )
        }

        is Screen.Player -> {
            BackHandler { screen = Screen.Channels(current.favoritesOnly) }
            PlayerScreen(current.channels, current.index) { screen = Screen.Channels(current.favoritesOnly) }
        }

        is Screen.Account -> {
            BackHandler { screen = Screen.Home }
            AccountScreen(
                session = session,
                onBack = { screen = Screen.Home },
                onLogout = { screen = Screen.Pairing },
            )
        }

        is Screen.Vod -> {
            BackHandler { screen = Screen.Home }
            VodScreen(session = session, onBack = { screen = Screen.Home })
        }
    }

    blockedMessage?.let { message ->
        Box(Modifier.fillMaxSize().background(IptvColors.Background.copy(alpha = 0.92f))) {
            androidx.compose.material3.Text(
                message,
                style = MaterialTheme.typography.headlineSmall,
                color = Color.White,
                modifier = Modifier.align(androidx.compose.ui.Alignment.Center),
            )
        }
    }
}
