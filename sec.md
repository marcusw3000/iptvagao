# Security Findings

Data da analise: 2026-07-11

## Escopo

- `apps/api`
- `apps/web`
- Auditoria de dependencias com `pnpm audit --prod`
- Revisao estatica de autenticacao, headers e exposicao publica
- Revisao estatica de logs, console, endpoints de debug e source maps
- Build de validacao do `apps/api`
- Revisao estatica de SSRF, host header, upload e filesystem

## Achados

### 1. Critico: Next.js desatualizado no web

- Arquivo: `apps/web/package.json`
- Evidencia: `next@14.2.3`
- Impacto: multiplas vulnerabilidades conhecidas em runtime, incluindo bypass de autorizacao em middleware, cache poisoning e vetores de denial of service.
- Observacao: a auditoria retornou 55 vulnerabilidades no total, incluindo 2 criticas.

### 2. Alto: token JWT armazenado em localStorage

- Arquivos:
  - `apps/web/src/lib/auth.ts`
  - `apps/web/src/lib/api.ts`
- Evidencia:
  - escrita do token em `localStorage`
  - leitura do token em interceptor Axios
  - persistencia do estado de autenticacao no browser
- Impacto: qualquer XSS no frontend pode evoluir para sequestro de sessao.
- Recomendacao: migrar para cookie `HttpOnly`, `Secure`, `SameSite` com renovacao/control e invalidacao server-side quando aplicavel.

### 3. Alto: dependencias vulneraveis no backend

- Arquivo: `apps/api/package.json`
- Evidencias principais:
  - `@fastify/multipart@^7.7.3`
  - `fastify@^4.28.1`
  - `@nestjs/platform-fastify` com dependencia transitiva vulneravel em `@fastify/middie`
  - `webtorrent@^3.0.16` puxando `ip@2.0.1` com advisory de SSRF
- Impacto: risco de bypass em middleware, consumo excessivo de recursos e exposicao transitiva por bibliotecas vulneraveis.

### 4. Medio: ausencia de hardening de headers no web

