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
import androidx.compose.foundation.lazy.rememberLazyListState
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
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import coil.compose.SubcomposeAsyncImage
import com.iptvagao.tv.data.Api
import com.iptvagao.tv.data.Session
import com.iptvagao.tv.data.VodCatalogItemDto
import com.iptvagao.tv.data.VodEpisodeDto
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

private fun formatEpisodeLabel(episode: VodEpisodeDto): String =
    "E${episode.episode.toString().padStart(2, '0')} • ${episode.title}"

private fun formatEpisodeMeta(episode: VodEpisodeDto): String {
    val airedOn = episode.released?.take(10)
    return listOfNotNull("T${episode.season.toString().padStart(2, '0')}", "E${episode.episode.toString().padStart(2, '0')}", airedOn)
        .joinToString(" • ")
}

private fun previewVodDetails(item: VodItem): VodItemDetailsDto {
    return VodItemDetailsDto(
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
        episodes = emptyList(),
    )
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

data class GenreOption(
    val value: String?,
    val label: String,
)

data class VodPlaybackItem(
    val title: String,
    val subtitle: String?,
    val url: String,
)

data class VodDebugSelection(
    val title: String,
    val id: String,
    val source: String,
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
    genre: String? = null,
): VodCatalogPage = withContext(Dispatchers.IO) {
    val response = Api.service.vodCatalog(bearer, type, page, limit, genre)
    VodCatalogPage(
        items = response.items.map(::mapVodItem),
        page = response.page,
        hasMore = response.hasMore,
    )
}

private suspend fun searchVod(bearer: String, query: String): List<VodItem> = withContext(Dispatchers.IO) {
    Api.service.vodSearch(bearer, query).map(::mapVodItem)
}

private suspend fun fetchVodItem(bearer: String, id: String, type: String? = null): VodItemDetailsDto = withContext(Dispatchers.IO) {
    Api.service.vodItem(bearer, id, type)
}

private suspend fun fetchVodStreams(bearer: String, id: String, videoId: String? = null, type: String? = null): List<VodStreamDto> = withContext(Dispatchers.IO) {
    Api.service.vodStreams(bearer, id, videoId, type).streams
}

private fun genreOptionsFor(type: String): List<GenreOption> = when (type) {
    "series" -> listOf(
        GenreOption(null, "Todas"),
        GenreOption("Action", "Ação"),
        GenreOption("Adventure", "Aventura"),
        GenreOption("Animation", "Animação"),
        GenreOption("Comedy", "Comédia"),
        GenreOption("Crime", "Crime"),
        GenreOption("Documentary", "Documentário"),
        GenreOption("Drama", "Drama"),
        GenreOption("Family", "Família"),
        GenreOption("Fantasy", "Fantasia"),
        GenreOption("History", "História"),
        GenreOption("Horror", "Terror"),
        GenreOption("Mystery", "Mistério"),
        GenreOption("Romance", "Romance"),
        GenreOption("Sci-Fi", "Ficção científica"),
        GenreOption("Thriller", "Suspense"),
    )
    else -> listOf(
        GenreOption(null, "Todas"),
        GenreOption("Action", "Ação"),
        GenreOption("Adventure", "Aventura"),
        GenreOption("Animation", "Animação"),
        GenreOption("Comedy", "Comédia"),
        GenreOption("Crime", "Crime"),
        GenreOption("Documentary", "Documentário"),
        GenreOption("Drama", "Drama"),
        GenreOption("Family", "Família"),
        GenreOption("Fantasy", "Fantasia"),
        GenreOption("History", "História"),
        GenreOption("Horror", "Terror"),
        GenreOption("Mystery", "Mistério"),
        GenreOption("Romance", "Romance"),
        GenreOption("Sci-Fi", "Ficção científica"),
        GenreOption("Thriller", "Suspense"),
    )
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
    var selectedGenre by remember { mutableStateOf<String?>(null) }
    var showGenrePicker by remember { mutableStateOf(false) }
    var catalogItems by remember { mutableStateOf<List<VodItem>>(emptyList()) }
    var searchResults by remember { mutableStateOf<List<VodItem>>(emptyList()) }
    var searching by remember { mutableStateOf(false) }
    var selectedItem by remember { mutableStateOf<VodItemDetailsDto?>(null) }
    var selectedSeason by remember { mutableStateOf<Int?>(null) }
    var selectedEpisodeId by remember { mutableStateOf<String?>(null) }
    var streamItems by remember { mutableStateOf<List<VodStreamDto>>(emptyList()) }
    var itemLoading by remember { mutableStateOf(false) }
    var streamLoading by remember { mutableStateOf(false) }
    var streamError by remember { mutableStateOf<String?>(null) }
    var playingItem by remember { mutableStateOf<VodPlaybackItem?>(null) }
    var debugFocusedCard by remember { mutableStateOf<VodDebugSelection?>(null) }
    var debugOpenedItem by remember { mutableStateOf<VodDebugSelection?>(null) }
    var initialFocusRequested by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val bearer = session.bearer ?: ""
    val movieTabFocusRequester = remember { FocusRequester() }
    val seriesTabFocusRequester = remember { FocusRequester() }
    val genreButtonFocusRequester = remember { FocusRequester() }
    val previousPageFocusRequester = remember { FocusRequester() }
    val nextPageFocusRequester = remember { FocusRequester() }
    val catalogFirstCardFocusRequester = remember { FocusRequester() }
    val searchFirstCardFocusRequester = remember { FocusRequester() }
    val categories = listOf(
        "movie" to "Filmes",
        "series" to "Séries",
    )
    val availableGenres = genreOptionsFor(selectedCategory)
    val selectedGenreLabel = availableGenres.firstOrNull { it.value == selectedGenre }?.label ?: "Todas"

    fun openItem(item: VodItemDetailsDto, source: String = "unknown") {
        debugOpenedItem = VodDebugSelection(
            title = item.title,
            id = item.id,
            source = source,
        )
        selectedItem = item
        selectedSeason = null
        selectedEpisodeId = null
        streamItems = emptyList()
        itemLoading = false
        streamLoading = false
        streamError = null

        scope.launch {
            itemLoading = true
            try {
                val details = fetchVodItem(bearer, item.id, item.type)
                if (selectedItem?.id == item.id) {
                    selectedItem = details
                }
            } catch (e: Exception) {
                if (selectedItem?.id == item.id) {
                    streamError = e.message ?: "Falha ao carregar detalhes."
                }
            } finally {
                if (selectedItem?.id == item.id) {
                    itemLoading = false
                }
            }
        }
    }

    fun loadStreamsForSelection(item: VodItemDetailsDto, episodeId: String? = selectedEpisodeId) {
        if (streamLoading) return
        if (item.type == "series" && episodeId == null) {
            streamError = "Selecione um episódio."
            return
        }

        val requestedId = item.id
        val requestedEpisodeId = episodeId
        scope.launch {
            streamLoading = true
            streamError = null
            streamItems = emptyList()
            try {
                val details = fetchVodItem(bearer, requestedId, item.type)
                if (selectedItem?.id == requestedId) {
                    selectedItem = details
                }
                val streams = fetchVodStreams(bearer, requestedId, requestedEpisodeId, item.type)
                if (selectedItem?.id == requestedId && selectedEpisodeId == requestedEpisodeId) {
                    streamItems = streams
                    if (streams.isEmpty()) {
                        streamError = "Nenhuma stream encontrada para o episódio selecionado."
                    }
                }
            } catch (e: Exception) {
                if (selectedItem?.id == requestedId) {
                    streamError = e.message ?: "Falha ao carregar streams."
                }
            } finally {
                if (selectedItem?.id == requestedId) {
                    streamLoading = false
                }
            }
        }
    }

    LaunchedEffect(selectedItem?.id, selectedItem?.episodes?.size) {
        val currentItem = selectedItem ?: return@LaunchedEffect
        if (currentItem.type != "series") {
            selectedSeason = null
            selectedEpisodeId = null
            return@LaunchedEffect
        }

        if (currentItem.episodes.isEmpty()) {
            selectedSeason = null
            selectedEpisodeId = null
            return@LaunchedEffect
        }

        val currentEpisode = currentItem.episodes.firstOrNull { it.id == selectedEpisodeId }
        if (currentEpisode != null) {
            selectedSeason = currentEpisode.season
            return@LaunchedEffect
        }

        val firstEpisode = currentItem.episodes.first()
        selectedSeason = firstEpisode.season
        selectedEpisodeId = firstEpisode.id
    }

    suspend fun loadCatalogPage(page: Int) {
        val currentPage = loadVodCatalog(bearer, selectedCategory, page = page, genre = selectedGenre)
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

    LaunchedEffect(loading, error, searching, showGenrePicker, catalogItems, searchResults, selectedItem) {
        if (!initialFocusRequested && !loading && error == null && !searching && !showGenrePicker) {
            if (catalogItems.isNotEmpty() && selectedItem == null) {
                catalogFirstCardFocusRequester.requestFocus()
            } else if (selectedCategory == "series") {
                seriesTabFocusRequester.requestFocus()
            } else {
                movieTabFocusRequester.requestFocus()
            }
            initialFocusRequested = true
        }

        if (!loading && error == null && searching && searchResults.isNotEmpty() && selectedItem == null) {
            searchFirstCardFocusRequester.requestFocus()
        }
    }

    LaunchedEffect(selectedCategory) {
        if (searching || bearer.isBlank()) return@LaunchedEffect
        initialFocusRequested = false
        loading = true
        error = null
        catalogItems = emptyList()
        catalogPage = 1
        hasMoreCatalog = true
        selectedGenre = null
        showGenrePicker = false
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
            initialFocusRequested = false
            return@LaunchedEffect
        }
        initialFocusRequested = false
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
                        searchResults.chunked(4).forEachIndexed { rowIndex, rowItems ->
                            item(key = "search-$query-$rowIndex-${rowItems.firstOrNull()?.id ?: "empty"}") {
                                VodRow(
                                    items = rowItems,
                                    onSelect = ::openItem,
                                    onFocusItem = { focusedItem ->
                                        debugFocusedCard = VodDebugSelection(
                                            title = focusedItem.title,
                                            id = focusedItem.id,
                                            source = "search",
                                        )
                                    },
                                    firstItemFocusRequester = if (rowIndex == 0) searchFirstCardFocusRequester else null,
                                )
                            }
                        }
                    }
                } else {
                    item {
                        CategoryTabs(
                            categories = categories,
                            selected = selectedCategory,
                            movieFocusRequester = movieTabFocusRequester,
                            seriesFocusRequester = seriesTabFocusRequester,
                            onSelect = { selectedCategory = it },
                        )
                    }
                    item { SectionHeader("Catalogo") }
                    item {
                        Box(
                            modifier = Modifier.fillMaxWidth(),
                            contentAlignment = Alignment.Center,
                        ) {
                            TvPillButton(
                                label = "Categoria: $selectedGenreLabel",
                                selected = showGenrePicker,
                                enabled = true,
                                onClick = { showGenrePicker = !showGenrePicker },
                                modifier = Modifier.focusRequester(genreButtonFocusRequester),
                            )
                        }
                    }
                    if (showGenrePicker) {
                        item {
                            GenreSelectorRow(
                                genres = availableGenres,
                                selectedGenre = selectedGenre,
                                onSelect = { genre ->
                                    scope.launch {
                                        selectedGenre = genre
                                        showGenrePicker = false
                                        loadingMore = true
                                        error = null
                                        try {
                                            loadCatalogPage(1)
                                        } catch (e: Exception) {
                                            error = e.message ?: "Falha ao filtrar por categoria."
                                        } finally {
                                            loadingMore = false
                                            genreButtonFocusRequester.requestFocus()
                                        }
                                    }
                                },
                            )
                        }
                    }
                    item {
                        CatalogPaginationBar(
                            currentPage = catalogPage,
                            hasMore = hasMoreCatalog,
                            loading = loadingMore,
                            previousFocusRequester = previousPageFocusRequester,
                            nextFocusRequester = nextPageFocusRequester,
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
                        catalogItems.chunked(4).forEachIndexed { rowIndex, rowItems ->
                            item(key = "catalog-$selectedCategory-$catalogPage-$rowIndex-${rowItems.firstOrNull()?.id ?: "empty"}") {
                                VodRow(
                                    items = rowItems,
                                    onSelect = ::openItem,
                                    onFocusItem = { focusedItem ->
                                        debugFocusedCard = VodDebugSelection(
                                            title = focusedItem.title,
                                            id = focusedItem.id,
                                            source = "catalog",
                                        )
                                    },
                                    firstItemFocusRequester = if (rowIndex == 0) catalogFirstCardFocusRequester else null,
                                )
                            }
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

        VodDebugOverlay(
            focused = debugFocusedCard,
            opened = debugOpenedItem,
            selected = selectedItem?.let {
                VodDebugSelection(
                    title = it.title,
                    id = it.id,
                    source = "selectedItem",
                )
            },
        )

        selectedItem?.let { item ->
            val loadStreamsFocusRequester = remember(item.id) { FocusRequester() }
            val closeFocusRequester = remember(item.id) { FocusRequester() }
            val firstStreamFocusRequester = remember(item.id, streamItems.size) { FocusRequester() }
            val modalListState = rememberLazyListState()
            val seasonOptions = if (item.type == "series") item.episodes.map { it.season }.distinct() else emptyList()
            val visibleEpisodes = if (item.type == "series" && selectedSeason != null) {
                item.episodes.filter { it.season == selectedSeason }
            } else {
                emptyList()
            }
            val selectedEpisode = visibleEpisodes.firstOrNull { it.id == selectedEpisodeId }

            LaunchedEffect(item.id) {
                runCatching { loadStreamsFocusRequester.requestFocus() }
            }

            LaunchedEffect(item.id, streamItems.size) {
                if (streamItems.isNotEmpty()) {
                    modalListState.animateScrollToItem(if (item.type == "series") 8 else 3)
                    runCatching { firstStreamFocusRequester.requestFocus() }
                }
            }

            LaunchedEffect(item.id, streamLoading, streamError) {
                if (streamLoading || !streamError.isNullOrBlank()) {
                    modalListState.animateScrollToItem(if (item.type == "series") 8 else 3)
                }
            }

            Dialog(
                onDismissRequest = {
                    selectedItem = null
                    selectedSeason = null
                    selectedEpisodeId = null
                    streamItems = emptyList()
                    itemLoading = false
                    streamError = null
                    streamLoading = false
                },
                properties = DialogProperties(
                    usePlatformDefaultWidth = false,
                    dismissOnBackPress = true,
                    dismissOnClickOutside = false,
                ),
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color.Black.copy(alpha = 0.92f),
                ) {
                    LazyColumn(
                        state = modalListState,
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 40.dp, vertical = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                    item {
                        Column(
                            modifier = Modifier.fillMaxWidth(),
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
                        }
                    }
                    item {
                        Text(
                            item.description ?: "Descricao indisponivel.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = IptvColors.TextSecondary,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 12.dp),
                            textAlign = TextAlign.Center,
                        )
                    }
                    if (item.genres.isNotEmpty()) {
                        item {
                            Text(
                                item.genres.joinToString(" • "),
                                style = MaterialTheme.typography.bodySmall,
                                color = IptvColors.TextSecondary,
                                textAlign = TextAlign.Center,
                            )
                        }
                    }
                    if (itemLoading) {
                        item {
                            CircularProgressIndicator(
                                color = IptvColors.Accent,
                            )
                        }
                    }
                    if (item.type == "series" && seasonOptions.isNotEmpty()) {
                        item {
                            Text(
                                "Temporadas:",
                                style = MaterialTheme.typography.titleMedium,
                                color = IptvColors.TextPrimary,
                            )
                        }
                        item {
                            LazyRow(
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                items(seasonOptions) { season ->
                                    TvPillButton(
                                        label = "T${season.toString().padStart(2, '0')}",
                                        selected = selectedSeason == season,
                                        onClick = {
                                            selectedSeason = season
                                            selectedEpisodeId = item.episodes.firstOrNull { it.season == season }?.id
                                            streamItems = emptyList()
                                            streamError = null
                                        },
                                    )
                                }
                            }
                        }
                        item {
                            Text(
                                "Episódios:",
                                style = MaterialTheme.typography.titleMedium,
                                color = IptvColors.TextPrimary,
                            )
                        }
                        item {
                            Column(
                                modifier = Modifier.fillMaxWidth(),
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                visibleEpisodes.forEach { episode ->
                                    EpisodeSelectCard(
                                        episode = episode,
                                        selected = selectedEpisodeId == episode.id,
                                        onClick = {
                                            selectedEpisodeId = episode.id
                                            streamItems = emptyList()
                                            streamError = null
                                            loadStreamsForSelection(item, episode.id)
                                        },
                                        modifier = Modifier.fillMaxWidth(),
                                    )
                                }
                            }
                        }
                        selectedEpisode?.description?.takeIf { it.isNotBlank() }?.let { episodeDescription ->
                            item {
                                Text(
                                    episodeDescription,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = IptvColors.TextSecondary,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.fillMaxWidth(),
                                )
                            }
                        }
                    }
                    item {
                        VodActionButton(
                            label = if (streamLoading) "Carregando streams..." else if (item.type == "series") "Carregar episódio" else "Carregar streams",
                            onClick = {
                                loadStreamsForSelection(item)
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .focusRequester(loadStreamsFocusRequester),
                            enabled = !itemLoading && !streamLoading && (item.type != "series" || selectedEpisodeId != null),
                        )
                    }
                    if (streamLoading) {
                        item {
                            CircularProgressIndicator(
                                color = IptvColors.Accent,
                            )
                        }
                    }
                    streamError?.let {
                        item {
                            Text(
                                it,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.error,
                                textAlign = TextAlign.Center,
                            )
                        }
                    }
                    if (streamItems.isNotEmpty()) {
                        item {
                            Text(
                                "Streams disponiveis:",
                                style = MaterialTheme.typography.titleMedium,
                                color = IptvColors.TextPrimary,
                            )
                        }
                        items(streamItems.size) { index ->
                            val stream = streamItems[index]
                            VodActionButton(
                                label = stream.source?.let { "$it • ${stream.label}" } ?: stream.label,
                                onClick = {
                                    val subtitle = buildString {
                                        append(item.title)
                                        if (item.type == "series") {
                                            selectedEpisode?.let {
                                                append(" • ")
                                                append(formatEpisodeMeta(it))
                                            }
                                        }
                                        stream.source?.let {
                                            append(" • ")
                                            append(it)
                                        }
                                    }
                                    playingItem = VodPlaybackItem(
                                        title = stream.label,
                                        subtitle = subtitle,
                                        url = stream.url,
                                    )
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .then(if (index == 0) Modifier.focusRequester(firstStreamFocusRequester) else Modifier),
                            )
                        }
                    }
                    item {
                        VodActionButton(
                            label = "Fechar",
                            onClick = {
                                selectedItem = null
                                selectedSeason = null
                                selectedEpisodeId = null
                                streamItems = emptyList()
                                itemLoading = false
                                streamError = null
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .focusRequester(closeFocusRequester),
                        )
                    }
                        item { Box(Modifier.height(12.dp)) }
                    }
                }
            }
        }

        playingItem?.let { playback ->
            VodPlayerDialog(
                item = playback,
                onExit = { playingItem = null },
            )
        }
    }
}

@Composable
private fun VodPlayerDialog(item: VodPlaybackItem, onExit: () -> Unit) {
    val context = LocalContext.current
    var showOverlay by remember { mutableStateOf(true) }
    var playbackError by remember { mutableStateOf<String?>(null) }
    val focusRequester = remember { FocusRequester() }

    val player = remember(item.url) {
        ExoPlayer.Builder(context).build().apply { playWhenReady = true }
    }

    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onPlayerError(error: PlaybackException) {
                playbackError = "Falha ao reproduzir este stream"
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

    LaunchedEffect(item.url) {
        playbackError = null
        player.stop()
        player.clearMediaItems()
        player.setMediaItem(MediaItem.fromUri(item.url))
        player.prepare()
        showOverlay = true
    }

    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
    }

    Dialog(
        onDismissRequest = onExit,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = true,
            dismissOnClickOutside = false,
        ),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black)
                .focusRequester(focusRequester)
                .focusable()
                .onKeyEvent { event ->
                    if (event.nativeKeyEvent.action != KeyEvent.ACTION_DOWN) return@onKeyEvent false
                    when (event.nativeKeyEvent.keyCode) {
                        KeyEvent.KEYCODE_BACK -> {
                            onExit()
                            true
                        }
                        KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> {
                            showOverlay = !showOverlay
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
                            "Pressione Voltar para retornar aos episódios",
                            style = MaterialTheme.typography.bodyMedium,
                            color = IptvColors.Accent,
                            modifier = Modifier.padding(top = 10.dp),
                        )
                    }
                }
            }

            if (showOverlay) {
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
                    Column(
                        modifier = Modifier
                            .align(Alignment.BottomStart)
                            .padding(horizontal = 48.dp, vertical = 28.dp),
                    ) {
                        Text(
                            item.title,
                            style = MaterialTheme.typography.headlineMedium,
                            color = IptvColors.TextPrimary,
                        )
                        item.subtitle?.let { subtitle ->
                            Text(
                                subtitle,
                                style = MaterialTheme.typography.bodyLarge,
                                color = IptvColors.Accent,
                                modifier = Modifier.padding(top = 4.dp),
                            )
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
private fun CategoryTabs(
    categories: List<Pair<String, String>>,
    selected: String,
    movieFocusRequester: FocusRequester,
    seriesFocusRequester: FocusRequester,
    onSelect: (String) -> Unit,
) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        categories.forEach { (key, label) ->
            TvPillButton(
                label = label,
                selected = selected == key,
                onClick = { onSelect(key) },
                modifier = Modifier
                    .weight(1f)
                    .focusRequester(if (key == "series") seriesFocusRequester else movieFocusRequester),
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
    previousFocusRequester: FocusRequester,
    nextFocusRequester: FocusRequester,
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
            modifier = Modifier.focusRequester(previousFocusRequester),
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
            modifier = Modifier.focusRequester(nextFocusRequester),
        )
    }
}

@Composable
private fun GenreSelectorRow(
    genres: List<GenreOption>,
    selectedGenre: String?,
    onSelect: (String?) -> Unit,
) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
        items(genres) { genre ->
            TvPillButton(
                label = genre.label,
                selected = genre.value == selectedGenre,
                onClick = { onSelect(genre.value) },
            )
        }
    }
}

@Composable
private fun EpisodeSelectCard(
    episode: VodEpisodeDto,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val scale by animateFloatAsState(
        targetValue = if (focused) 1.01f else 1f,
        animationSpec = tween(durationMillis = 140),
        label = "episodeCardScale",
    )

    Row(
        modifier = modifier
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
            .clip(RoundedCornerShape(20.dp))
            .background(
                when {
                    focused -> IptvColors.Accent
                    selected -> IptvColors.Accent.copy(alpha = 0.18f)
                    else -> IptvColors.Surface
                },
            )
            .border(
                width = if (focused) 3.dp else if (selected) 2.dp else 1.dp,
                color = if (focused) Color.White else if (selected) IptvColors.Accent else IptvColors.SurfaceFocused,
                shape = RoundedCornerShape(20.dp),
            )
            .clickable(
                interactionSource = interaction,
                indication = null,
                onClick = onClick,
            )
            .focusable(interactionSource = interaction)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        if (episode.thumbnailUrl != null) {
            SubcomposeAsyncImage(
                model = episode.thumbnailUrl,
                contentDescription = null,
                modifier = Modifier
                    .width(132.dp)
                    .height(74.dp)
                    .clip(RoundedCornerShape(14.dp)),
            )
        } else {
            Box(
                modifier = Modifier
                    .width(132.dp)
                    .height(74.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(IptvColors.SurfaceFocused),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "Sem imagem",
                    color = if (focused) Color.Black else IptvColors.TextSecondary,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }

        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(
                formatEpisodeLabel(episode),
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                color = if (focused) Color.Black else IptvColors.TextPrimary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                formatEpisodeMeta(episode),
                style = MaterialTheme.typography.bodySmall,
                color = if (focused) Color.Black.copy(alpha = 0.75f) else IptvColors.TextSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            episode.description?.takeIf { it.isNotBlank() }?.let { description ->
                Text(
                    description,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (focused) Color.Black.copy(alpha = 0.85f) else IptvColors.TextSecondary,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun VodActionButton(
    label: String,
    selected: Boolean = false,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val scale by animateFloatAsState(
        targetValue = if (focused) 1.01f else 1f,
        animationSpec = tween(durationMillis = 140),
        label = "vodActionScale",
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
                    !enabled -> IptvColors.SurfaceFocused.copy(alpha = 0.7f)
                    focused -> IptvColors.Accent
                    selected -> IptvColors.Accent.copy(alpha = 0.82f)
                    else -> IptvColors.Surface
                },
            )
            .border(
                width = if (focused) 3.dp else 1.dp,
                color = if (focused) Color.White else if (selected) IptvColors.Accent else IptvColors.SurfaceFocused,
                shape = RoundedCornerShape(999.dp),
            )
            .clickable(
                enabled = enabled,
                interactionSource = interaction,
                indication = null,
                onClick = onClick,
            )
            .focusable(interactionSource = interaction, enabled = enabled)
            .padding(horizontal = 24.dp, vertical = 16.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            color = when {
                !enabled -> IptvColors.TextSecondary.copy(alpha = 0.7f)
                focused -> Color.Black
                selected -> IptvColors.TextPrimary
                else -> IptvColors.TextPrimary
            },
            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
            textAlign = TextAlign.Center,
            maxLines = 3,
            overflow = TextOverflow.Ellipsis,
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
                selected && focused -> Color.Black
                selected -> Color(0xFF1A1330)
                focused -> Color.White
                else -> IptvColors.TextSecondary
            },
            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
        )
    }
}

@Composable
private fun VodRow(
    items: List<VodItem>,
    onSelect: (VodItemDetailsDto, String) -> Unit,
    onFocusItem: (VodItem) -> Unit = {},
    firstItemFocusRequester: FocusRequester? = null,
) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(16.dp), modifier = Modifier.fillMaxWidth()) {
        items(items, key = { it.id }) { item ->
            VodCard(
                item = item,
                onSelect = onSelect,
                onFocusItem = onFocusItem,
                focusRequester = if (item.id == items.firstOrNull()?.id) firstItemFocusRequester else null,
            )
        }
    }
}

@Composable
private fun VodCard(
    item: VodItem,
    onSelect: (VodItemDetailsDto, String) -> Unit,
    onFocusItem: (VodItem) -> Unit = {},
    focusRequester: FocusRequester? = null,
) {
    val interaction = remember(item.id) { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val scale by animateFloatAsState(
        targetValue = if (focused) 1.04f else 1f,
        animationSpec = tween(durationMillis = 180),
        label = "vodCardScale",
    )

    LaunchedEffect(focused, item.id) {
        if (focused) {
            onFocusItem(item)
        }
    }

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
            .clickable(
                interactionSource = interaction,
                indication = null,
                onClick = { onSelect(previewVodDetails(item), "card-click") },
            )
            .then(if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier)
            .focusable(interactionSource = interaction)
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
private fun VodDebugOverlay(
    focused: VodDebugSelection?,
    opened: VodDebugSelection?,
    selected: VodDebugSelection?,
) {
    Surface(
        modifier = Modifier
            .padding(12.dp),
        shape = RoundedCornerShape(12.dp),
        color = Color.Black.copy(alpha = 0.86f),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                "DEBUG VOD",
                style = MaterialTheme.typography.labelLarge,
                color = Color.Yellow,
            )
            Text(
                "Focus: ${focused?.title ?: "-"} | ${focused?.id ?: "-"} | ${focused?.source ?: "-"}",
                style = MaterialTheme.typography.bodySmall,
                color = Color.White,
            )
            Text(
                "Open: ${opened?.title ?: "-"} | ${opened?.id ?: "-"} | ${opened?.source ?: "-"}",
                style = MaterialTheme.typography.bodySmall,
                color = Color.White,
            )
            Text(
                "State: ${selected?.title ?: "-"} | ${selected?.id ?: "-"}",
                style = MaterialTheme.typography.bodySmall,
                color = Color.White,
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
