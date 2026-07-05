package com.iptvagao.tv.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.iptvagao.tv.data.ActivateRequest
import com.iptvagao.tv.data.Api
import com.iptvagao.tv.data.Session
import kotlinx.coroutines.launch

private const val CODE_LENGTH = 6

@Composable
fun PairingScreen(session: Session, onActivated: () -> Unit) {
    var code by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val focusManager = LocalFocusManager.current

    fun activate() {
        if (code.length != CODE_LENGTH || loading) return
        loading = true
        error = null
        scope.launch {
            try {
                val res = Api.service.activate(
                    ActivateRequest(activationCode = code, deviceInfo = android.os.Build.MODEL),
                )
                session.token = res.token
                session.deviceName = res.deviceName
                onActivated()
            } catch (e: Exception) {
                error = "Falha na ativação. Verifique o código e a conexão."
            } finally {
                loading = false
            }
        }
    }

    Row(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(
                    colors = listOf(Color(0xFF2A1B4A), IptvColors.Background),
                    center = Offset(1600f, 100f),
                    radius = 1400f,
                ),
            )
            .padding(horizontal = 64.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Branding à esquerda
        Column(
            modifier = Modifier.weight(1f).fillMaxHeight(),
            verticalArrangement = Arrangement.Center,
        ) {
            Box(
                modifier = Modifier
                    .width(64.dp)
                    .padding(bottom = 24.dp),
            ) {
                Box(
                    Modifier
                        .size(width = 64.dp, height = 6.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(IptvColors.AccentDeep),
                )
            }
            Text(
                "IPTV Agão",
                style = MaterialTheme.typography.displayLarge,
                color = IptvColors.TextPrimary,
            )
            Text(
                "Seus canais na sua TV",
                style = MaterialTheme.typography.headlineSmall,
                color = IptvColors.Accent,
                fontWeight = FontWeight.Normal,
                modifier = Modifier.padding(top = 8.dp),
            )
        }

        // Card de ativação à direita
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = IptvColors.Surface,
            modifier = Modifier.width(520.dp),
        ) {
            Column(
                modifier = Modifier.padding(40.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    "Ativar dispositivo",
                    style = MaterialTheme.typography.headlineMedium,
                    color = IptvColors.TextPrimary,
                )
                Text(
                    "Acesse o portal no celular ou computador, cadastre esta TV em Dispositivos e digite o código:",
                    style = MaterialTheme.typography.bodyMedium,
                    color = IptvColors.TextSecondary,
                    modifier = Modifier.padding(top = 12.dp, bottom = 28.dp),
                )

                CodeInput(
                    code = code,
                    onCodeChange = { code = it.uppercase().filter { ch -> ch.isLetterOrDigit() }.take(CODE_LENGTH) },
                    onDpadDown = { focusManager.moveFocus(FocusDirection.Down) },
                )

                ActivateButton(
                    enabled = code.length == CODE_LENGTH && !loading,
                    loading = loading,
                    onClick = ::activate,
                )

                error?.let {
                    Text(
                        it,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(top = 16.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun CodeInput(
    code: String,
    onCodeChange: (String) -> Unit,
    onDpadDown: () -> Unit,
) {
    BasicTextField(
        value = code,
        onValueChange = onCodeChange,
        singleLine = true,
        textStyle = TextStyle(color = Color.Transparent),
        cursorBrush = SolidColor(Color.Transparent),
        modifier = Modifier.onPreviewKeyEvent { event ->
            // D-pad para baixo sai do campo e vai pro botão Ativar
            if (event.nativeKeyEvent.action == android.view.KeyEvent.ACTION_DOWN &&
                event.nativeKeyEvent.keyCode == android.view.KeyEvent.KEYCODE_DPAD_DOWN
            ) {
                onDpadDown()
                true
            } else {
                false
            }
        },
        decorationBox = {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                repeat(CODE_LENGTH) { i ->
                    val char = code.getOrNull(i)
                    val isNext = i == code.length
                    Box(
                        modifier = Modifier
                            .size(width = 56.dp, height = 68.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(IptvColors.Background)
                            .border(
                                width = 2.dp,
                                color = when {
                                    char != null -> IptvColors.Accent
                                    isNext -> IptvColors.AccentDeep
                                    else -> IptvColors.SurfaceFocused
                                },
                                shape = RoundedCornerShape(10.dp),
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            char?.toString() ?: "",
                            fontSize = 34.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            color = IptvColors.TextPrimary,
                        )
                    }
                }
            }
        },
    )
}

@Composable
private fun ActivateButton(enabled: Boolean, loading: Boolean, onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()

    Button(
        onClick = onClick,
        enabled = enabled,
        interactionSource = interaction,
        colors = ButtonDefaults.buttonColors(
            containerColor = IptvColors.AccentDeep,
            disabledContainerColor = IptvColors.SurfaceFocused,
        ),
        modifier = Modifier
            .padding(top = 32.dp)
            .width(240.dp)
            .border(
                width = if (focused) 2.dp else 0.dp,
                color = if (focused) IptvColors.Accent else Color.Transparent,
                shape = RoundedCornerShape(24.dp),
            ),
    ) {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(22.dp),
                color = IptvColors.TextPrimary,
                strokeWidth = 2.dp,
            )
        } else {
            Text("Ativar", fontSize = 20.sp, modifier = Modifier.padding(vertical = 4.dp))
        }
    }
}
