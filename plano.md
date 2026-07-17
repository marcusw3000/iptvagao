# Plano Consolidado do MVP IPTV para Smart TVs

## Objetivo

Entregar um MVP operacional de IPTV com foco em app nativo para TV, usando:

- `androidTvApk` como cliente principal
- `apps/api` como backend central
- `apps/web` como portal operacional de admin, cliente e revenda

O foco imediato e colocar no ar um produto funcional para:

- Android TV
- Google TV / Chromecast com Google TV
- Fire TV / Fire Stick

`apps/tv` deixa de ser prioridade de produto e passa a ser legado/prototipo ate nova decisao.

## Direcao do produto

O plano antigo de "TV corporativa SaaS" foi absorvido parcialmente, mas o produto real em execucao hoje e outro: uma plataforma IPTV com portal administrativo, fluxo de ativacao por dispositivo e app nativo de TV.

Isso significa:

- o app nativo e a prioridade
- o portal web existe para operacao e suporte
- o backend precisa fechar bem o contrato de device, plano e playback
- o MVP nao depende de Samsung Tizen nem LG webOS

## Escopo do MVP

### Dentro do MVP

- cadastro de cliente, plano e assinatura
- login administrativo e operacao no portal web
- fluxo de ativacao de TV por codigo
- emissao e persistencia de token de device
- lista de canais por categoria
- player estavel para streams HLS/M3U8
- heartbeat da TV no backend
- bloqueio por status da assinatura e limite do plano
- tela de conta/status no app
- suporte basico a revenda
- publicacao controlada de APK para clientes piloto

### Fora do MVP

- Samsung Tizen
- LG webOS
- receiver classico de Chromecast
- multiplos perfis por TV
- VOD como requisito obrigatorio de lancamento
- distribuicao madura em marketplace com automacao completa

## Estado atual

### Ja existe no projeto

- backend NestJS em `apps/api`
- portal Next.js em `apps/web`
- app nativo Kotlin/Compose em `androidTvApk`
- rotas TV ja implementadas para ativacao, canais, heartbeat e conta
- fluxo de VOD ja iniciado no backend e no app
- scripts locais para subir ambiente e testar TV

### O que ja foi validado no codigo

- `POST /api/v1/tv/activate`
- `GET /api/v1/tv/channels`
- `POST /api/v1/tv/heartbeat`
- `GET /api/v1/tv/account`
- endpoints VOD em `/api/v1/tv/vod/*`

### Gargalos reais agora

- documentacao de produto ainda misturada com a visao antiga
- concorrencia de devices ainda precisa respeitar `Plan.maxDevices` no runtime
- experiencia de bloqueio/offline no app ainda precisa amadurecer
- navegacao por foco ainda precisa padronizacao TV-first
- ambiente remoto de homologacao/producao ainda nao esta fechado
- processo de release/distribuicao ainda nao esta pronto

## Visao funcional por superficie

### 1. Backend `apps/api`

Responsavel por:

- autenticacao
- clientes
- planos
- assinaturas
- dispositivos
- canais
- categorias
- favoritos
- heartbeat
- conta da TV
- pagamentos
- revenda
- releases do app

### 2. Portal `apps/web`

Responsavel por:

- operacao do admin master
- gestao de clientes
- gestao de dispositivos
- gestao de planos e assinaturas
- operacao financeira
- operacao do revendedor
- suporte e diagnostico basico

### 3. App nativo `androidTvApk`

Responsavel por:

- ativacao por codigo
- persistencia de sessao
- navegacao por controle remoto
- grade de canais
- player
- heartbeat
- exibicao de estados de erro e bloqueio

## Funcionalidades por area

### Admin master

- dashboard com clientes, dispositivos, status e receita
- criacao, edicao, suspensao e exclusao de clientes
- reset de credenciais
- gestao de planos
- visibilidade de dispositivos por cliente
- monitoramento basico de erros e heartbeat

### Cliente

- visualizar assinatura e limite do plano
- gerenciar canais/categorias conforme regras do produto
- acompanhar dispositivos ativos
- revogar dispositivos
- consultar status operacional basico

### Revendedor

- dashboard basico
- clientes indicados
- comissao recorrente
- historico financeiro
- codigo/link de indicacao

### TV

- ativacao por codigo
- restauracao de sessao
- home/lista de canais por categoria
- player estavel
- conta/status
- tratamento claro de erros

## Fases de execucao

## Fase 0 - Consolidacao de direcao

### Objetivo

Parar a duplicidade entre plano antigo e execucao real.

