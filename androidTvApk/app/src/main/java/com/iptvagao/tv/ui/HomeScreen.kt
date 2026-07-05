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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
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

    LaunchedEffect(Unit) {
        availableUpdate = UpdateManager.checkForUpdate()
    }

    fun startUpdate(release: AppReleaseDto) {
        downloading = true
        updateError = null
        scope.launch {
            try {
                UpdateManager.downloadAndInstall(context, release) { progress -> downloadProgress = progress }
            } catch (e: Exception) {
                updateError = "Falha ao baixar atualização. Tente novamente."
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
                // Segurança: em telas menores/mais densas o conteúdo (tiles + banner de update) pode não caber
                .verticalScroll(rememberScrollState()),
        ) {
            Text(
                "Olá, ${session.deviceName ?: "TV"}",
                style = MaterialTheme.typography.headlineLarge,
                color = IptvColors.TextPrimary,
                modifier = Modifier.padding(top = 48.dp),
            )
            Text(
                "O que vamos assistir?",
                style = MaterialTheme.typography.bodyLarge,
                color = IptvColors.TextSecondary,
                modifier = Modifier.padding(top = 4.dp, bottom = 40.dp),
            )

            Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                HomeTile(
                    title = "TV ao Vivo",
                    icon = Icons.Filled.Tv,
                    modifier = Modifier.size(width = 280.dp, height = 320.dp),
                    autoFocus = true,
                    onClick = onSelectLive,
                )
                Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                    HomeTile(
                        title = "Favoritos",
                        icon = Icons.Filled.Star,
                        modifier = Modifier.size(width = 280.dp, height = 150.dp),
                        onClick = onSelectFavorites,
                    )
                    HomeTile(
                        title = "Filmes & Séries",
                        icon = Icons.Filled.Movie,
                        modifier = Modifier.size(width = 280.dp, height = 150.dp),
                        onClick = onSelectVod,
                    )
                }
                HomeTile(
                    title = "Conta",
                    icon = Icons.Filled.AccountCircle,
                    modifier = Modifier.size(width = 280.dp, height = 320.dp),
                    onClick = onSelectAccount,
                )
            }

            availableUpdate?.let { release ->
                UpdateBanner(
                    release = release,
                    downloading = downloading,
                    progress = downloadProgress,
                    error = updateError,
                    onUpdateClick = { startUpdate(release) },
                )
            }

            Box(Modifier.padding(bottom = 32.dp))
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
            .padding(top = 32.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(IptvColors.Surface)
            .padding(horizontal = 24.dp, vertical = 16.dp),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                if (release.mandatory) "Atualização obrigatória disponível: ${release.versionName}" else "Atualização disponível: ${release.versionName}",
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
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        if (autoFocus) focusRequester.requestFocus()
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
            .focusRequester(focusRequester)
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
