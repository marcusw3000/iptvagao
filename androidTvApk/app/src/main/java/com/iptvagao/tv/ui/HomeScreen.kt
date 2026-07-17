package com.iptvagao.tv.ui

import android.view.KeyEvent
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.SystemUpdate
import androidx.compose.material.icons.filled.Tv
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.iptvagao.tv.BuildConfig
import com.iptvagao.tv.data.AppReleaseDto
import com.iptvagao.tv.data.Session
import com.iptvagao.tv.data.UpdateManager
import kotlinx.coroutines.launch

@Composable
fun HomeScreen(
    session: Session,
    onSelectLive: () -> Unit,
    onSelectFavorites: () -> Unit,
    onSelectVod: () -> Unit,
    onSelectAccount: () -> Unit,
) {
    var availableUpdate by remember { mutableStateOf<AppReleaseDto?>(null) }
    var downloading by remember { mutableStateOf(false) }
    var downloadProgress by remember { mutableFloatStateOf(0f) }
    var updateError by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val liveFocusRequester = remember { FocusRequester() }
    val favoritesFocusRequester = remember { FocusRequester() }
    val vodFocusRequester = remember { FocusRequester() }
    val accountFocusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        availableUpdate = UpdateManager.checkForUpdate()
    }

    fun startUpdate(release: AppReleaseDto) {
        downloading = true
        updateError = null
        scope.launch {
            try {
                UpdateManager.downloadAndInstall(context, release) { progress -> downloadProgress = progress }
            } catch (_: Exception) {
                updateError = "Falha ao baixar atualizacao. Tente novamente."
            } finally {
                downloading = false
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(IptvColors.Background, IptvColors.BackgroundAlt))),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 64.dp)
                .verticalScroll(rememberScrollState()),
        ) {
            Text(
                "Ola, ${session.deviceName ?: "TV"}",
                style = MaterialTheme.typography.headlineMedium,
                color = IptvColors.TextPrimary,
                modifier = Modifier.padding(top = 28.dp),
            )
            Text(
                "O que vamos assistir?",
                style = MaterialTheme.typography.bodyLarge,
                color = IptvColors.TextSecondary,
                modifier = Modifier.padding(top = 4.dp, bottom = 20.dp),
            )

            val mandatoryUpdate = availableUpdate?.takeIf { it.mandatory }
            if (mandatoryUpdate != null) {
                MandatoryUpdatePanel(
                    release = mandatoryUpdate,
                    downloading = downloading,
                    progress = downloadProgress,
                    error = updateError,
                    onUpdateClick = { startUpdate(mandatoryUpdate) },
                )
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    HomeTile(
                        title = "TV ao Vivo",
                        icon = Icons.Filled.Tv,
                        modifier = Modifier
                            .size(width = 260.dp, height = 260.dp)
                            .focusProperties {
                                right = favoritesFocusRequester
                                down = vodFocusRequester
                            },
                        focusRequester = liveFocusRequester,
                        autoFocus = true,
                        onClick = onSelectLive,
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        HomeTile(
                            title = "Favoritos",
                            icon = Icons.Filled.Star,
                            modifier = Modifier
                                .size(width = 260.dp, height = 122.dp)
                                .focusProperties {
                                    left = liveFocusRequester
                                    right = accountFocusRequester
                                    down = vodFocusRequester
                                },
                            focusRequester = favoritesFocusRequester,
                            onClick = onSelectFavorites,
                        )
                        HomeTile(
                            title = "Filmes & Series",
                            icon = Icons.Filled.Movie,
                            modifier = Modifier
                                .size(width = 260.dp, height = 122.dp)
                                .focusProperties {
                                    up = favoritesFocusRequester
                                    left = liveFocusRequester
                                    right = accountFocusRequester
                                },
                            focusRequester = vodFocusRequester,
                            onClick = onSelectVod,
                        )
                    }
                    HomeTile(
                        title = "Conta",
                        icon = Icons.Filled.AccountCircle,
                        modifier = Modifier
                            .size(width = 260.dp, height = 260.dp)
                            .focusProperties {
                                left = favoritesFocusRequester
                                down = vodFocusRequester
                            },
                        focusRequester = accountFocusRequester,
                        onClick = onSelectAccount,
                    )
                }
            }

            availableUpdate?.takeIf { !it.mandatory }?.let { release ->
                UpdateBanner(
                    release = release,
                    downloading = downloading,
                    progress = downloadProgress,
                    error = updateError,
                    onUpdateClick = { startUpdate(release) },
                )
            }

            Box(Modifier.padding(bottom = 20.dp))
        }
    }
}

