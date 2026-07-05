package com.iptvagao.tv.ui

import android.view.KeyEvent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.foundation.focusable
import androidx.media3.common.MediaItem
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
    val focusRequester = remember { FocusRequester() }

    val player = remember {
        ExoPlayer.Builder(context).build().apply { playWhenReady = true }
    }

    DisposableEffect(Unit) {
        onDispose { player.release() }
    }

    LaunchedEffect(index) {
        val channel = channels[index]
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

        if (showOverlay) {
            Column(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(32.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0xCC0F172A))
                    .padding(horizontal = 20.dp, vertical = 12.dp),
            ) {
                Text(
                    channels[index].name,
                    style = MaterialTheme.typography.headlineSmall,
                    color = Color.White,
                )
                Text(
                    channels[index].category?.name ?: "",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFF94A3B8),
                )
            }
        }
    }
}
