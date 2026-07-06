# Plano de Execucao - App Nativo para Smart TVs

## Objetivo

Entregar uma experiencia de TV nativa com foco em:

- Android TV
- Google TV / Chromecast com Google TV
- Fire TV / Fire Stick

O app nativo sera o produto principal de TV. O app web em `apps/tv` passa a ser secundario e nao deve receber novas features enquanto o fluxo nativo nao estiver completo.

## Decisoes de Produto e Arquitetura

### 1. Plataforma principal

- Manter `androidTvApk/` como base oficial do app de TV.
- Atender Android TV, Google TV e Fire OS com o mesmo projeto Android.
- Tratar Chromecast com Google TV como alvo Android TV, nao como receiver cast classico.

### 2. Escopo inicial

O foco do MVP nativo nao e VOD, playlists complexas nem multiplas plataformas de Smart TV proprietarias.

Entregar primeiro:

- pareamento do device
- login persistente por token de device
- grade de canais por categoria
- player estavel HLS
- heartbeat e controle de concorrencia
- tela de conta/status
- atualizacao de app via backend

Fica fora do MVP:

- Samsung Tizen
- LG webOS
- cast sender/receiver tradicional
- VOD
- multiplos perfis por TV

### 3. Direcao de codigo

- Backend `apps/api` sera a fonte de verdade para auth, canais, heartbeat, favoritos, EPG e releases.
- Web `apps/web` sera portal operacional para admin, clientes e revendedores.
- `apps/tv` entra em modo de congelamento funcional:
  - corrigir apenas bugs criticos
  - nao adicionar novas features
  - reavaliar remocao apos estabilidade do app nativo

## Estado Atual

Ja existe base relevante pronta:

- backend NestJS com modulos de auth, devices, channels, categories, subscriptions, payments, EPG e app releases
- portal Next.js para operacao
- app Android nativo em `androidTvApk/`
- fluxo TV no backend com `tv/activate`, `tv/channels`, `tv/heartbeat`, favoritos e conta

As principais inconsistencias atuais sao:

- duplicacao de estrategia entre `apps/tv` e `androidTvApk`
- limite de devices simultaneos hardcoded em vez de usar `Plan.maxDevices`
- fluxo de dispositivo parcialmente divergente entre apps
- cobertura de testes insuficiente nos fluxos TV

## Resultado Esperado

Ao final do plano, o produto deve permitir:

1. Cadastrar cliente e assinatura no portal.
2. Registrar e parear uma TV real com codigo ou fluxo equivalente.
3. Abrir o app na TV e restaurar sessao sem novo login.
4. Exibir grade de canais por categoria com EPG e favoritos.
5. Reproduzir canais com estabilidade e feedback de erro.
6. Bloquear corretamente devices fora da assinatura ou acima do limite do plano.
7. Distribuir novas versoes do app via processo controlado.

## Fases de Execucao

## Fase 0 - Alinhamento e limpeza de direcao

### Objetivo

Eliminar ambiguidade de produto e travar a direcao tecnica.

### Entregas

- Atualizar documentacao principal para refletir que o foco imediato e IPTV nativo para TV.
- Registrar `androidTvApk` como app principal.
- Marcar `apps/tv` como legado/prototipo.
- Definir backlog oficial do MVP TV.

### Tarefas

- Revisar `plano.md` e separar visao antiga de TV corporativa do produto real em execucao.
- Criar documento de arquitetura TV-first.
- Adicionar aviso em `apps/tv` e/ou README informando congelamento de features.
- Definir criterios de aceite do MVP nativo.

### Criterio de pronto

Nao pode mais existir duvida, no repositorio, sobre qual app de TV e o oficial.

## Fase 1 - Fechar o contrato de dispositivo no backend

### Objetivo

Deixar o backend consistente e confiavel para qualquer device de TV.

### Entregas

- fluxo de autenticacao de device estabilizado
- limites por plano corretos
- erros previsiveis para o app nativo
- testes dos fluxos criticos

### Tarefas

- Substituir limite hardcoded de concorrencia em `apps/api/src/devices/devices.service.ts` por `Plan.maxDevices`.
- Revisar o modelo de device:
  - ativado
  - token emitido
  - ultimo heartbeat
  - revogacao
- Padronizar respostas de erro para:
  - codigo invalido
  - assinatura suspensa
  - limite de TVs simultaneas
  - device revogado
  - token expirado
- Validar se `tv/activate`, `tv/channels`, `tv/heartbeat`, `tv/account` e favoritos cobrem tudo que o app nativo precisa.
- Adicionar testes de integracao para:
  - ativacao
  - heartbeat
  - bloqueio por plano
  - canais por plano
  - favoritos

### Criterio de pronto

O app Android consegue operar somente com endpoints TV, sem depender de fluxo de usuario comum.

## Fase 2 - Concluir o app nativo Android TV / Fire TV

### Objetivo

Transformar `androidTvApk` em cliente pronto para uso real.

### Entregas

- pareamento funcional
- sessao persistente
- grade navegavel por controle remoto
- player robusto
- telas de erro e bloqueio

