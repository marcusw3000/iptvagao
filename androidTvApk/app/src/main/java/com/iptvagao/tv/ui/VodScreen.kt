package com.iptvagao.tv.ui

import android.view.KeyEvent
import android.widget.Toast
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
import androidx.compose.material.icons.filled.VideoLibrary
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.SubcomposeAsyncImage
import com.iptvagao.tv.data.Api
import com.iptvagao.tv.data.Session
import com.iptvagao.tv.data.VodCatalogItemDto
import com.iptvagao.tv.data.VodItemDetailsDto
import com.iptvagao.tv.data.VodStreamDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private fun localizedVodType(type: String): String = when (type.lowercase()) {
    "movie" -> "Filme"
    "series" -> "Série"
    else -> type.replaceFirstChar { ch -> ch.uppercase() }
}

data class VodItem(
    val id: String,
    val title: String,
    val translatedTitle: String?,
    val type: String,
    val posterUrl: String?,
    val description: String?,
    val year: String?,
    val genres: List<String>,
)

data class VodCatalogPage(
    val items: List<VodItem>,
    val page: Int,
    val hasMore: Boolean,
)

private fun mapVodItem(dto: VodCatalogItemDto): VodItem {
    return VodItem(
        id = dto.id,
        title = dto.title,
        translatedTitle = dto.translatedTitle,
        type = dto.type,
        posterUrl = dto.posterUrl,
        description = dto.description,
        year = dto.year,
        genres = dto.genres,
    )
}

private suspend fun loadVodCatalog(
    bearer: String,
    type: String,
    page: Int,
    limit: Int = 24,
): VodCatalogPage = withContext(Dispatchers.IO) {
    val response = Api.service.vodCatalog(bearer, type, page, limit)
    VodCatalogPage(
        items = response.items.map(::mapVodItem),
        page = response.page,
        hasMore = response.hasMore,
    )
}

private suspend fun searchVod(bearer: String, query: String): List<VodItem> = withContext(Dispatchers.IO) {
    Api.service.vodSearch(bearer, query).map(::mapVodItem)
}

private suspend fun fetchVodItem(bearer: String, id: String): VodItemDetailsDto = withContext(Dispatchers.IO) {
    Api.service.vodItem(bearer, id)
}

private suspend fun fetchVodStreams(bearer: String, id: String): List<VodStreamDto> = withContext(Dispatchers.IO) {
    Api.service.vodStreams(bearer, id).streams
}

