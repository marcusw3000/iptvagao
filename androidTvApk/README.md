# IPTV Agão — App Android TV / Fire Stick

App nativo (Kotlin + Jetpack Compose + Media3/ExoPlayer) que consome a API NestJS do monorepo (`apps/api`).

## Fluxo

1. Cliente cadastra a TV no portal web (**Portal → Dispositivos**) e recebe um código de ativação de 6 caracteres.
2. Na TV, o app abre a tela de pareamento — digite o código.
3. App troca o código por um token de dispositivo (`POST /api/v1/tv/activate`), salvo localmente. Não pede código de novo.
4. Grid de canais (filtrado pelo plano da assinatura) → player fullscreen.
5. Heartbeat a cada 60s mantém o device online no painel de monitoramento e respeita o limite de TVs simultâneas do plano.

## Endpoints usados (backend `apps/api/src/tv/`)

| Método | Rota                   | Auth          |
|--------|------------------------|---------------|
| POST   | `/api/v1/tv/activate`  | pública (código) |
| GET    | `/api/v1/tv/channels`  | Bearer device token |
| POST   | `/api/v1/tv/heartbeat` | Bearer device token |

## Build

Pré-requisitos: JDK 17 + Android Studio (ou Android SDK + Gradle 8.7).

```bash
# primeira vez (gera o gradle wrapper jar, que não é versionado):
cd androidTvApk
gradle wrapper   # ou abra a pasta no Android Studio, que resolve sozinho

# debug APK
./gradlew assembleDebug
# saída: app/build/outputs/apk/debug/app-debug.apk

# release (precisa configurar signing)
./gradlew assembleRelease
```

### URL da API

Padrão: `http://10.0.2.2:3001/api/v1` (emulador → localhost da máquina).
Para device físico/produção:

```bash
./gradlew assembleDebug -PapiBaseUrl=http://192.168.0.10:3001/api/v1
```

ou edite `apiBaseUrl` em `gradle.properties`.

## Controles (controle remoto)

- **D-pad**: navega no grid; **OK** abre canal
- **No player**: cima/baixo (ou Channel Up/Down) troca canal; **OK** mostra/esconde overlay; **Voltar** retorna ao grid

## Instalar no Fire Stick (sideload para teste)

1. Fire Stick: Configurações → Meu Fire TV → Opções de desenvolvedor → ativar **ADB Debugging** e **Apps de fontes desconhecidas**
2. Descubra o IP do Fire Stick (Configurações → Rede)
3. No PC:

```bash
adb connect 192.168.0.X:5555
adb install app/build/outputs/apk/debug/app-debug.apk
```

## Emulador para teste

Android Studio → Device Manager → novo device categoria **TV** (ex: Television 1080p, API 34).

## Publicação

- **Fire TV**: Amazon Appstore (developer.amazon.com) — aceita o mesmo APK
- **Android TV / Google TV**: Google Play Console, trilha Android TV (requer banner, que já está em `res/drawable/banner.xml`, e screenshots de TV)

## Pendências conhecidas

- Ícone/banner são placeholders — trocar por arte real antes de publicar
- Release signing não configurado (`signingConfigs`)
- Streams HTTP exigem `usesCleartextTraffic=true` (já setado); se todos os streams forem HTTPS, remover
- Token de device fica em SharedPreferences simples; para produção, migrar para EncryptedSharedPreferences (requer minSdk 23)