- Arquivo: `apps/web/next.config.mjs`
- Evidencia: nao ha configuracao de CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` ou headers equivalentes.
- Impacto: superficie maior para clickjacking, exfiltracao por contexto e exploracao com XSS.

### 5. Medio: backend sem hardening HTTP equivalente a helmet

- Arquivo: `apps/api/src/main.ts`
- Evidencia:
  - ha `ValidationPipe`
  - ha `CORS` com allowlist por `WEB_URL`
  - nao ha configuracao visivel de headers de seguranca
- Impacto: respostas HTTP seguem sem protecoes basicas de cabecalho.

### 6. Observacao: endpoints publicos no modulo de TV exigem revisao dinamica

- Arquivo: `apps/api/src/tv/tv.controller.ts`
- Evidencia: varios endpoints usam `@Public()` e dependem de `DeviceAuthGuard`.
- Impacto: o desenho pode ser valido, mas precisa de validacao dinamica apos atualizacao das dependencias e revisao do guard para garantir que nao haja bypass.
- Nota: `login` e `activate` ja possuem `@Throttle`.

### 7. Alto: endpoint de debug cru exposto no modulo de TV

- Arquivos:
  - `apps/api/src/tv/tv.controller.ts`
  - `apps/api/src/tv/vod.service.ts`
- Evidencia:
  - rota publica `GET /api/v1/tv/vod/streams/:id/raw`
  - retorno direto de `streamsDebug(...)`
  - o payload de debug agrega respostas `raw`, candidatos, ids alternativos e mensagens de erro
- Impacto: facilita enumeracao de provedores, formato interno de respostas, estrategia de fallback e contexto operacional para abuso ou scraping mais eficaz.

### 8. Medio: backend com logging verboso em runtime

- Arquivos:
  - `apps/api/src/main.ts`
  - `apps/api/src/tv/vod.service.ts`
  - `apps/api/src/payments/payments.service.ts`
  - `apps/api/src/abacatepay/abacatepay.service.ts`
  - `apps/api/src/epg/epg.scheduler.ts`
- Evidencia:
  - `new FastifyAdapter({ logger: true })`
  - logs de webhook e ids de pagamento
  - `console.warn` em fallback de busca com `query` e mensagem de erro
  - logs `debug` e `error` com mensagens vindas de integracoes externas
- Impacto: em ambiente produtivo, logs sem sanitizacao podem vazar termos pesquisados, ids internos, comportamento de integracoes e mensagens de erro uteis para reconhecimento do sistema.

### 9. Medio: source maps habilitados e emitidos no build do backend

- Arquivos:
  - `apps/api/tsconfig.json`
  - `apps/api/dist/**/*.js.map`
- Evidencia:
  - `sourceMap: true` no `tsconfig`
  - o build `pnpm --filter @iptvagao/api build` gerou multiplos arquivos `.js.map` em `apps/api/dist`
- Impacto: se o `dist` for servido ou exposto por erro de configuracao, os source maps aceleram engenharia reversa, mapeamento de rotas internas e analise de logica de autenticacao.

### 10. Medio: ausencia aparente de filtro global de excecoes e controle explicito por ambiente

- Evidencia:
  - nao foi encontrado `useGlobalFilters`, `ExceptionFilter` ou verificacao explicita de `NODE_ENV` em `apps/api/src` e `apps/web/src`
- Impacto: a aplicacao fica mais dependente do comportamento padrao do framework para erros e logs, aumentando risco de respostas verbosas ou inconsistentes entre dev e prod.
- Observacao: este achado e estrutural; a exposicao efetiva depende de como a aplicacao e executada no deploy.

### 11. Observacao: nao foram encontrados logs de console relevantes no frontend

- Evidencia:
  - a busca por `console.log`, `console.debug`, `console.warn`, `console.error` e `debugger` no `apps/web/src` nao encontrou exposicoes relevantes
- Impacto: nenhum achado novo no frontend especificamente por console/dev log nesta revisao.

### 12. Alto: SSRF administrativo por importacao de URLs arbitrarias

- Arquivos:
  - `apps/api/src/channels/channels.controller.ts`
  - `apps/api/src/channels/channels.service.ts`
  - `apps/api/src/epg/epg.controller.ts`
  - `apps/api/src/epg/epg.service.ts`
- Evidencia:
  - `POST /channels/import-m3u` aceita `{ url }` e faz `fetch(m3uUrl)`
  - `POST /epg/import` aceita `{ url }` e faz `fetch(url)`
  - nao ha allowlist de dominio, bloqueio de IP privado ou validacao de esquema alem do comportamento padrao do `fetch`
- Impacto: um operador autenticado com papel administrativo pode usar a API para sondar rede interna, servicos metadata ou endpoints nao destinados ao aplicativo.
- Observacao: o risco e de SSRF autenticado, nao de acesso anonimo.

### 13. Alto: construcao de URL de retorno confiando em `Host` e `X-Forwarded-Proto`

- Arquivos:
  - `apps/api/src/tv/tv.controller.ts`
  - `apps/api/src/tv/torrent-engine.service.ts`
- Evidencia:
  - `prepareTorrent` monta `reqBaseUrl` com `req.headers.host` e `x-forwarded-proto`
  - essa base e usada para produzir `streamUrl` retornada ao cliente
- Impacto: em proxy ou configuracao permissiva, cabecalhos manipulados podem gerar links de streaming apontando para host indevido, facilitando host header poisoning e confusao de origem.
- Recomendacao: usar `API_URL` confiavel do servidor e ignorar host/proto vindos do cliente, exceto quando normalizados pelo proxy confiavel.

### 14. Medio: upload de SVG permitido em logo de canal

- Arquivos:
  - `apps/api/src/uploads/uploads.controller.ts`
  - `apps/api/src/supabase/supabase.service.ts`
- Evidencia:
  - `image/svg+xml` esta na allowlist
  - o arquivo e publicado com URL publica em storage
- Impacto: SVG e conteudo ativo; dependendo de como for servido e embutido no frontend, pode virar vetor de XSS armazenado ou de carregamento de conteudo malicioso.
- Observacao: a explorabilidade final depende de como o browser e o bucket servem o arquivo, mas a superficie existe hoje.

### 15. Medio: possivel escape de caminho em torrent precisa de validacao dinamica

- Arquivo: `apps/api/src/tv/torrent-engine.service.ts`
- Evidencia:
  - o caminho final usa `path.join(this.downloadDir, chosenFile.path)`
  - nao ha verificacao explicita de que o caminho resolvido continua dentro de `downloadDir`
- Impacto: se a biblioteca de torrent ou metadados aceitarem caminhos maliciosos, pode haver escrita/leitura fora do diretorio esperado.
- Observacao: este ponto depende do comportamento do `webtorrent` e precisa de teste dinamico com torrent malformado para confirmacao.

### 16. Observacao: nao foram encontrados usos perigosos de SQL raw

- Evidencia:
  - a busca por `queryRaw`, `executeRaw`, `queryRawUnsafe` e `executeRawUnsafe` nao encontrou uso relevante em `apps/api/src`
- Impacto: nenhum achado novo de injecao SQL direta nesta revisao.

## Controles existentes encontrados

- `ValidationPipe` global com `whitelist`, `forbidNonWhitelisted` e `transform`
- `ThrottlerModule` global
- `@Throttle` em endpoints sensiveis como login e ativacao de dispositivo
- `CORS` com origem derivada de `WEB_URL`
- webhook de pagamentos com comentario indicando verificacao por HMAC

## Prioridade de correcao

1. Atualizar `next` e dependencias criticas do backend.
2. Remover JWT de `localStorage` e migrar para cookie `HttpOnly`.
3. Remover ou proteger a rota `tv/vod/streams/:id/raw` fora de ambiente interno.
4. Reduzir verbosidade de logs e sanitizar ids, consultas e mensagens de erro externas.
5. Restringir importacoes remotas de M3U/XMLTV com allowlist ou bloqueio de IPs privados.
6. Parar de confiar em `Host` e `X-Forwarded-Proto` para compor URLs de retorno.
7. Adicionar headers de seguranca no `web` e no `api`.
8. Desabilitar source maps no build de producao do `api` ou garantir que `dist` nunca seja servido publicamente.
9. Revisar upload de SVG e validar path handling do modulo torrent.
10. Revalidar endpoints publicos do modulo `tv` com teste dinamico.

## Comandos executados

```powershell
pnpm audit --prod
pnpm --filter @iptvagao/api build
```

## Testes adicionais executados

- busca por `console.*`, `logger.*`, `debugger` e `logger: true`
- busca por rotas e metodos com `raw`, `debug`, `stack`, `sourceMap` e comportamento de ambiente
- validacao do artefato gerado em `apps/api/dist` para confirmar emissao de `.map`
- busca por vetores de XSS, SSRF, SQL raw, segredos, upload e filesystem

## Resultado consolidado da auditoria

- 55 vulnerabilidades encontradas
- 2 criticas
- 27 altas
- 21 moderadas
- 5 baixas