@Composable
fun VodScreen(session: Session, onBack: () -> Unit) {
    var loading by remember { mutableStateOf(true) }
    var loadingMore by remember { mutableStateOf(false) }
    var hasMoreCatalog by remember { mutableStateOf(true) }
    var catalogPage by remember { mutableStateOf(1) }
    var error by remember { mutableStateOf<String?>(null) }
    var query by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf("movie") }
    var catalogItems by remember { mutableStateOf<List<VodItem>>(emptyList()) }
    var searchResults by remember { mutableStateOf<List<VodItem>>(emptyList()) }
    var searching by remember { mutableStateOf(false) }
    var selectedItem by remember { mutableStateOf<VodItemDetailsDto?>(null) }
    var streamItems by remember { mutableStateOf<List<VodStreamDto>>(emptyList()) }
    var streamLoading by remember { mutableStateOf(false) }
    var streamError by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val bearer = session.bearer ?: ""
    val categories = listOf(
        "movie" to "Filmes",
        "series" to "Séries",
    )

    suspend fun loadCatalogPage(page: Int) {
        val currentPage = loadVodCatalog(bearer, selectedCategory, page = page)
        catalogItems = currentPage.items
        catalogPage = currentPage.page
        hasMoreCatalog = currentPage.hasMore
    }

    suspend fun refreshCatalog() {
        loadCatalogPage(1)
    }

    suspend fun goToNextCatalogPage() {
        if (loading || loadingMore || searching || !hasMoreCatalog || bearer.isBlank()) return

        loadingMore = true
        try {
            loadCatalogPage(catalogPage + 1)
        } catch (e: Exception) {
            error = e.message ?: "Falha ao carregar a próxima página."
        } finally {
            loadingMore = false
        }
    }

    suspend fun goToPreviousCatalogPage() {
        if (loading || loadingMore || searching || catalogPage <= 1 || bearer.isBlank()) return

        loadingMore = true
        try {
            loadCatalogPage(catalogPage - 1)
        } catch (e: Exception) {
            error = e.message ?: "Falha ao carregar a página anterior."
        } finally {
            loadingMore = false
        }
    }

    LaunchedEffect(Unit) {
        loading = true
        error = null
        if (bearer.isBlank()) {
            error = "Sessao invalida. Faca login novamente."
            loading = false
            return@LaunchedEffect
        }

        try {
            refreshCatalog()
        } catch (e: Exception) {
            error = e.message ?: "Falha ao carregar catalogo."
        } finally {
            loading = false
        }
    }

    LaunchedEffect(selectedCategory) {
        if (searching || bearer.isBlank()) return@LaunchedEffect
        loading = true
        error = null
        catalogItems = emptyList()
        catalogPage = 1
        hasMoreCatalog = true
        try {
            refreshCatalog()
        } catch (e: Exception) {
            error = e.message ?: "Falha ao carregar catalogo."
        } finally {
            loading = false
        }
    }

    LaunchedEffect(query) {
        if (query.isBlank()) {
            searching = false
            searchResults = emptyList()
            return@LaunchedEffect
        }
        searching = true
        loading = true
        error = null
        try {
            searchResults = searchVod(bearer, query)
        } catch (e: Exception) {
            error = e.message ?: "Erro na busca."
        } finally {
            loading = false
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(IptvColors.Background, IptvColors.BackgroundAlt))),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            ScreenHeader(
                title = "Filmes e Séries",
                subtitle = "Catalogo sincronizado pelo backend",
                onBack = onBack,
            )

            if (loading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    LinearProgressIndicator(color = IptvColors.Accent, modifier = Modifier.fillMaxWidth())
                }
                return@Column
            }

            if (error != null) {
                CenterMessage(message = error!!, onRetry = {
                    scope.launch {
                        query = ""
                        loading = true
                        error = null
                        try {
                            refreshCatalog()
                        } catch (e: Exception) {
                            error = e.message ?: "Falha ao carregar catalogo."
                        } finally {
                            loading = false
                        }
                    }
                })
                return@Column
            }

            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 36.dp),
                verticalArrangement = Arrangement.spacedBy(24.dp),
            ) {
                item {
                    SearchField(query = query, onQueryChange = { query = it })
                }

                if (searching) {
                    item { SectionHeader("Resultados da busca") }
                    if (searchResults.isEmpty()) {
                        item {
                            Text(
                                "Nenhum resultado encontrado para \"$query\".",
                                style = MaterialTheme.typography.bodyLarge,
                                color = IptvColors.TextSecondary,
                                modifier = Modifier.padding(top = 20.dp),
                            )
                        }
                    } else {
                        searchResults.chunked(4).forEach { rowItems ->
                            item { VodRow(items = rowItems, onSelect = { item -> selectedItem = item }) }
                        }
                    }
                } else {
                    item { CategoryTabs(categories = categories, selected = selectedCategory, onSelect = { selectedCategory = it }) }
                    item { SectionHeader("Catalogo") }
                    item {
                        CatalogPaginationBar(
                            currentPage = catalogPage,
                            hasMore = hasMoreCatalog,
                            loading = loadingMore,
                            onPrevious = {
                                scope.launch { goToPreviousCatalogPage() }
                            },
                            onNext = {
                                scope.launch { goToNextCatalogPage() }
                            },
                        )
                    }
                    if (catalogItems.isEmpty()) {
                        item {
                            Text(
                                "Nenhum item disponivel para ${categories.firstOrNull { it.first == selectedCategory }?.second ?: selectedCategory}.",
                                style = MaterialTheme.typography.bodyLarge,
                                color = IptvColors.TextSecondary,
                                modifier = Modifier.padding(top = 20.dp),
                            )
                        }
                    } else {
                        catalogItems.chunked(4).forEach { rowItems ->
                            item { VodRow(items = rowItems, onSelect = { item -> selectedItem = item }) }
                        }
                        if (loadingMore) {
                            item {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 12.dp),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    CircularProgressIndicator(color = IptvColors.Accent)
                                }
                            }
                        }
                    }
                }

                item { Box(Modifier.height(32.dp)) }
            }
        }

        selectedItem?.let { item ->
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = Color.Black.copy(alpha = 0.85f),
            ) {
                Box(modifier = Modifier.fillMaxSize()) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(40.dp)
                            .align(Alignment.Center),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(item.title, style = MaterialTheme.typography.headlineLarge, color = IptvColors.TextPrimary, textAlign = TextAlign.Center)
                        if (!item.translatedTitle.isNullOrBlank()) {
                            Text(
                                item.translatedTitle,
                                style = MaterialTheme.typography.titleMedium,
                                color = IptvColors.Accent,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.padding(top = 8.dp),
                            )
                        }
                        Text(
                            listOfNotNull(localizedVodType(item.type), item.year).joinToString(" • "),
                            style = MaterialTheme.typography.bodyLarge,
                            color = IptvColors.TextSecondary,
                            modifier = Modifier.padding(top = 8.dp),
                        )
                        Text(
                            item.description ?: "Descricao indisponivel.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = IptvColors.TextSecondary,
                            modifier = Modifier.padding(top = 16.dp),
                            textAlign = TextAlign.Center,
                        )
                        if (item.genres.isNotEmpty()) {
                            Text(
                                item.genres.joinToString(" • "),
                                style = MaterialTheme.typography.bodySmall,
                                color = IptvColors.TextSecondary,
                                modifier = Modifier.padding(top = 10.dp),
                                textAlign = TextAlign.Center,
                            )
                        }
                        Button(
                            onClick = {
                                scope.launch {
                                    streamLoading = true
                                    streamError = null
                                    streamItems = emptyList()
                                    try {
                                        val details = fetchVodItem(bearer, item.id)
                                        selectedItem = details
                                        streamItems = fetchVodStreams(bearer, item.id)
                                    } catch (e: Exception) {
                                        streamError = e.message ?: "Falha ao carregar streams."
                                    } finally {
                                        streamLoading = false
                                    }
                                }
                            },
                            modifier = Modifier.padding(top = 24.dp),
                        ) {
                            Text("Carregar streams")
                        }
                        if (streamLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.padding(top = 16.dp),
                                color = IptvColors.Accent,
                            )
                        }
                        streamError?.let {
                            Text(
                                it,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.error,
                                modifier = Modifier.padding(top = 16.dp),
                                textAlign = TextAlign.Center,
                            )
                        }
                        if (streamItems.isNotEmpty()) {
                            Text(
                                "Streams disponiveis:",
                                style = MaterialTheme.typography.titleMedium,
                                color = IptvColors.TextPrimary,
                                modifier = Modifier.padding(top = 20.dp),
                            )
                            streamItems.forEach { stream ->
                                Button(
                                    onClick = {
                                        Toast.makeText(
                                            context,
                                            "Stream: ${stream.label}\n${stream.url}",
                                            Toast.LENGTH_SHORT,
                                        ).show()
                                    },
                                    modifier = Modifier
                                        .padding(top = 10.dp)
                                        .fillMaxWidth(),
                                ) {
                                    Text(stream.label)
                                }
                            }
                        }
                        Button(
                            onClick = {
                                selectedItem = null
                                streamItems = emptyList()
                                streamError = null
                            },
                            modifier = Modifier.padding(top = 24.dp),
                        ) {
                            Text("Fechar")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ScreenHeader(title: String, subtitle: String, onBack: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(IptvColors.Surface)
            .padding(horizontal = 36.dp, vertical = 20.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Button(onClick = onBack) {
            Text("Voltar")
        }
        Column(
            modifier = Modifier
                .padding(start = 24.dp)
                .weight(1f),
        ) {
            Text(title, style = MaterialTheme.typography.headlineLarge, color = IptvColors.TextPrimary)
            Text(subtitle, style = MaterialTheme.typography.bodyLarge, color = IptvColors.TextSecondary)
        }
        Icon(Icons.Filled.VideoLibrary, contentDescription = null, tint = IptvColors.Accent, modifier = Modifier.size(80.dp))
    }
}

@Composable
private fun CategoryTabs(categories: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        categories.forEach { (key, label) ->
            TvPillButton(
                label = label,
                selected = selected == key,
                onClick = { onSelect(key) },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun SectionHeader(label: String) {
    Text(
        label,
        style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
        color = IptvColors.TextPrimary,
        modifier = Modifier.padding(vertical = 10.dp),
    )
    HorizontalDivider(color = IptvColors.SurfaceFocused, thickness = 1.dp)
}

@Composable
private fun CatalogPaginationBar(
    currentPage: Int,
    hasMore: Boolean,
    loading: Boolean,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TvPillButton(
            label = "Página anterior",
            selected = false,
            enabled = currentPage > 1 && !loading,
            onClick = onPrevious,
        )
        Text(
            "Página $currentPage",
            style = MaterialTheme.typography.titleMedium,
            color = IptvColors.TextPrimary,
        )
        TvPillButton(
            label = "Próxima página",
            selected = false,
            enabled = hasMore && !loading,
            onClick = onNext,
        )
    }
}

@Composable
private fun TvPillButton(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val scale by animateFloatAsState(
        targetValue = if (focused) 1.02f else 1f,
        animationSpec = tween(durationMillis = 160),
        label = "tvPillScale",
    )

    Box(
        modifier = modifier
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
            .clip(RoundedCornerShape(999.dp))
            .background(
                when {
                    !enabled -> IptvColors.SurfaceFocused.copy(alpha = 0.8f)
                    selected -> IptvColors.Accent
                    else -> IptvColors.Surface
                },
            )
            .border(
                width = if (focused) 3.dp else 1.dp,
                color = if (focused) Color.Red else IptvColors.SurfaceFocused,
                shape = RoundedCornerShape(999.dp),
            )
            .clickable(
                enabled = enabled,
                interactionSource = interaction,
                indication = null,
                onClick = onClick,
            )
            .focusable(interactionSource = interaction, enabled = enabled)
            .padding(horizontal = 24.dp, vertical = 14.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            color = when {
                !enabled -> IptvColors.TextSecondary.copy(alpha = 0.7f)
                selected -> Color.Black
                else -> IptvColors.TextSecondary
            },
            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
        )
    }
}

@Composable
private fun VodRow(items: List<VodItem>, onSelect: (VodItemDetailsDto) -> Unit) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(16.dp), modifier = Modifier.fillMaxWidth()) {
        items(items) { item ->
            VodCard(item = item, onSelect = onSelect)
        }
    }
}

@Composable
private fun VodCard(item: VodItem, onSelect: (VodItemDetailsDto) -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val scale by animateFloatAsState(
        targetValue = if (focused) 1.04f else 1f,
        animationSpec = tween(durationMillis = 180),
        label = "vodCardScale",
    )

    Box(
        modifier = Modifier
            .graphicsLayer { scaleX = scale; scaleY = scale }
            .width(220.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(if (focused) IptvColors.SurfaceFocused else IptvColors.Surface)
            .border(
                width = 2.dp,
                color = if (focused) IptvColors.Accent else Color.Transparent,
                shape = RoundedCornerShape(18.dp),
            )
            .focusable(interactionSource = interaction)
            .pointerInput(item.id) {
                detectTapGestures(
                    onTap = {
                        onSelect(
                            VodItemDetailsDto(
                                id = item.id,
                                title = item.title,
                                translatedTitle = item.translatedTitle,
                                type = item.type,
                                posterUrl = item.posterUrl,
                                backdropUrl = item.posterUrl,
                                description = item.description,
                                year = item.year,
                                genres = item.genres,
                                streams = emptyList(),
                            ),
                        )
                    },
                )
            }
            .onKeyEvent { event ->
                if (event.nativeKeyEvent.keyCode == KeyEvent.KEYCODE_DPAD_CENTER && event.nativeKeyEvent.action == KeyEvent.ACTION_UP) {
                    onSelect(
                        VodItemDetailsDto(
                            id = item.id,
                            title = item.title,
                            translatedTitle = item.translatedTitle,
                            type = item.type,
                            posterUrl = item.posterUrl,
                            backdropUrl = item.posterUrl,
                            description = item.description,
                            year = item.year,
                            genres = item.genres,
                            streams = emptyList(),
                        ),
                    )
                    true
                } else {
                    false
                }
            }
            .padding(12.dp),
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            if (item.posterUrl != null) {
                SubcomposeAsyncImage(
                    model = item.posterUrl,
                    contentDescription = null,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(140.dp)
                        .clip(RoundedCornerShape(14.dp)),
                )
            } else {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(140.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(IptvColors.SurfaceFocused),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("Sem imagem", color = IptvColors.TextSecondary)
                }
            }
            Text(
                item.title,
                style = MaterialTheme.typography.titleMedium,
                color = IptvColors.TextPrimary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 10.dp),
            )
            if (!item.translatedTitle.isNullOrBlank()) {
                Text(
                    item.translatedTitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = IptvColors.Accent,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            Text(
                listOfNotNull(localizedVodType(item.type), item.year).joinToString(" • "),
                style = MaterialTheme.typography.bodySmall,
                color = IptvColors.TextSecondary,
                modifier = Modifier.padding(top = 6.dp),
            )
        }
    }
}

@Composable
private fun SearchField(query: String, onQueryChange: (String) -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val focusManager = LocalFocusManager.current

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
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
        Box(
            modifier = Modifier
                .padding(start = 10.dp)
                .weight(1f),
        ) {
            BasicTextField(
                value = query,
                onValueChange = onQueryChange,
                singleLine = true,
                textStyle = TextStyle(color = IptvColors.TextPrimary, fontSize = 16.sp),
                cursorBrush = SolidColor(IptvColors.Accent),
                interactionSource = interaction,
                modifier = Modifier
                    .fillMaxWidth()
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
                        Text("Buscar filmes e series...", color = IptvColors.TextSecondary, fontSize = 16.sp)
                    }
                    inner()
                },
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
            modifier = Modifier.padding(horizontal = 32.dp),
        )
        if (onRetry != null) {
            Button(onClick = onRetry, modifier = Modifier.padding(top = 24.dp)) {
                Text("Tentar novamente")
            }
        }
    }
}
