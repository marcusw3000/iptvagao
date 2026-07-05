package com.iptvagao.tv.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.SubcomposeAsyncImage
import com.iptvagao.tv.data.Api
import com.iptvagao.tv.data.ChannelDto
import com.iptvagao.tv.data.Session

@Composable
fun ChannelsScreen(
    session: Session,
    onSessionExpired: () -> Unit,
    onPlay: (channels: List<ChannelDto>, index: Int) -> Unit,
) {
    var channels by remember { mutableStateOf<List<ChannelDto>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var attempt by remember { mutableStateOf(0) }

    LaunchedEffect(attempt) {
        error = null
        channels = null
        try {
            channels = Api.service.channels(session.bearer ?: "")
        } catch (e: retrofit2.HttpException) {
            if (e.code() == 401) {
                session.clear()
                onSessionExpired()
                return@LaunchedEffect
            }
            error = when (e.code()) {
                403 -> "Assinatura suspensa ou cancelada."
                else -> "Erro ao carregar canais (${e.code()})."
            }
        } catch (e: Exception) {
            error = "Sem conexão com o servidor."
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(listOf(IptvColors.Background, IptvColors.BackgroundAlt)),
            ),
    ) {
        when {
            error != null -> CenterMessage(error!!, onRetry = { attempt++ })
            channels == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = IptvColors.Accent)
            }
            channels!!.isEmpty() -> CenterMessage("Nenhum canal disponível no seu plano.", onRetry = { attempt++ })
            else -> ChannelGrid(channels!!, onPlay)
        }
    }
}

@Composable
private fun CenterMessage(message: String, onRetry: (() -> Unit)? = null) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            message,
            style = MaterialTheme.typography.headlineSmall,
            color = IptvColors.TextPrimary,
            textAlign = TextAlign.Center,
        )
        if (onRetry != null) {
            Button(onClick = onRetry, modifier = Modifier.padding(top = 24.dp)) {
                Text("Tentar novamente")
            }
        }
    }
}

@Composable
private fun ChannelGrid(channels: List<ChannelDto>, onPlay: (List<ChannelDto>, Int) -> Unit) {
    val grouped = remember(channels) {
        channels.groupBy { it.category?.name?.replace(";", " / ") ?: "Sem categoria" }.toSortedMap()
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 48.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        item {
            Row(
                verticalAlignment = Alignment.Bottom,
                modifier = Modifier.padding(top = 32.dp),
            ) {
                Text(
                    "Canais",
                    style = MaterialTheme.typography.headlineLarge,
                    color = IptvColors.TextPrimary,
                )
                Text(
                    "${channels.size} canais",
                    style = MaterialTheme.typography.bodyLarge,
                    color = IptvColors.TextSecondary,
                    modifier = Modifier.padding(start = 16.dp, bottom = 6.dp),
                )
            }
        }
        grouped.forEach { (category, list) ->
            item(key = "header-$category") {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
                    Box(
                        Modifier
                            .size(width = 4.dp, height = 22.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(IptvColors.Accent),
                    )
                    Text(
                        category,
                        style = MaterialTheme.typography.titleLarge,
                        color = IptvColors.TextPrimary,
                        modifier = Modifier.padding(start = 12.dp),
                    )
                }
            }
            item(key = "row-$category") {
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    // Respiro pro scale 1.08 não cortar nas bordas
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 10.dp, horizontal = 4.dp),
                ) {
                    items(list, key = { it.id }) { channel ->
                        ChannelCard(channel) {
                            onPlay(channels, channels.indexOfFirst { it.id == channel.id })
                        }
                    }
                }
            }
        }
        item { Box(Modifier.padding(bottom = 40.dp)) }
    }
}

@Composable
private fun ChannelCard(channel: ChannelDto, onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val scale by animateFloatAsState(
        targetValue = if (focused) 1.08f else 1f,
        animationSpec = tween(durationMillis = 180),
        label = "cardScale",
    )

    Column(
        modifier = Modifier
            .graphicsLayer { scaleX = scale; scaleY = scale }
            .size(width = 180.dp, height = 140.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(if (focused) IptvColors.SurfaceFocused else IptvColors.Surface)
            .border(
                width = 2.dp,
                color = if (focused) IptvColors.Accent else Color.Transparent,
                shape = RoundedCornerShape(12.dp),
            )
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
            .padding(14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        ChannelLogo(channel, size = 64.dp)
        Text(
            channel.name,
            style = MaterialTheme.typography.bodyMedium,
            color = if (focused) IptvColors.TextPrimary else IptvColors.TextSecondary,
            fontWeight = if (focused) FontWeight.SemiBold else FontWeight.Normal,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
        )
    }
}

@Composable
fun ChannelLogo(channel: ChannelDto, size: androidx.compose.ui.unit.Dp) {
    SubcomposeAsyncImage(
        model = channel.logoUrl,
        contentDescription = channel.name,
        modifier = Modifier.size(size),
        error = { LogoFallback(channel.name, size) },
        loading = { LogoFallback(channel.name, size) },
    )
}

// Logo quebrada/ausente: monograma com a inicial do canal
@Composable
private fun LogoFallback(name: String, size: androidx.compose.ui.unit.Dp) {
    Box(
        modifier = Modifier
            .size(size)
            .clip(RoundedCornerShape(size / 4))
            .background(IptvColors.AccentDeep.copy(alpha = 0.35f)),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            name.firstOrNull()?.uppercase() ?: "?",
            style = MaterialTheme.typography.headlineMedium,
            color = IptvColors.Accent,
        )
    }
}
