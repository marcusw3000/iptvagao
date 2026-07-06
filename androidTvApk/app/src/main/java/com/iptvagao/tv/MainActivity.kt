package com.iptvagao.tv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
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
import retrofit2.HttpException

private const val HEARTBEAT_INTERVAL_MS = 60_000L
private const val OFFLINE_FAILURE_THRESHOLD = 3

sealed interface Screen {
    data object Pairing : Screen
    data object Home : Screen
    data class Channels(val favoritesOnly: Boolean = false) : Screen
    data class Player(val channels: List<ChannelDto>, val index: Int, val favoritesOnly: Boolean = false) : Screen
    data object Account : Screen
    data object Vod : Screen
}

private data class AppAlertState(
    val title: String,
    val message: String,
    val actionLabel: String,
)

private fun extractApiErrorMessage(error: HttpException): String? {
    val raw = try {
        error.response()?.errorBody()?.string()
    } catch (_: Exception) {
        null
    } ?: return null

    val match = Regex("\"message\"\\s*:\\s*\"([^\"]+)\"").find(raw)
    return match?.groupValues?.getOrNull(1) ?: raw
}

private fun alertFromForbidden(message: String): AppAlertState {
    val normalized = message.lowercase()
    return when {
        "suspensa" in normalized || "cancelada" in normalized -> AppAlertState(
            title = "Assinatura indisponível",
            message = "Sua assinatura está suspensa ou cancelada. Regularize o acesso no portal para continuar.",
            actionLabel = "Entendi",
        )
        "limite" in normalized -> AppAlertState(
            title = "Limite de TVs atingido",
            message = "Já existe outro dispositivo usando o plano neste momento. Feche a outra TV ou aumente o limite do plano.",
            actionLabel = "Tentar novamente",
        )
        else -> AppAlertState(
            title = "Acesso bloqueado",
            message = message,
            actionLabel = "Tentar novamente",
        )
    }
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
    var alertState by remember { mutableStateOf<AppAlertState?>(null) }
    var networkFailures by remember { mutableIntStateOf(0) }

    LaunchedEffect(screen is Screen.Pairing) {
        if (screen is Screen.Pairing) {
            alertState = null
            networkFailures = 0
            return@LaunchedEffect
        }

        while (true) {
            try {
                Api.service.heartbeat(session.bearer ?: "")
                alertState = null
                networkFailures = 0
            } catch (e: HttpException) {
                when (e.code()) {
                    401 -> {
                        session.clear()
                        alertState = null
                        screen = Screen.Pairing
                    }
                    403 -> {
                        val apiMessage = extractApiErrorMessage(e) ?: "O dispositivo foi bloqueado pelo backend."
                        alertState = alertFromForbidden(apiMessage)
                    }
                }
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (_: Exception) {
                networkFailures += 1
                if (networkFailures >= OFFLINE_FAILURE_THRESHOLD) {
                    alertState = AppAlertState(
                        title = "Sem conexão com a API",
                        message = "O app não consegue falar com o backend ${BuildConfig.API_ENVIRONMENT}. Verifique a rede ou a URL configurada em ${BuildConfig.API_BASE_URL}.",
                        actionLabel = "Continuar tentando",
                    )
                }
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

    alertState?.let { state ->
        AppAlertOverlay(
            title = state.title,
            message = state.message,
            actionLabel = state.actionLabel,
            onAction = { alertState = null },
        )
    }
}

@Composable
private fun AppAlertOverlay(
    title: String,
    message: String,
    actionLabel: String,
    onAction: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(IptvColors.Background.copy(alpha = 0.94f)),
        contentAlignment = Alignment.Center,
    ) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = IptvColors.Surface,
            modifier = Modifier.padding(horizontal = 36.dp),
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 32.dp, vertical = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    title,
                    style = MaterialTheme.typography.headlineMedium,
                    color = Color.White,
                    textAlign = TextAlign.Center,
                )
                Text(
                    message,
                    style = MaterialTheme.typography.bodyLarge,
                    color = IptvColors.TextSecondary,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 14.dp),
                )
                Button(
                    onClick = onAction,
                    modifier = Modifier.padding(top = 24.dp),
                ) {
                    Text(actionLabel)
                }
            }
        }
    }
}
