# Plano do Projeto - Plataforma SaaS para Smart TVs

## Objetivo

Desenvolver uma plataforma SaaS de TV Corporativa para Smart TVs,
permitindo que empresas publiquem conteúdos próprios (vídeos,
transmissões ao vivo, playlists e canais) para exibição em Smart TVs.

**Importante:** O projeto não terá foco em listas ilegais ou IPTV
pirata. Toda a plataforma será destinada a conteúdo próprio, autorizado
ou licenciado.

------------------------------------------------------------------------

# 1. Painel Admin Master

## Dashboard

-   Total de clientes
-   Total de TVs/dispositivos conectados
-   Clientes ativos, suspensos e inadimplentes
-   Receita mensal recorrente (MRR)
-   Uso de armazenamento
-   Erros de reprodução
-   Logs do sistema
-   Últimos acessos
-   Novos clientes do mês

## Gestão de Clientes

-   Criar, editar, suspender e excluir clientes
-   Resetar senha
-   Alterar plano
-   Ver dispositivos
-   Ver conteúdos
-   Estatísticas

## Gestão Financeira

-   Assinaturas
-   Pagamentos
-   PIX
-   Cartão
-   Histórico financeiro
-   Faturas

## Planos

-   Básico
-   Premium

Configurações: - Limite de TVs - Armazenamento - Canais - Playlists -
Usuários - Recursos por plano

## Monitoramento

-   TVs online/offline
-   Consumo
-   Logs
-   Erros

## Usuários Internos

-   Administrador
-   Suporte
-   Financeiro

------------------------------------------------------------------------

# 2. Painel do Cliente

## Dashboard

-   TVs conectadas
-   Conteúdo enviado
-   Espaço utilizado
-   Visualizações

## Conteúdo

-   Upload de vídeos, imagens e áudios
-   Links HLS, M3U8, RTMP, YouTube e Vimeo

## Recursos

-   Canais
-   Playlists
-   Categorias
-   Grade EPG
-   Agendamento
-   Personalização visual
-   Alertas
-   Gestão de TVs
-   Usuários internos

------------------------------------------------------------------------

# 3. Sistema de Revenda

Cada revendedor possuirá:

-   Dashboard
-   Clientes indicados
-   Comissão recorrente
-   Histórico financeiro
-   Solicitação de saque
-   Link de indicação
-   Código de indicação

O Admin poderá configurar: - Comissão fixa - Comissão percentual -
Comissão por plano - Status do revendedor

------------------------------------------------------------------------

# 4. Aplicativo Smart TV

Primeira versão: - Android TV - Google TV

Versões futuras: - Samsung Tizen - LG webOS

Recursos: - Ativação por código - QR Code - Lista de canais -
Categorias - Player - HLS - M3U8 - Live - Atualização remota - Reconexão
automática

------------------------------------------------------------------------

# 5. Modelo de Negócio

SaaS B2B.

Planos: - Básico - Premium

Programa de revendedores com comissão recorrente.

------------------------------------------------------------------------

# 6. Stack Técnica

Frontend: - Next.js - React - TailwindCSS - shadcn/ui

Backend: - NestJS (comparar com Laravel)

Banco: - Supabase (PostgreSQL)

Cache: - Redis

Storage: - Cloudflare R2 ou AWS S3

Streaming: - Cloudflare Stream - Bunny Stream - Mux - AWS IVS

------------------------------------------------------------------------

# 7. Banco de Dados

Tabelas iniciais:

-   users
-   clients
-   resellers
-   reseller_commissions
-   reseller_withdraws
-   plans
-   subscriptions
-   payments
-   devices
-   activation_codes
-   channels
-   playlists
-   playlist_items
-   videos
-   live_streams
-   categories
-   epg_programs
-   alerts
-   analytics_events
-   logs

------------------------------------------------------------------------

# 8. Login do Cliente

Gerado automaticamente:

Usuário: - 4 letras

Senha: - 6 números

O administrador pode regenerar.

O cliente poderá alterar posteriormente.

------------------------------------------------------------------------

# 9. Roadmap

1.  MVP
2.  Produto Comercial
3.  Escala
4.  Expansão

------------------------------------------------------------------------

# Entregáveis

1.  Visão geral
2.  Nome
3.  Público-alvo
4.  Diferenciais
5.  MVP
6.  Funcionalidades futuras
7.  Arquitetura
8.  Stack
9.  Banco de dados
10. Fluxo Admin
11. Fluxo Cliente
12. Fluxo Revendedor
13. Fluxo Smart TV
14. Ativação
15. Autenticação
16. Roadmap
17. Monetização
18. Programa de revendedores
19. Riscos técnicos
20. Riscos jurídicos
21. Validação comercial
22. Próximos passos