### Entregas

- documentacao consolidada
- `androidTvApk` definido como cliente oficial de TV
- `apps/tv` marcado como nao prioritario
- backlog oficial do MVP

### Criterio de pronto

Nao pode mais existir ambiguidade sobre qual produto de TV esta sendo levado para producao.

## Fase 1 - Backend de device e plano

### Objetivo

Fechar o contrato do device no backend antes de expandir o app.

### Entregas

- ativacao confiavel
- heartbeat consistente
- bloqueio por assinatura/plano coerente
- respostas de erro previsiveis
- testes dos fluxos criticos

### Tarefas

- substituir limites hardcoded por `subscription.plan.maxDevices`
- revisar ciclo de vida do device: ativacao, token, heartbeat, revogacao
- padronizar erros para:
  - codigo invalido
  - assinatura suspensa
  - limite de TVs atingido
  - device revogado
  - token invalido/expirado
- validar se `tv/activate`, `tv/channels`, `tv/heartbeat`, `tv/account` e favoritos cobrem o app sem depender de fluxo web
- criar testes de integracao para os cenarios principais

### Criterio de pronto

O app opera apenas com o contrato TV do backend e o bloqueio respeita o plano real.

## Fase 2 - Fechamento do app nativo

### Objetivo

Transformar `androidTvApk` em cliente pronto para piloto real.

### Entregas

- pareamento funcional
- sessao persistente
- navegacao previsivel por D-pad
- player robusto
- estados de erro e bloqueio dedicados

### Tarefas

- concluir fluxo de pareamento
- revisar persistencia de token e endurecer armazenamento antes do release
- garantir restauracao de sessao no boot do app
- padronizar foco visual em tabs, grids, filtros e botoes
- melhorar retorno entre player e grade
- criar telas/estados para:
  - carregando
  - offline
  - assinatura suspensa
  - limite excedido
  - stream indisponivel
  - app desatualizado
- validar em emulator e devices reais

### Criterio de pronto

Um usuario liga a TV, ativa, navega e assiste sem quebrar o fluxo principal.

## Fase 3 - Portal operacional

### Objetivo

Dar autonomia para operacao e suporte sem depender de acesso tecnico ao banco.

### Entregas

- gestao de dispositivos no portal
- status relevantes visiveis
- fluxo claro de suporte

### Tarefas

- revisar a tela de dispositivos do cliente
- exibir status como:
  - aguardando ativacao
  - ativado
  - online
  - offline
  - bloqueado
  - versao do app
  - ultimo heartbeat
- permitir revogar device e forcar novo pareamento
- reforcar monitoramento por cliente/dispositivo
- conectar releases do APK ao fluxo operacional, se fizer parte do MVP

### Criterio de pronto

O suporte consegue diagnosticar e agir sobre problemas comuns de TV pelo portal.

## Fase 4 - Distribuicao e release

### Objetivo

Fechar o ciclo de build, assinatura e entrega do app.

### Entregas

- build release reproduzivel
- configuracao de ambientes
- estrategia de distribuicao

### Tarefas

- configurar `apiBaseUrl` real para `staging` e `prod`
- revisar uso de HTTPS e cleartext
- configurar signing de release
- fechar `versionCode` e `versionName`
- gerar APK/AAB de distribuicao
- definir politica de atualizacao
- validar sideload e, depois, lojas

### Criterio de pronto

Existe um processo repetivel para publicar nova versao do app.

## Fase 5 - MVP em producao assistida

### Objetivo

Colocar poucos clientes reais para operar com observabilidade minima.

### Entregas

- ambiente online estavel
- primeiro grupo piloto
- checklist de suporte

### Tarefas

- subir backend, banco, cache e portal em ambiente remoto
- apontar dominio e HTTPS
- publicar app para piloto
- testar ativacao, canais, heartbeat e revogacao em ambiente remoto
- acompanhar erros, logs e uso real

### Criterio de pronto

Pelo menos um cliente piloto consegue operar o fluxo ponta a ponta fora do ambiente local.

## Ordem recomendada

1. Fase 0
2. Fase 1
3. Fase 2
4. Fase 3
5. Fase 4
6. Fase 5

Nao faz sentido acelerar distribuicao antes de fechar backend de device e UX principal da TV.

## Backlog prioritario imediato

### Sprint 1

- consolidar documentacao
- marcar `apps/tv` como legado
- trocar concorrencia hardcoded por `Plan.maxDevices`
- revisar erros de `tv/*`
- criar testes de integracao do fluxo TV

