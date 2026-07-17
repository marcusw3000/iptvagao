# Security Findings

Data da analise: 2026-07-11
Status do documento: atualizado apos remediacao parcial

## Escopo

- `apps/api`
- `apps/web`
- Auditoria de dependencias com `pnpm audit --prod`
- Revisao estatica de autenticacao, headers, logs, SSRF, upload, source maps e filesystem
- Validacao com build e testes direcionados

## Resumo executivo

- O backlog original de exposicao por headers, debug cru, SSRF administrativo simples, host header poisoning, SVG publico e source maps do `api` foi tratado.
- A autenticacao do `web` foi migrada para cookie `HttpOnly`.
- Ainda restam vulnerabilidades transitivas relevantes em dependencias do `api` e uma transitive no `web`.
- A auditoria caiu de `55` vulnerabilidades para `14`.

## Resolvido neste turno

### Hardening HTTP

- `apps/web/next.config.mjs`
  - adicionados `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` e `Permissions-Policy`
  - `productionBrowserSourceMaps` desabilitado
- `apps/api/src/main.ts`
  - headers de seguranca adicionados no Fastify
  - `logger` do Fastify reduzido em producao com base em `NODE_ENV`

### Superficie publica e debug

- `apps/api/src/tv/tv.controller.ts`
  - rota publica `tv/vod/streams/:id/raw` removida
  - `torrent/prepare` deixou de montar URL a partir de `Host` e `X-Forwarded-Proto`
  - `Content-Disposition` sanitizado no streaming de torrent
- `apps/api/src/tv/vod.service.ts`
  - fallback deixou de usar `console.warn`

### SSRF e entradas remotas

- `apps/api/src/common/security/remote-url.ts`
  - nova validacao para bloquear hosts privados e permitir allowlist por ambiente
- `apps/api/src/channels/channels.service.ts`
  - `importFromM3u` agora valida URL remota antes do `fetch`
- `apps/api/src/epg/epg.service.ts`
  - `importFromXmltv` agora valida URL remota antes do `fetch`

### Upload e filesystem

- `apps/api/src/uploads/uploads.controller.ts`
  - `image/svg+xml` removido da allowlist
- `apps/api/src/supabase/supabase.service.ts`
  - nome de arquivo sanitizado antes de publicar no storage
- `apps/api/src/tv/torrent-engine.service.ts`
  - validacao defensiva para impedir path traversal fora de `downloadDir`
  - `streamUrl` passa a usar `API_URL` confiavel

### Build e artefatos

- `apps/api/tsconfig.build.json`
  - `sourceMap: false`
- `apps/api/package.json`
  - build limpa `dist` antes da compilacao

### Dependencias

- `apps/web/package.json`
  - `next` atualizado para `15.5.18`
  - `eslint-config-next` atualizado para `15.5.18`
- `apps/api/package.json`
  - `@fastify/multipart` atualizado para `^8.3.1`
- `package.json`
  - `pnpm.overrides` adicionados para `@fastify/middie`, `lodash` e `tar`

### Autenticacao e sessao

- `apps/api/src/auth/auth.controller.ts`
  - `login` agora seta cookie `HttpOnly`
  - `me` adicionado para reidratacao segura de sessao
  - `logout` adicionado para invalidar cookie no browser
- `apps/api/src/auth/strategies/jwt.strategy.ts`
  - JWT passa a ser aceito via cookie e via bearer token
- `apps/web/src/lib/auth.ts`
  - store deixou de persistir token no browser
  - sessao agora e carregada via `/auth/me`
- `apps/web/src/lib/api.ts`
  - `axios` agora usa `withCredentials: true`
- `apps/web/src/components/auth-bootstrap.tsx`
  - bootstrap cliente para restaurar sessao com cookie na carga inicial

## Pendencias reais

### 1. Alto: vulnerabilidades transitivas no stack Fastify/Nest do `api`

- Estado: aberto
- Evidencia atual do `pnpm audit --prod`:
  - `fastify@4.28.1`
  - `@nestjs/platform-fastify@10.4.22`
  - `fast-uri`
  - `file-type`
- Observacao: essas correcoes exigem upgrade estrutural maior do stack Fastify/Nest ou overrides adicionais que precisam ser testados com cuidado

### 2. Alto: advisory transitivo via `webtorrent -> ip`

- Estado: aberto
- Evidencia atual do `pnpm audit --prod`:
  - `apps/api > webtorrent@3.0.16 > ... > ip@2.0.1`
- Observacao: o risco no codigo da aplicacao foi reduzido com validacoes de entrada, mas a dependencia continua vulneravel

### 3. Medio: advisory transitivo em `postcss` via `next`

- Estado: aberto
- Evidencia atual do `pnpm audit --prod`:
  - `apps/web > next@15.5.18 > postcss@8.4.31`

### 4. Medio: endpoints publicos do modulo TV ainda merecem teste dinamico

- Arquivo:
  - `apps/api/src/tv/tv.controller.ts`
- Estado: parcialmente mitigado
- Observacao: a protecao depende de `DeviceAuthGuard`; ainda vale testar bypass real por HTTP

## Riscos originalmente encontrados que agora estao resolvidos

- Next.js severamente desatualizado no `web`
- ausencia de headers de seguranca no `web`
- ausencia de headers de seguranca no `api`
- endpoint publico de debug cru no VOD
- SSRF administrativo direto em importacao de M3U/XMLTV sem filtro de host
- construcao de `streamUrl` a partir de `Host` e `X-Forwarded-Proto`
- upload de SVG publico para logos
- emissao de `source maps` no build de producao do `api`
- ausencia de validacao defensiva de path traversal no modulo torrent

## Validacoes executadas

```powershell
pnpm audit --prod
pnpm --filter @iptvagao/api build
pnpm --filter @iptvagao/web build
pnpm --filter @iptvagao/api test -- channels.service.spec.ts epg.service.spec.ts torrent-engine.service.spec.ts
```

## Resultado atual

- Antes: `55` vulnerabilidades
- Antes: `2` criticas, `27` altas, `21` moderadas, `5` baixas
- Depois: `14` vulnerabilidades
- Depois: `7` altas, `6` moderadas, `1` baixa

## Proxima prioridade

1. Planejar upgrade do stack `@nestjs/platform-fastify` / `fastify`
2. Reavaliar necessidade de `webtorrent` ou isolar melhor essa superficie
3. Fazer teste dinamico real nos endpoints publicos do modulo TV
4. Revisar se vale adicionar rotação/refresh de sessão e invalidação server-side
