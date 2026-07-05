package com.iptvagao.tv.ui

import android.view.KeyEvent
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.SubcomposeAsyncImage
import com.iptvagao.tv.data.Api
import com.iptvagao.tv.data.ChannelDto
import com.iptvagao.tv.data.Session
import kotlinx.coroutines.launch

private const val FAVORITES_KEY = "Favoritos"
private const val SEARCH_RESULTS_KEY = "Resultados"

@Composable
fun ChannelsScreen(
    session: Session,
    onSessionExpired: () -> Unit,
    startWithFavoritesOnly: Boolean = false,
    onPlay: (channels: List<ChannelDto>, index: Int) -> Unit,
) {
    var channels by remember { mutableStateOf<List<ChannelDto>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var attempt by remember { mutableStateOf(0) }
    var query by remember { mutableStateOf("") }
    var favoritesOnly by remember { mutableStateOf(startWithFavoritesOnly) }
    val scope = rememberCoroutineScope()

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

    fun toggleFavorite(channelId: String) {
        val current = channels ?: return
        val target = current.find { it.id == channelId } ?: return
        val nextValue = !target.isFavorite
        channels = current.map { if (it.id == channelId) it.copy(isFavorite = nextValue) else it }
        scope.launch {
            try {
                val bearer = session.bearer ?: ""
                if (nextValue) Api.service.addFavorite(bearer, channelId) else Api.service.removeFavorite(bearer, channelId)
            } catch (e: Exception) {
                // reverte em caso de falha de rede
                channels = channels?.map { if (it.id == channelId) it.copy(isFavorite = !nextValue) else it }
            }
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
            else -> ChannelGrid(
                channels = channels!!,
                query = query,
                onQueryChange = { query = it },
                favoritesOnly = favoritesOnly,
                onExitFavoritesOnly = { favoritesOnly = false },
                onPlay = onPlay,
                onToggleFavorite = ::toggleFavorite,
            )
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
private fun ChannelGrid(
    channels: List<ChannelDto>,
    query: String,
    onQueryChange: (String) -> Unit,
    favoritesOnly: Boolean,
    onExitFavoritesOnly: () -> Unit,
    onPlay: (List<ChannelDto>, Int) -> Unit,
    onToggleFavorite: (String) -> Unit,
) {
    val searching = query.isNotBlank()

    // Enquanto busca: lista plana filtrada por nome, em várias linhas de 6.
    // Modo favoritos (vindo do tile "Favoritos" no Home): só a seção de favoritos.
    // Sem busca/filtro: seção fixa de Favoritos (se houver) + categorias, como antes.
    val sections = remember(channels, query, favoritesOnly) {
        if (searching) {
            val filtered = channels.filter { it.name.contains(query, ignoreCase = true) }
            if (filtered.isEmpty()) emptyList() else listOf(SEARCH_RESULTS_KEY to filtered)
        } else if (favoritesOnly) {
            val favorites = channels.filter { it.isFavorite }
            if (favorites.isEmpty()) emptyList() else listOf(FAVORITES_KEY to favorites)
        } else {
            val favorites = channels.filter { it.isFavorite }
            val grouped = channels.groupBy { it.category?.name?.replace(";", " / ") ?: "Sem categoria" }.toSortedMap()
            (if (favorites.isNotEmpty()) listOf(FAVORITES_KEY to favorites) else emptyList()) + grouped.toList()
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 48.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        item {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(top = 32.dp).fillMaxWidth(),
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text(
                            if (favoritesOnly) "Favoritos" else "Canais",
                            style = MaterialTheme.typography.headlineLarge,
                            color = IptvColors.TextPrimary,
                        )
                        Text(
                            if (favoritesOnly) "${channels.count { it.isFavorite }} favoritos" else "${channels.size} canais",
                            style = MaterialTheme.typography.bodyLarge,
                            color = IptvColors.TextSecondary,
                            modifier = Modifier.padding(start = 16.dp, bottom = 6.dp),
                        )
                    }
                    if (favoritesOnly) {
                        Text(
                            "Ver todos os canais",
                            style = MaterialTheme.typography.bodyMedium,
                            color = IptvColors.Accent,
                            modifier = Modifier
                                .padding(top = 4.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .clickable(onClick = onExitFavoritesOnly),
                        )
                    }
                }
                SearchField(query = query, onQueryChange = onQueryChange)
            }
        }

        if (searching && sections.isEmpty()) {
            item {
                Text(
                    "Nenhum canal encontrado para \"$query\"",
                    style = MaterialTheme.typography.bodyLarge,
                    color = IptvColors.TextSecondary,
                    modifier = Modifier.padding(top = 24.dp),
                )
            }
        }

        if (favoritesOnly && !searching && sections.isEmpty()) {
            item {
                Text(
                    "Nenhum favorito ainda. Segure OK num canal pra favoritar.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = IptvColors.TextSecondary,
                    modifier = Modifier.padding(top = 24.dp),
                )
            }
        }

        sections.forEach { (label, list) ->
            item(key = "header-$label") {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
                    Box(
                        Modifier
                            .size(width = 4.dp, height = 22.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(IptvColors.Accent),
                    )
                    if (label == FAVORITES_KEY) {
                        Icon(
                            Icons.Filled.Star,
                            contentDescription = null,
                            tint = IptvColors.Accent,
                            modifier = Modifier.padding(start = 12.dp).size(20.dp),
                        )
                        Text(label, style = MaterialTheme.typography.titleLarge, color = IptvColors.TextPrimary, modifier = Modifier.padding(start = 8.dp))
                    } else {
                        Text(label, style = MaterialTheme.typography.titleLarge, color = IptvColors.TextPrimary, modifier = Modifier.padding(start = 12.dp))
                    }
                }
            }

            if (searching) {
                list.chunked(6).forEachIndexed { rowIndex, chunk ->
                    item(key = "row-$label-$rowIndex") {
                        ChannelRow(chunk, list, onPlay, onToggleFavorite)
                    }
                }
            } else {
                item(key = "row-$label") {
                    ChannelRow(list, list, onPlay, onToggleFavorite)
                }
            }
        }
        item { Box(Modifier.padding(bottom = 40.dp)) }
    }
}

@Composable
private fun ChannelRow(
    visible: List<ChannelDto>,
    fullList: List<ChannelDto>,
    onPlay: (List<ChannelDto>, Int) -> Unit,
    onToggleFavorite: (String) -> Unit,
) {
    LazyRow(
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        // Respiro pro scale 1.08 não cortar nas bordas
        contentPadding = PaddingValues(vertical = 10.dp, horizontal = 4.dp),
    ) {
        items(visible, key = { it.id }) { channel ->
            ChannelCard(
                channel = channel,
                onClick = { onPlay(fullList, fullList.indexOfFirst { it.id == channel.id }) },
                onLongClick = { onToggleFavorite(channel.id) },
            )
        }
    }
}

@Composable
private fun SearchField(query: String, onQueryChange: (String) -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val focusManager = androidx.compose.ui.platform.LocalFocusManager.current

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .width(320.dp)
            .clip(RoundedCornerShape(24.dp))
            .background(if (focused) IptvColors.SurfaceFocused else IptvColors.Surface)
            .border(
                width = 2.dp,
                color = if (focused) IptvColors.Accent else Color.Transparent,
                shape = RoundedCornerShape(24.dp),
            )
            .padding(horizontal = 18.dp, vertical = 10.dp),
    ) {
        Icon(Icons.Filled.Search, contentDescription = null, tint = IptvColors.TextSecondary, modifier = Modifier.size(20.dp))
        Box(modifier = Modifier.padding(start = 10.dp).weight(1f)) {
            BasicTextField(
                value = query,
                onValueChange = onQueryChange,
                singleLine = true,
                textStyle = TextStyle(color = IptvColors.TextPrimary, fontSize = 16.sp),
                cursorBrush = androidx.compose.ui.graphics.SolidColor(IptvColors.Accent),
                interactionSource = interaction,
                modifier = Modifier
                    .fillMaxWidth()
                    // D-pad para baixo sai do campo e vai pro grid de canais
                    // onPreviewKeyEvent (top-down) intercepta ANTES do BasicTextField consumir a tecla
                    .onPreviewKeyEvent { event ->
                        if (event.nativeKeyEvent.action == KeyEvent.ACTION_DOWN &&
                            event.nativeKeyEvent.keyCode == KeyEvent.KEYCODE_DPAD_DOWN
                        ) {
                            focusManager.moveFocus(androidx.compose.ui.focus.FocusDirection.Down)
                            true
                        } else {
                            false
                        }
                    },
                decorationBox = { inner ->
                    if (query.isEmpty()) {
                        Text("Buscar canal...", color = IptvColors.TextSecondary, fontSize = 16.sp)
                    }
                    inner()
                },
            )
        }
    }
}

@Composable
private fun ChannelCard(channel: ChannelDto, onClick: () -> Unit, onLongClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val scale by animateFloatAsState(
        targetValue = if (focused) 1.08f else 1f,
        animationSpec = tween(durationMillis = 180),
        label = "cardScale",
    )
    // Marca se o long-press já foi disparado nesta pressão, pra não também disparar o click no ACTION_UP
    var longPressHandled by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .graphicsLayer { scaleX = scale; scaleY = scale }
            .size(width = 180.dp, height = 168.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(if (focused) IptvColors.SurfaceFocused else IptvColors.Surface)
            .border(
                width = 2.dp,
                color = if (focused) IptvColors.Accent else Color.Transparent,
                shape = RoundedCornerShape(12.dp),
            )
            .focusable(interactionSource = interaction)
            .onKeyEvent { event ->
                val isSelectKey = event.nativeKeyEvent.keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
                    event.nativeKeyEvent.keyCode == KeyEvent.KEYCODE_ENTER
                if (!isSelectKey) return@onKeyEvent false
                when (event.nativeKeyEvent.action) {
                    KeyEvent.ACTION_DOWN -> {
                        // O sistema marca isLongPress() num DOWN repetido após o long-press timeout
                        if (event.nativeKeyEvent.isLongPress) {
                            longPressHandled = true
                            onLongClick()
                        }
                        true
                    }
                    KeyEvent.ACTION_UP -> {
                        if (longPressHandled) {
                            longPressHandled = false
                        } else {
                            onClick()
                        }
                        true
                    }
                    else -> true
                }
            }
            .pointerInput(channel.id) {
                detectTapGestures(onTap = { onClick() }, onLongPress = { onLongClick() })
            }
            .padding(14.dp),
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            ChannelLogo(channel, size = 56.dp)
            Text(
                channel.name,
                style = MaterialTheme.typography.bodyMedium,
                color = if (focused) IptvColors.TextPrimary else IptvColors.TextSecondary,
                fontWeight = if (focused) FontWeight.SemiBold else FontWeight.Normal,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            )
            Text(
                channel.epgNow?.title ?: "",
                style = MaterialTheme.typography.bodyMedium,
                fontSize = 12.sp,
                color = IptvColors.Accent,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().height(16.dp),
            )
        }

        if (channel.isFavorite) {
            Icon(
                Icons.Filled.Star,
                contentDescription = "Favorito",
                tint = IptvColors.Accent,
                modifier = Modifier.align(Alignment.TopEnd).size(16.dp),
            )
        }
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
