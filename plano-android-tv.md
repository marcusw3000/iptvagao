# Plano — App Nativo Android TV / Fire Stick

## Por quê app nativo

Fire Stick e Android TV não têm browser completo acessível ao usuário — TWA/PWA não rodam lá. Precisa app instalável nativo (Fire OS é fork Android, mesmo APK format funciona nos dois, com ajustes de manifest).

## Stack

- **Kotlin + Jetpack Compose for TV** (substitui Leanback, é o padrão atual do Google pra Android TV)
- **Media3 (ExoPlayer)** — player HLS/DASH, suporta as URLs de canal já cadastradas (`Channel.url`)
- **Retrofit + OkHttp** — consumo da API NestJS existente
- Novo módulo: `apps/tv-android/` — projeto Gradle separado, zero reuso do Next.js frontend, 100% reuso da API backend

## Gaps no backend a resolver antes/durante

1. **Sem auth de device (JWT)** — hoje device só tem `activationCode` (6 chars) sem token de sessão. Precisa endpoint tipo `POST /devices/activate` que troca activationCode por um device token (JWT longa duração ou opaco), pra TV não reenviar código toda hora.
2. **Heartbeat endpoint path inconsistente** — investigação achou `POST devices/heartbeat/:deviceId` no controller, mas nota menciona `/activate/heartbeat/:deviceId` — confirmar rota real antes de codar client.
3. **`Plan.maxDevices` não usado** — limite concorrente hardcoded (`CONCURRENT_LIMITS = {basic:1, premium:4}` em devices.service.ts:5). Se for manter, ok pro MVP; se for usar plano configurável, precisa ajuste no backend primeiro.
4. **Sem endpoint de "current channel list for device"** já validado por assinatura ativa/suspensa — existe `channels/for-client/:clientId` mas TV não conhece `clientId` até parear, só o device. Confirmar se `for-client` aceita `deviceId` ou precisa mapear device→client no backend.

## Fluxo de pareamento (modelo Netflix/YouTube TV)

1. App abre, tela mostra código gerado localmente ou pedido ao backend (`POST /devices/self-register` retorna `activationCode`)
2. Usuário digita esse código no portal web (`apps/web/.../portal/devices`) pra vincular ao client
3. TV faz polling (ex: a cada 3s) num endpoint `GET /devices/:id/status` até `activated=true`
4. Ao ativar, backend retorna device token — TV salva localmente (`EncryptedSharedPreferences`), não pede código de novo

*(Endpoint de status/polling e emissão de token ainda não existem — são novos, adicionar no NestJS)*

## Telas do app TV

1. **Splash / Pairing** — mostra código, polling de ativação
2. **Home / Grid de canais** — Compose `TvLazyGrid`, agrupado por categoria (`Category` já existe no schema), foco via d-pad
3. **Player fullscreen** — ExoPlayer, overlay com nome canal/logo, troca de canal com d-pad up/down ou canal numérico
4. **Status/erro** — assinatura suspensa, limite de TVs atingido (backend já retorna esse erro no heartbeat), sem internet

## Heartbeat / Monitoramento

- A cada N segundos (ex: 60s) TV chama heartbeat endpoint — já existe, backend atualiza `lastSeenAt` e valida limite concorrente
- Painel admin (`(dashboard)/monitoring`) já mostra online/offline por `lastSeenAt` — nenhuma mudança necessária ali
- Se heartbeat retornar erro de limite excedido, TV deve exibir tela de bloqueio (novo comportamento a implementar no app)

## Distribuição

- **Amazon Appstore** (obrigatório pra Fire TV — Google Play não instala em Fire Stick nativamente)
- **Google Play** categoria Android TV (pra Android TV boxes/Chromecast with Google TV/Smart TVs Android)
- Ambos aceitam mesmo APK/AAB com pequenos ajustes de manifest (`<uses-feature android:name="android.software.leanback">`)

## Ordem de execução sugerida

1. Backend: endpoint de troca activationCode→token + endpoint de status/polling + confirmar rota heartbeat real
2. Scaffold Compose for TV: pairing screen + Retrofit client
3. Grid de canais + integração `channels/for-client`
4. Player ExoPlayer + troca de canal
5. Heartbeat + telas de erro/bloqueio
6. Build AAB, testar em emulador Android TV + Fire Stick físico
7. Submissão Amazon Appstore + Google Play
