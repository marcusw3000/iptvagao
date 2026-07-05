package com.iptvagao.tv.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// Tema "Roxo Cinematic" — 10-foot UI
object IptvColors {
    val Background = Color(0xFF0A0A12)
    val BackgroundAlt = Color(0xFF10101C)
    val Surface = Color(0xFF14141F)
    val SurfaceFocused = Color(0xFF1E1B2E)
    val Accent = Color(0xFFA78BFA)
    val AccentDeep = Color(0xFF7C3AED)
    val TextPrimary = Color(0xFFFFFFFF)
    val TextSecondary = Color(0xFF94A3B8)
}

private val TvColorScheme = darkColorScheme(
    background = IptvColors.Background,
    surface = IptvColors.Surface,
    primary = IptvColors.AccentDeep,
    onPrimary = IptvColors.TextPrimary,
    secondary = IptvColors.Accent,
    onBackground = IptvColors.TextPrimary,
    onSurface = IptvColors.TextPrimary,
    error = Color(0xFFF87171),
)

// Tipografia maior/semibold pra leitura a 3m de distância
private val TvTypography = Typography().let { base ->
    base.copy(
        displayLarge = base.displayLarge.copy(fontWeight = FontWeight.Bold),
        headlineLarge = base.headlineLarge.copy(fontWeight = FontWeight.SemiBold),
        headlineMedium = base.headlineMedium.copy(fontWeight = FontWeight.SemiBold),
        headlineSmall = base.headlineSmall.copy(fontWeight = FontWeight.SemiBold),
        titleLarge = base.titleLarge.copy(fontWeight = FontWeight.SemiBold, fontSize = 24.sp),
        bodyLarge = base.bodyLarge.copy(fontSize = 18.sp, color = IptvColors.TextSecondary),
        bodyMedium = base.bodyMedium.copy(fontSize = 16.sp),
    )
}

@Composable
fun IptvTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = TvColorScheme,
        typography = TvTypography,
        content = content,
    )
}
