package com.iptvagao.tv.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.dp

@Composable
fun ComingSoonScreen() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(IptvColors.Background, IptvColors.BackgroundAlt))),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                Icons.Filled.Movie,
                contentDescription = null,
                tint = IptvColors.Accent,
                modifier = Modifier.size(64.dp).padding(bottom = 24.dp),
            )
            Text(
                "Filmes e séries chegando em breve",
                style = MaterialTheme.typography.headlineMedium,
                color = IptvColors.TextPrimary,
            )
            Text(
                "Pressione Voltar para retornar ao menu",
                style = MaterialTheme.typography.bodyLarge,
                color = IptvColors.TextSecondary,
                modifier = Modifier.padding(top = 12.dp),
            )
        }
    }
}
