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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
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
import com.iptvagao.tv.data.toTvApiError
import kotlinx.coroutines.launch
import retrofit2.HttpException

private const val CODE_LENGTH = 6

@Composable
fun PairingScreen(session: Session, onActivated: () -> Unit) {
    var code by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val focusManager = LocalFocusManager.current
    val codeFocusRequester = remember { FocusRequester() }
    val activateFocusRequester = remember { FocusRequester() }

    androidx.compose.runtime.LaunchedEffect(Unit) {
        codeFocusRequester.requestFocus()
    }

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
            } catch (e: HttpException) {
                val apiError = e.toTvApiError()
                error = when (apiError.code) {
                    "ACTIVATION_CODE_INVALID" -> "Codigo de ativacao invalido. Confira o codigo gerado no portal."
                    else -> apiError.message ?: "Falha na ativacao. Tente novamente."
                }
            } catch (_: Exception) {
                error = "Falha na ativacao. Verifique o codigo e a conexao."
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
                "IPTV Agao",
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
                    "Acesse o portal no celular ou computador, cadastre esta TV em Dispositivos e digite o codigo:",
                    style = MaterialTheme.typography.bodyMedium,
                    color = IptvColors.TextSecondary,
                    modifier = Modifier.padding(top = 12.dp, bottom = 28.dp),
                )

                CodeInput(
                    code = code,
                    onCodeChange = { code = it.uppercase().filter { ch -> ch.isLetterOrDigit() }.take(CODE_LENGTH) },
                    onDpadDown = { focusManager.moveFocus(FocusDirection.Down) },
                    focusRequester = codeFocusRequester,
                )

                ActivateButton(
                    enabled = code.length == CODE_LENGTH && !loading,
                    loading = loading,
                    onClick = ::activate,
                    focusRequester = activateFocusRequester,
                    upFocusRequester = codeFocusRequester,
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
    focusRequester: FocusRequester,
) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()

    BasicTextField(
        value = code,
        onValueChange = onCodeChange,
        singleLine = true,
        textStyle = TextStyle(color = Color.Transparent),
        cursorBrush = SolidColor(Color.Transparent),
        interactionSource = interaction,
        modifier = Modifier
            .focusRequester(focusRequester)
            .clip(RoundedCornerShape(14.dp))
            .background(if (focused) IptvColors.SurfaceFocused.copy(alpha = 0.5f) else Color.Transparent)
            .border(
                width = if (focused) 2.dp else 0.dp,
                color = if (focused) IptvColors.Accent else Color.Transparent,
                shape = RoundedCornerShape(14.dp),
            )
            .padding(horizontal = 12.dp, vertical = 10.dp)
            .onPreviewKeyEvent { event ->
                if (
                    event.nativeKeyEvent.action == android.view.KeyEvent.ACTION_DOWN &&
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
private fun ActivateButton(
    enabled: Boolean,
    loading: Boolean,
    onClick: () -> Unit,
    focusRequester: FocusRequester,
    upFocusRequester: FocusRequester,
) {
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
            .focusRequester(focusRequester)
            .focusProperties { up = upFocusRequester }
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
