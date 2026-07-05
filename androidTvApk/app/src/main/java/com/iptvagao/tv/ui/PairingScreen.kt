package com.iptvagao.tv.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.iptvagao.tv.data.ActivateRequest
import com.iptvagao.tv.data.Api
import com.iptvagao.tv.data.Session
import kotlinx.coroutines.launch

@Composable
fun PairingScreen(session: Session, onActivated: () -> Unit) {
    var code by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val focusManager = LocalFocusManager.current

    Column(
        modifier = Modifier.fillMaxSize().padding(48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("IPTV Agão", style = MaterialTheme.typography.headlineLarge)
        Text(
            "Acesse o portal no seu celular ou computador, cadastre esta TV em Dispositivos e digite o código de ativação abaixo.",
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.padding(top = 16.dp, bottom = 32.dp),
        )

        OutlinedTextField(
            value = code,
            onValueChange = { code = it.uppercase().take(6) },
            label = { Text("Código de ativação") },
            singleLine = true,
            textStyle = TextStyle(fontSize = 32.sp, fontFamily = FontFamily.Monospace, letterSpacing = 8.sp),
            modifier = Modifier
                .width(340.dp)
                // D-pad para baixo sai do campo e vai pro botão Ativar
                .onPreviewKeyEvent { event ->
                    if (event.nativeKeyEvent.action == android.view.KeyEvent.ACTION_DOWN &&
                        event.nativeKeyEvent.keyCode == android.view.KeyEvent.KEYCODE_DPAD_DOWN
                    ) {
                        focusManager.moveFocus(FocusDirection.Down)
                        true
                    } else {
                        false
                    }
                },
        )

        Button(
            onClick = {
                if (code.length != 6 || loading) return@Button
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
            },
            enabled = code.length == 6 && !loading,
            modifier = Modifier.padding(top = 24.dp),
        ) {
            Text(if (loading) "Ativando..." else "Ativar", fontSize = 20.sp)
        }

        if (loading) CircularProgressIndicator(modifier = Modifier.padding(top = 16.dp))
        error?.let {
            Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 16.dp))
        }
    }
}