@Composable
private fun MandatoryUpdatePanel(
    release: AppReleaseDto,
    downloading: Boolean,
    progress: Float,
    error: String?,
    onUpdateClick: () -> Unit,
) {
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        if (!downloading) {
          runCatching { focusRequester.requestFocus() }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(IptvColors.Surface)
            .border(1.dp, IptvColors.Accent.copy(alpha = 0.4f), RoundedCornerShape(24.dp))
            .padding(horizontal = 28.dp, vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            Icons.Filled.SystemUpdate,
            contentDescription = null,
            tint = IptvColors.Accent,
            modifier = Modifier.size(44.dp),
        )
        Text(
            "Atualizacao obrigatoria disponivel",
            style = MaterialTheme.typography.headlineSmall,
            color = IptvColors.TextPrimary,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Versao instalada: ${BuildConfig.VERSION_NAME} · Nova versao: ${release.versionName}",
            style = MaterialTheme.typography.bodyLarge,
            color = IptvColors.TextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
        Text(
            "Este app precisa ser atualizado antes de continuar usando TV ao vivo, favoritos ou filmes e series.",
            style = MaterialTheme.typography.bodyMedium,
            color = IptvColors.TextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 12.dp),
        )
        release.changelog?.takeIf { it.isNotBlank() }?.let {
            Text(
                it,
                style = MaterialTheme.typography.bodyMedium,
                color = IptvColors.Accent,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 12.dp),
            )
        }
        if (downloading) {
            LinearProgressIndicator(
                progress = { progress },
                color = IptvColors.Accent,
                modifier = Modifier.padding(top = 18.dp).fillMaxWidth(),
            )
        } else {
            Button(
                onClick = onUpdateClick,
                modifier = Modifier
                    .padding(top = 18.dp)
                    .focusRequester(focusRequester),
            ) {
                Text("Atualizar agora")
            }
        }
        error?.let {
            Text(
                it,
                style = MaterialTheme.typography.bodyMedium,
                color = Color(0xFFF87171),
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 10.dp),
            )
        }
    }
}

@Composable
private fun UpdateBanner(
    release: AppReleaseDto,
    downloading: Boolean,
    progress: Float,
    error: String?,
    onUpdateClick: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .padding(top = 20.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(IptvColors.Surface)
            .padding(horizontal = 20.dp, vertical = 12.dp),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                "Atualizacao disponivel: ${release.versionName}",
                style = MaterialTheme.typography.bodyLarge,
                color = IptvColors.TextPrimary,
            )
            release.changelog?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium, color = IptvColors.TextSecondary)
            }
            if (downloading) {
                LinearProgressIndicator(
                    progress = { progress },
                    color = IptvColors.Accent,
                    modifier = Modifier.padding(top = 8.dp).fillMaxWidth(),
                )
            }
            error?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium, color = Color(0xFFF87171), modifier = Modifier.padding(top = 4.dp))
            }
        }
        if (!downloading) {
            Button(onClick = onUpdateClick, modifier = Modifier.padding(start = 16.dp)) {
                Text("Atualizar")
            }
        }
    }
}

@Composable
private fun HomeTile(
    title: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    focusRequester: FocusRequester? = null,
    autoFocus: Boolean = false,
    onClick: () -> Unit,
) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val scale by animateFloatAsState(
        targetValue = if (focused) 1.05f else 1f,
        animationSpec = tween(durationMillis = 180),
        label = "tileScale",
    )
    val resolvedFocusRequester = focusRequester ?: remember { FocusRequester() }

    LaunchedEffect(Unit) {
        if (autoFocus) resolvedFocusRequester.requestFocus()
    }

    Column(
        modifier = modifier
            .graphicsLayer { scaleX = scale; scaleY = scale }
            .clip(RoundedCornerShape(16.dp))
            .background(if (focused) IptvColors.SurfaceFocused else IptvColors.Surface)
            .border(
                width = 2.dp,
                color = if (focused) IptvColors.Accent else Color.Transparent,
                shape = RoundedCornerShape(16.dp),
            )
            .focusRequester(resolvedFocusRequester)
            .focusable(interactionSource = interaction)
            .onKeyEvent { event ->
                val isSelectKey = event.nativeKeyEvent.keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
                    event.nativeKeyEvent.keyCode == KeyEvent.KEYCODE_ENTER
                if (isSelectKey && event.nativeKeyEvent.action == KeyEvent.ACTION_UP) {
                    onClick()
                    true
                } else {
                    isSelectKey
                }
            }
            .pointerInput(title) { detectTapGestures(onTap = { onClick() }) },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = if (focused) IptvColors.Accent else IptvColors.TextSecondary,
            modifier = Modifier.size(56.dp),
        )
        Text(
            title,
            style = MaterialTheme.typography.titleLarge,
            color = IptvColors.TextPrimary,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 16.dp),
        )
    }
}
