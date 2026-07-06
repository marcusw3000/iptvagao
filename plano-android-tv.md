# Plano de Execucao - Android TV / Fire TV / Chromecast with Google TV

## Objetivo

Consolidar o app nativo de TV como cliente principal da plataforma, com foco em:

- Android TV
- Google TV / Chromecast
- Fire TV / Fire Stick

O backend continua centralizado em `apps/api`, e o app nativo atual fica em `androidTvApk`.

## Estado Atual do Projeto

### Ja entregue

- App nativo em Kotlin + Jetpack Compose
- Player nativo com Media3 / ExoPlayer
- Fluxo de ativacao por codigo
- Emissao de token de dispositivo
- Guard de autenticacao para rotas da TV
- Heartbeat autenticado no backend
- Grid de canais com consumo da API
- Tela de VOD com catalogo via Cinemeta
- Busca, paginacao e categorias basicas no VOD
- Scripts locais `start.bat` e `startTV.bat` para subir API + emulador + APK

### Ja validado no codigo

- `POST /api/v1/tv/activate`
- `GET /api/v1/tv/channels`
- `POST /api/v1/tv/heartbeat`
- `GET /api/v1/tv/account`
- Endpoints VOD em `/api/v1/tv/vod/*`

## O que ficou desatualizado no plano antigo

Os pontos abaixo ja nao sao mais gargalo principal:

1. Auth de device com token
   Ja existe no backend e no app.

2. Rota de heartbeat incerta
   A rota real em uso hoje e `POST /api/v1/tv/heartbeat`.

3. Lista de canais por device
   Ja foi resolvido no fluxo da TV via token de dispositivo; o app nao depende mais de `clientId` exposto no frontend.

4. Pairing via polling de status
   O fluxo atual nao usa polling. Ele usa codigo digitado na TV e troca direta por token.

## Gaps reais agora

### 1. Concorrencia por plano ainda esta hardcoded

Hoje o backend usa limites fixos por tipo de plano, em vez de `Plan.maxDevices`.

Impacto:

- O painel cadastra `maxDevices`, mas o runtime ignora esse valor
- O comportamento de bloqueio nao acompanha a configuracao real do plano

Acao:

- Migrar a validacao de concorrencia para usar `subscription.plan.maxDevices`

### 2. Token do device ainda esta em armazenamento simples

Hoje o app salva token em `SharedPreferences` simples.

Impacto:

- Serve para desenvolvimento
- E fraco para distribuicao real

Acao:

- Migrar para `EncryptedSharedPreferences` antes de release

### 3. UX de bloqueio por heartbeat ainda e minima

Hoje existe overlay com mensagem de bloqueio, mas sem fluxo forte de recuperacao.

Impacto:

- O erro aparece
- A experiencia ainda nao esta pronta para uso real em sala

Acao:

- Criar tela dedicada para:
  - limite de TVs atingido
  - assinatura suspensa
  - token invalido / sessao expirada
  - falha de conectividade prolongada

### 4. Navegacao por foco ainda precisa consolidacao

O app ja navega por D-pad, mas as telas de TV ainda exigem padronizacao de foco, destaque e retorno.

Impacto:

- Alguns componentes ainda tem feedback visual inconsistente
- Fluxos com pagina e filtros precisam ficar mais previsiveis

Acao:

- Padronizar comportamento de foco para:
  - tabs
  - botoes de pagina
  - seletor de categoria
  - cards de canais
  - cards de filmes e series

### 5. VOD ainda depende de backend local para desenvolvimento

Hoje o app aponta para API HTTP local ou servidor definido manualmente.

Impacto:

- Em desenvolvimento local funciona com `10.0.2.2`
- Em distribuicao real precisa backend remoto estavel

Acao:

- Definir ambiente remoto de homologacao
- Separar URLs por `dev`, `staging` e `prod`

### 6. Publicacao ainda nao esta pronta

Pendencias atuais:

- signing de release
- pipeline de build
- revisao de manifest para distribuicao
- arte final de banner e icones
- hardening de cleartext / HTTPS

## Prioridades recomendadas

### Fase 1 - Estabilizacao do core TV

1. Trocar limite hardcoded por `plan.maxDevices`
2. Fortalecer tratamento de erros do heartbeat
3. Padronizar foco visual em toda navegacao principal
4. Revisar persistencia da sessao do device

### Fase 2 - UX de catalogo e navegacao

1. Consolidar VOD com filtros mais claros
2. Melhorar paginação e feedback de carregamento
3. Revisar destaque de item focado em listas e grids
4. Padronizar termos PT-BR em toda a interface

### Fase 3 - Preparacao para distribuicao

1. Configurar backend remoto para homologacao
2. Externalizar configuracao de ambiente
3. Configurar signing de release
4. Gerar APK/AAB de distribuicao
5. Validar em Fire Stick fisico e Android TV fisica

## Ordem de ataque sugerida

### Bloco A - Backend de concorrencia

Objetivo:
Substituir `CONCURRENT_LIMITS` por leitura real do plano contratado.

Entregas:

- ajuste em `apps/api/src/devices/devices.service.ts`
- cobertura de teste para plano com `maxDevices`
- erro de bloqueio coerente com valor real do plano

### Bloco B - Resiliencia de sessao e heartbeat

Objetivo:
Parar de tratar indisponibilidade e bloqueio como erro generico.

Entregas:

- tela dedicada para bloqueio
- tela dedicada para assinatura suspensa
- retry e estado offline mais claros

### Bloco C - Foco e navegacao TV-first

Objetivo:
Remover inconsistencias visuais de foco e melhorar legibilidade para controle remoto.

Entregas:

- componente unico de foco para botoes e tabs
- destaque consistente em filtros, pagina anterior e proxima pagina
- navegacao previsivel entre header, tabs, categoria e grid

### Bloco D - Harden para distribuicao

Objetivo:
Preparar o app para sair do modo local.

Entregas:

- `EncryptedSharedPreferences`
- configuracao `staging/prod`
- release signing
- checklist Fire TV / Android TV

## Recomendacao pratica para agora

Se a ideia e "atacar alguns pontos" com maior retorno imediato, a ordem mais eficiente e:

1. Corrigir concorrencia por `maxDevices`
2. Fechar UX de heartbeat e bloqueio
3. Consolidar foco e navegacao da aba Filmes e Series
4. Preparar configuracao de ambiente remoto

## Arquivos que concentram os proximos trabalhos

- `apps/api/src/devices/devices.service.ts`
- `apps/api/src/tv/tv.service.ts`
- `apps/api/src/tv/tv.controller.ts`
- `androidTvApk/app/src/main/java/com/iptvagao/tv/MainActivity.kt`
- `androidTvApk/app/src/main/java/com/iptvagao/tv/data/Session.kt`
- `androidTvApk/app/src/main/java/com/iptvagao/tv/ui/VodScreen.kt`
- `androidTvApk/app/src/main/java/com/iptvagao/tv/ui/ChannelsScreen.kt`
- `androidTvApk/app/src/main/java/com/iptvagao/tv/ui/PlayerScreen.kt`
