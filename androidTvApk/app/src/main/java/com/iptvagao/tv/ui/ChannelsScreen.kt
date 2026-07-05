package com.iptvagao.tv.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
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

    when {
        error != null -> CenterMessage(error!!, onRetry = { attempt++ })
        channels == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        channels!!.isEmpty() -> CenterMessage("Nenhum canal disponível no seu plano.", onRetry = { attempt++ })
        else -> ChannelGrid(channels!!, onPlay)
    }
}

@Composable
private fun CenterMessage(message: String, onRetry: (() -> Unit)? = null) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(message, style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Center)
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
        channels.groupBy { it.category?.name ?: "Sem categoria" }.toSortedMap()
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 32.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            Text(
                "Canais",
                style = MaterialTheme.typography.headlineMedium,
                modifier = Modifier.padding(top = 24.dp),
            )
        }
        grouped.forEach { (category, list) ->
            item(key = "header-$category") {
                Text(
                    category,
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
            item(key = "row-$category") {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(list, key = { it.id }) { channel ->
                        ChannelCard(channel) {
                            onPlay(channels, channels.indexOfFirst { it.id == channel.id })
                        }
                    }
                }
            }
        }
        item { Box(Modifier.padding(bottom = 32.dp)) }
    }
}

@Composable
private fun ChannelCard(channel: ChannelDto, onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()

    Column(
        modifier = Modifier
            .size(width = 160.dp, height = 120.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(if (focused) Color(0xFF1E40AF) else Color(0xFF1E293B))
            .border(
                width = if (focused) 3.dp else 0.dp,
                color = if (focused) Color(0xFF38BDF8) else Color.Transparent,
                shape = RoundedCornerShape(8.dp),
            )
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        AsyncImage(
            model = channel.logoUrl,
            contentDescription = channel.name,
            modifier = Modifier.size(56.dp),
        )
        Text(
            channel.name,
            style = MaterialTheme.typography.bodyMedium,
            color = Color.White,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
        )
    }
}
