package com.iptvagao.tv.ui

import android.view.KeyEvent
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.iptvagao.tv.data.ChannelDto
import kotlinx.coroutines.delay

@Composable
fun PlayerScreen(channels: List<ChannelDto>, startIndex: Int, onExit: () -> Unit) {
    val context = LocalContext.current
    var index by remember { mutableIntStateOf(startIndex) }
    var showOverlay by remember { mutableStateOf(true) }
    var playbackError by remember { mutableStateOf<String?>(null) }
    val focusRequester = remember { FocusRequester() }

    val player = remember {
        ExoPlayer.Builder(context).build().apply { playWhenReady = true }
    }

    DisposableEffect(Unit) {
        val listener = object : Player.Listener {
            override fun onPlayerError(error: PlaybackException) {
                playbackError = "Canal indisponível no momento"
            }
            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_READY) playbackError = null
            }
        }
        player.addListener(listener)
        onDispose {
            player.removeListener(listener)
            player.release()
        }
    }

    LaunchedEffect(index) {
        val channel = channels[index]
        playbackError = null
        player.stop()
        player.clearMediaItems()
        player.setMediaItem(MediaItem.fromUri(channel.url))
        player.prepare()
        showOverlay = true
        delay(4000)
        showOverlay = false
    }

    LaunchedEffect(Unit) { focusRequester.requestFocus() }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .focusRequester(focusRequester)
            .focusable()
            .onKeyEvent { event ->
                if (event.nativeKeyEvent.action != KeyEvent.ACTION_DOWN) return@onKeyEvent false
                when (event.nativeKeyEvent.keyCode) {
                    KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_CHANNEL_UP -> {
                        index = (index + 1) % channels.size
                        true
                    }
                    KeyEvent.KEYCODE_DPAD_DOWN, KeyEvent.KEYCODE_CHANNEL_DOWN -> {
                        index = (index - 1 + channels.size) % channels.size
                        true
                    }
                    KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> {
                        showOverlay = !showOverlay
                        true
                    }
                    KeyEvent.KEYCODE_BACK -> {
                        onExit()
                        true
                    }
                    else -> false
                }
            },
    ) {
        AndroidView(
            factory = {
                PlayerView(it).apply {
                    this.player = player
                    useController = false
                    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                }
            },
            modifier = Modifier.fillMaxSize(),
        )

        playbackError?.let { message ->
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = IptvColors.Surface,
                modifier = Modifier.align(Alignment.Center),
            ) {
                Column(
                    modifier = Modifier.padding(horizontal = 40.dp, vertical = 28.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        message,
                        style = MaterialTheme.typography.headlineSmall,
                        color = IptvColors.TextPrimary,
                    )
                    Text(
                        "Use as setas para trocar de canal ou Voltar para a lista",
                        style = MaterialTheme.typography.bodyMedium,
                        color = IptvColors.Accent,
                        modifier = Modifier.padding(top = 10.dp),
                    )
                }
            }
        }

        // Overlay broadcast: barra inferior com gradiente + info do canal
        if (showOverlay) {
            val channel = channels[index]
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .height(180.dp)
                    .background(
                        Brush.verticalGradient(
                            listOf(Color.Transparent, Color.Black.copy(alpha = 0.85f)),
                        ),
                    ),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(horizontal = 48.dp, vertical = 28.dp),
                ) {
                    ChannelLogo(channel, size = 56.dp)
                    Column(modifier = Modifier.padding(start = 20.dp)) {
                        Text(
                            channel.name,
                            style = MaterialTheme.typography.headlineMedium,
                            color = IptvColors.TextPrimary,
                        )
                        Text(
                            listOfNotNull(
                                channel.category?.name?.replace(";", " / "),
                                "${index + 1}/${channels.size}",
                            ).joinToString("  •  "),
                            style = MaterialTheme.typography.bodyLarge,
                            color = IptvColors.Accent,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                        channel.epgNow?.let { program ->
                            Text(
                                "Agora: ${program.title}",
                                style = MaterialTheme.typography.bodyMedium,
                                color = IptvColors.TextSecondary,
                                modifier = Modifier.padding(top = 2.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}