### Tarefas

- Finalizar fluxo de pareamento e persistencia de token.
- Migrar armazenamento de token para mecanismo mais seguro quando viavel.
- Garantir restauracao de sessao no boot do app.
- Finalizar Home, Channels, Player e Account.
- Implementar estados dedicados para:
  - carregando
  - offline
  - assinatura suspensa
  - limite excedido
  - stream indisponivel
  - app desatualizado
- Melhorar navegacao por D-pad:
  - foco previsivel
  - troca rapida de canal
  - retorno consistente do player para a grade
- Validar suporte a:
  - Android TV emulator
  - Chromecast com Google TV
  - Fire Stick

### Criterio de pronto

Um usuario final consegue ligar a TV, parear, entrar, assistir e voltar ao catalogo sem travamentos de fluxo.

## Fase 3 - Operacao via portal web

### Objetivo

Garantir que administracao e suporte consigam operar o produto sem intervencao manual no banco.

### Entregas

- portal de dispositivos completo
- visibilidade de status
- fluxo de suporte para app nativo

### Tarefas

- Revisar tela de dispositivos do cliente para refletir o fluxo nativo real.
- Exibir status relevantes:
  - aguardando ativacao
  - ativado
  - online
  - offline
  - bloqueado
  - versao do app
  - ultimo IP
  - ultimo heartbeat
- Permitir revogar device e forcar novo pareamento.
- Melhorar monitoramento admin por cliente, dispositivo e status.
- Conectar release management do APK ao portal, se esse fluxo for parte da operacao.

### Criterio de pronto

Suporte operacional consegue diagnosticar e agir sobre problemas comuns de TV sem acesso tecnico ao servidor.

## Fase 4 - Distribuicao e atualizacao

### Objetivo

Fechar o ciclo de build, entrega e atualizacao do app.

### Entregas

- build release reproduzivel
- versionamento consistente
- estrategia de distribuicao por loja e sideload

### Tarefas

- Configurar signing de release no projeto Android.
- Fechar estrategia de `versionCode` e `versionName`.
- Validar upload e consulta de releases via backend.
- Definir politica de atualizacao:
  - obrigatoria
  - recomendada
  - rollout manual
- Preparar publicacao para:
  - Google Play Android TV
  - Amazon Appstore
- Manter sideload controlado para clientes piloto e suporte.

### Criterio de pronto

Existe um processo repetivel para publicar uma nova versao do app e fazer clientes atualizarem.

## Fase 5 - Estabilizacao e retirada do legado

### Objetivo

Reduzir complexidade operacional e encerrar a duplicidade de clientes TV.

### Entregas

- plano de descontinuidade do `apps/tv`
- observabilidade minima
- regressao controlada

### Tarefas

- Definir se `apps/tv` sera:
  - removido
  - mantido como ambiente interno de debug
- Adicionar metricas e logs basicos para o fluxo TV.
- Criar suite minima de smoke tests para backend TV.
- Revisar textos, encoding e documentacao publica do projeto.

### Criterio de pronto

O produto tem um unico cliente de TV prioritario, com caminho claro de manutencao.

## Ordem Recomendada

1. Fase 0
2. Fase 1
3. Fase 2
4. Fase 3
5. Fase 4
6. Fase 5

Nao inverter Fase 2 e Fase 1. Hoje o maior risco e empurrar o app nativo antes de fechar o contrato correto de device no backend.

## Backlog Prioritario

### Sprint 1

- alinhar documentacao
- congelar `apps/tv`
- trocar concorrencia hardcoded por `Plan.maxDevices`
- revisar erros e contratos de `tv/*`
- criar testes de integracao do fluxo TV

### Sprint 2

- concluir pareamento no Android
- persistencia/restauracao de sessao
- telas de erro/bloqueio
- heartbeat confiavel

### Sprint 3

- lapidar grade, player, favoritos e conta
- validar em Android TV real e Fire Stick
- revisar fluxo de suporte no portal

### Sprint 4

- release signing
- upload/consulta de versao
- processo de distribuicao
- piloto controlado

## Riscos Principais

- manter `apps/tv` e `androidTvApk` evoluindo em paralelo
- divergencia entre regra de plano no banco e regra aplicada no backend
- comportamento inconsistente entre emulator, Chromecast com Google TV e Fire Stick
- distribuicao de APK sem fluxo claro de update
- falta de testes nos fluxos de bloqueio e concorrencia

## Indicadores de Sucesso

- tempo medio de pareamento de uma TV nova abaixo de 3 minutos
- reabertura do app sem novo login em pelo menos 95% dos casos
- heartbeat mantendo status online/offline coerente
- bloqueio de excesso de TVs funcionando conforme plano
- release nova instalada sem suporte manual na maioria dos devices piloto

## Proxima acao recomendada

Comecar pela Fase 1 com um pacote unico de trabalho:

1. usar `Plan.maxDevices` no backend
2. revisar contrato de erro de `tv/*`
3. escrever testes de integracao do fluxo de device

Esse pacote reduz o maior risco do projeto antes de investir mais tempo no app nativo.
