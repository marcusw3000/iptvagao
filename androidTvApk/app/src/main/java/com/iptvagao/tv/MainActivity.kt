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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.iptvagao.tv.data.Api
import com.iptvagao.tv.data.ChannelDto
import com.iptvagao.tv.data.Session
import com.iptvagao.tv.data.TvApiError
import com.iptvagao.tv.data.toTvApiError
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
    val onAction: (() -> Unit)? = null,
)

private fun alertFromApiError(error: TvApiError): AppAlertState {
    return when (error.code) {
        "SUBSCRIPTION_INACTIVE" -> AppAlertState(
            title = "Assinatura indisponivel",
            message = "Sua assinatura esta suspensa ou cancelada. Regularize o acesso no portal para continuar.",
            actionLabel = "Entendi",
        )
        "TV_LIMIT_REACHED" -> AppAlertState(
            title = "Limite de TVs atingido",
            message = "Ja existe outro dispositivo usando o plano neste momento. Feche a outra TV ou aumente o limite do plano.",
            actionLabel = "Tentar novamente",
        )
        "DEVICE_REVOKED" -> AppAlertState(
            title = "Dispositivo desativado",
            message = "Esta TV foi revogada no portal ou perdeu a ativacao. Faca a ativacao novamente para continuar.",
            actionLabel = "Ir para ativacao",
        )
        "DEVICE_TOKEN_INVALID", "DEVICE_TOKEN_MISSING" -> AppAlertState(
            title = "Sessao expirada",
            message = "A sessao deste dispositivo nao e mais valida. Faca a ativacao novamente para continuar.",
            actionLabel = "Ir para ativacao",
        )
        else -> AppAlertState(
            title = "Acesso bloqueado",
            message = error.message ?: "O backend bloqueou o acesso deste dispositivo.",
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
            networkFailures = 0
            return@LaunchedEffect
        }

        while (true) {
            try {
                Api.service.heartbeat(session.bearer ?: "")
                alertState = null
                networkFailures = 0
            } catch (e: HttpException) {
                val apiError = e.toTvApiError()
                when (e.code()) {
                    401 -> {
                        alertState = alertFromApiError(apiError).copy(
                            onAction = {
                                session.clear()
                                screen = Screen.Pairing
                            },
                        )
                    }
                    403 -> {
                        alertState = alertFromApiError(apiError)
                    }
                }
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (_: Exception) {
                networkFailures += 1
                if (networkFailures >= OFFLINE_FAILURE_THRESHOLD) {
                    alertState = AppAlertState(
                        title = "Sem conexao com a API",
                        message = "O app nao consegue falar com o backend ${BuildConfig.API_ENVIRONMENT}. Verifique a rede ou a URL configurada em ${BuildConfig.API_BASE_URL}.",
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
                onSessionExpired = { apiError ->
                    val nextAlert = apiError?.let(::alertFromApiError)
                    if (nextAlert != null) {
                        alertState = nextAlert.copy(onAction = { screen = Screen.Pairing })
                    } else {
                        screen = Screen.Pairing
                    }
                },
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
            onAction = {
                val action = state.onAction
                alertState = null
                action?.invoke()
            },
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
    val actionFocusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        actionFocusRequester.requestFocus()
    }

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
                    modifier = Modifier
                        .padding(top = 24.dp)
                        .focusRequester(actionFocusRequester),
                ) {
                    Text(actionLabel)
                }
            }
        }
    }
}