### Sprint 2

- concluir pareamento
- persistencia/restauracao de sessao
- heartbeat confiavel
- telas de erro e bloqueio

### Sprint 3

- lapidar foco, grade, player e conta
- validar em Android TV real e Fire Stick
- fechar fluxo operacional de dispositivos no portal

### Sprint 4

- configurar ambiente remoto
- signing de release
- processo de distribuicao
- piloto controlado

## Riscos principais

- manter `apps/tv` e `androidTvApk` evoluindo em paralelo
- backend aplicar regra diferente da configurada no plano
- comportamento variar entre emulator e devices reais
- release de APK sem processo claro de atualizacao
- pouca cobertura de testes nos fluxos de bloqueio e concorrencia

## Indicadores de sucesso do MVP

- ativacao de nova TV em poucos minutos
- reabertura do app sem novo login na maior parte dos casos
- heartbeat refletindo online/offline corretamente
- bloqueio por plano funcionando de forma coerente
- cliente piloto assistindo canais em ambiente remoto real

## Tutorial rapido para colocar o MVP no ar

### 1. O minimo que voce precisa contratar

- 1 VPS Linux para API, web, Postgres e Redis
- 1 dominio
- 1 provedor de DNS
- 1 certificado HTTPS
- 1 storage para uploads, se voce nao quiser guardar tudo no disco da VPS

### 2. Configuracao minima recomendada para MVP

- VPS Ubuntu 22.04
- 4 vCPU
- 8 GB RAM
- 120 GB SSD

Isso atende bem um MVP pequeno com:

- `apps/api`
- `apps/web`
- Postgres
- Redis
- proxy reverso com Nginx

Se o catalogo, upload e consumo crescerem, storage e banco devem ser separados depois.

### 3. Dominio e subdominios sugeridos

- `app.seudominio.com` para o portal web
- `api.seudominio.com` para a API
- `admin.seudominio.com` apenas se quiser separar o portal depois

Para MVP, `app` e `api` ja bastam.

### 4. Stack de infraestrutura sugerida

- Ubuntu
- Docker + Docker Compose
- Nginx
- Let's Encrypt
- Postgres
- Redis

Essa escolha encaixa bem com o formato atual do projeto e e suficiente para subir rapido.

### 5. Servicos que precisam existir

- container da API NestJS
- container do web Next.js
- container do Postgres
- container do Redis
- Nginx na frente de tudo

### 6. Variaveis e configuracoes que voce precisa fechar

- `DATABASE_URL`
- credenciais JWT/autenticacao
- configuracoes de pagamento, se o MVP ja cobrar online
- URLs publicas do web e da API
- CORS
- storage de upload
- `apiBaseUrlProd` do `androidTvApk`

No Android, o `prod` precisa apontar para algo como:

- `https://api.seudominio.com/api/v1`

### 7. Passo a passo pratico de subida

1. Comprar o dominio.
2. Criar a VPS.
3. Apontar DNS de `api.seudominio.com` e `app.seudominio.com` para a VPS.
4. Instalar Docker, Docker Compose e Nginx.
5. Subir Postgres e Redis.
6. Publicar `apps/api` com variaveis de producao.
7. Publicar `apps/web` apontando para a API publica.
8. Configurar Nginx como proxy reverso.
9. Emitir HTTPS com Let's Encrypt.
10. Rodar migracoes e seed inicial, se necessario.
11. Testar login web, ativacao de TV, canais e heartbeat.
12. Atualizar o Android para usar `apiBaseUrlProd`.
13. Gerar build release do APK.
14. Instalar em uma TV piloto real.
15. Validar o fluxo ponta a ponta fora da rede local.

### 8. O que eu faria para um MVP enxuto

- 1 VPS unica no inicio
- banco na mesma VPS no primeiro momento
- Redis na mesma VPS
- storage local ou R2/S3 se ja houver upload relevante
- distribuicao do APK por sideload controlado no piloto

Isso reduz custo e acelera a ida ao ar.

### 9. O que nao deixaria para depois

- HTTPS funcionando
- backup do banco
- senha forte e secrets fora do repo
- monitoramento basico de processo e disco
- dominio definitivo da API antes do release do APK

### 10. Custo inicial esperado

Para MVP, normalmente:

- VPS: faixa de entrada/media
- dominio anual
- possivel custo de storage

Voce nao precisa de arquitetura complexa no dia 1. Precisa de estabilidade minima, HTTPS correto e um dominio definitivo para a API consumida pelo app.
