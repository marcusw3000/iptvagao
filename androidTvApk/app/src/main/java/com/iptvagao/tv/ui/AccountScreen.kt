package com.iptvagao.tv.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.iptvagao.tv.data.AccountResponse
import com.iptvagao.tv.data.Api
import com.iptvagao.tv.data.Session
import com.iptvagao.tv.data.toTvApiError
import retrofit2.HttpException

private fun statusLabel(status: String?): String = when (status) {
    "active" -> "Ativa"
    "suspended" -> "Suspensa"
    "cancelled" -> "Cancelada"
    "past_due" -> "Pagamento pendente"
    else -> "Sem assinatura"
}

private fun formatDate(iso: String?): String {
    if (iso == null) return "Sem data definida"
    return try {
        iso.substring(0, 10).split("-").reversed().joinToString("/")
    } catch (_: Exception) {
        iso
    }
}

@Composable
fun AccountScreen(session: Session, onBack: () -> Unit, onLogout: () -> Unit) {
    var account by remember { mutableStateOf<AccountResponse?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try {
            account = Api.service.account(session.bearer ?: "")
        } catch (e: HttpException) {
            if (e.code() == 401) {
                session.clear()
                onLogout()
            } else {
                val apiError = e.toTvApiError()
                error = when (apiError.code) {
                    "SUBSCRIPTION_INACTIVE" -> "Assinatura suspensa ou cancelada."
                    "TV_LIMIT_REACHED" -> apiError.message ?: "Limite de TVs atingido."
                    else -> apiError.message ?: "Erro ao carregar dados da conta (${e.code()})."
                }
            }
        } catch (_: Exception) {
            error = "Sem conexao com o servidor."
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(IptvColors.Background, IptvColors.BackgroundAlt)))
            .padding(28.dp)
            .verticalScroll(rememberScrollState()),
    ) {
        Text("Conta", style = MaterialTheme.typography.headlineMedium, color = IptvColors.TextPrimary)

        when {
            error != null -> Text(
                error!!,
                style = MaterialTheme.typography.bodyLarge,
                color = IptvColors.TextSecondary,
                modifier = Modifier.padding(top = 20.dp),
            )
            account == null -> Box(Modifier.padding(top = 20.dp)) {
                CircularProgressIndicator(color = IptvColors.Accent)
            }
            else -> AccountDetails(account!!, session.deviceName, onBack = onBack, onLogout = {
                session.clear()
                onLogout()
            })
        }
    }
}

@Composable
private fun AccountDetails(
    account: AccountResponse,
    deviceName: String?,
    onBack: () -> Unit,
    onLogout: () -> Unit,
) {
    val backFocusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        backFocusRequester.requestFocus()
    }

    Column(modifier = Modifier.padding(top = 36.dp).width(520.dp)) {
        Surface(shape = RoundedCornerShape(16.dp), color = IptvColors.Surface) {
            Column(modifier = Modifier.padding(vertical = 4.dp)) {
                SectionLabel("Dispositivo")
                InfoRow("Cliente", account.clientName)
                InfoRow("Dispositivo", deviceName ?: "-", isLast = true)

                HorizontalDivider(color = IptvColors.Background, thickness = 1.dp)

                SectionLabel("Assinatura")
                InfoRow("Plano", account.planName ?: "Sem plano")
                InfoRow("Status", statusLabel(account.subscriptionStatus))
                InfoRow("Valido ate", formatDate(account.subscriptionEndDate), isLast = true)
            }
        }

        Row(
            modifier = Modifier.padding(top = 16.dp).fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            SecondaryActionButton(
                label = "Voltar",
                focusedBorder = IptvColors.Accent,
                textColor = IptvColors.TextPrimary,
                onClick = onBack,
                modifier = Modifier
                    .weight(1f)
                    .focusRequester(backFocusRequester),
            )
            SecondaryActionButton(
                label = "Desativar dispositivo",
                focusedBorder = Color(0xFFF87171),
                textColor = Color(0xFFF87171),
                onClick = onLogout,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 22.dp, vertical = 6.dp)) {
        Box(
            Modifier.size(width = 4.dp, height = 16.dp).clip(RoundedCornerShape(2.dp)).background(IptvColors.Accent),
        )
        Text(
            text,
            style = MaterialTheme.typography.bodyMedium,
            color = IptvColors.Accent,
            modifier = Modifier.padding(start = 10.dp),
        )
    }
}

@Composable
private fun InfoRow(label: String, value: String, isLast: Boolean = false) {
    Column(modifier = Modifier.padding(horizontal = 22.dp).padding(bottom = if (isLast) 10.dp else 8.dp)) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = IptvColors.TextSecondary)
        Text(value, style = MaterialTheme.typography.titleLarge, color = IptvColors.TextPrimary, modifier = Modifier.padding(top = 2.dp))
    }
}

@Composable
private fun SecondaryActionButton(
    label: String,
    focusedBorder: Color,
    textColor: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()

    Button(
        onClick = onClick,
        interactionSource = interaction,
        colors = ButtonDefaults.buttonColors(
            containerColor = IptvColors.Surface,
            contentColor = textColor,
        ),
        modifier = modifier.border(
            width = if (focused) 2.dp else 0.dp,
            color = if (focused) focusedBorder else Color.Transparent,
            shape = RoundedCornerShape(24.dp),
        ),
    ) {
        Text(label, modifier = Modifier.padding(vertical = 4.dp))
    }
}
