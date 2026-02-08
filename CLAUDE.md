# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projeto

Sistema de Gestão de Fretes para a **Arteita Serviços e Pintura** (Itabira/MG). Web app interno para registrar cargas transportadas, com integração WhatsApp (Evolution API + API Oficial Meta) e IA para captar oportunidades de frete em grupos.

Documentação completa: `PRD.md` (requisitos) e `EMPRESA.md` (dados da empresa e cores da marca).

## Comandos

```bash
npm run dev          # Servidor de desenvolvimento (http://localhost:3000)
npm run build        # Build de produção
npm run lint         # Lint com ESLint
npm run lint:fix     # Lint com auto-fix
npm run typecheck    # Verificação de tipos TypeScript
npm run format       # Formatar código com Prettier
npm run test         # Rodar testes com Jest
npm run db:generate  # Gerar Prisma Client
npm run db:migrate   # Criar/aplicar migrações
npm run db:push      # Push schema para o banco (dev)
npm run db:studio    # Interface visual do Prisma
npm run db:seed      # Popular banco com dados iniciais
```

## Stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Prisma** (ORM) + **PostgreSQL**
- **NextAuth.js** (autenticação JWT com credenciais)
- **Tailwind CSS** com cores customizadas da marca Arteita
- **Zod** para validação, **react-hook-form** para formulários
- **lucide-react** para ícones
- **@anthropic-ai/sdk** para extração de dados com IA (Claude)
- **axios** para chamadas HTTP (Evolution API, WhatsApp Business)

## Arquitetura

```
src/
├── app/
│   ├── (auth)/login/              # Página de login (pública)
│   ├── (dashboard)/               # Layout com sidebar (protegido)
│   │   ├── fretes/                # Listagem, registro, filtros, export CSV
│   │   ├── oportunidades/         # Painel de oportunidades captadas nos grupos
│   │   ├── cadastros/             # CRUD: motoristas, caminhoes, transportadoras, origens-destinos
│   │   └── configuracoes/whatsapp # Status da conexão, grupos monitorados, config do bot
│   └── api/
│       ├── auth/[...nextauth]     # NextAuth handler
│       ├── fretes/                # CRUD + export CSV
│       ├── motoristas/            # CRUD
│       ├── caminhoes/             # CRUD
│       ├── transportadoras/       # CRUD
│       ├── origens-destinos/      # CRUD
│       ├── oportunidades/         # CRUD oportunidades de frete
│       ├── grupos-whatsapp/       # CRUD grupos monitorados
│       ├── whatsapp/              # Status conexão + reconexão
│       └── webhook/whatsapp/      # Webhook que recebe mensagens da Evolution API
├── components/
│   ├── layout/sidebar.tsx         # Navegação lateral (fretes, oportunidades, cadastros, config)
│   ├── providers/                 # AuthProvider (SessionProvider)
│   └── ui/                        # Modal, PageHeader, StatusBadge
├── lib/
│   ├── auth.ts                    # Configuração NextAuth
│   ├── db.ts                      # Singleton Prisma Client
│   ├── utils.ts                   # Helpers: cn(), formatCurrency(), formatDate(), isValidPlaca()
│   ├── whatsapp/
│   │   ├── evolution-api.ts       # Cliente Evolution API v2 (envio/recebimento/media)
│   │   ├── official-api.ts        # Cliente WhatsApp Business Cloud API (fallback)
│   │   ├── index.ts               # WhatsAppService unificado com fallback automático
│   │   ├── bot.ts                 # Máquina de estados da conversa com motorista
│   │   └── group-monitor.ts       # Processa mensagens de grupos e identifica oportunidades
│   └── ai/
│       └── extract-freight.ts     # IA (Claude) para OCR de tickets e classificação de oportunidades
├── middleware.ts                   # Proteção de rotas (libera /login e /api/webhook)
└── types/next-auth.d.ts
```

## Integração WhatsApp

### Fluxo do motorista (mensagem privada)
1. Motorista envia mensagem → webhook recebe → `bot.handleIncomingMessage()`
2. Bot verifica se número está cadastrado (campo `whatsapp` em Motorista)
3. Motorista envia foto/PDF do ticket → IA extrai dados via `extractFreightData()`
4. Bot confirma dados → motorista aceita → frete salvo com status PENDENTE

### Fluxo de oportunidades (mensagens de grupo)
1. Mensagem no grupo → webhook recebe → `processGroupMessage()`
2. Pré-filtro por palavras-chave do grupo
3. Se match: IA classifica via `classifyOpportunity()` → salva Oportunidade no banco
4. Oportunidades aparecem no painel `/oportunidades` (auto-refresh 30s)

### Dual API
- **Evolution API** (primário): self-hosted, sem custo por mensagem, suporta grupos
- **API Oficial Meta** (fallback): ativado automaticamente quando Evolution desconecta

## Padrões Importantes

- **Soft delete**: Cadastros usam `active: false`. Fretes usam `deletedAt` + `deleteMotivo`.
- **API responses**: Listas retornam `{ data: [], total, page, totalPages }`.
- **Cores da marca**: `arteita-blue-500` (#1B3A5C) e `arteita-gold-500` (#F2A900) em `tailwind.config.ts`.
- **CSS customizado**: `btn-primary`, `btn-secondary`, `btn-gold`, `input-field`, `label-field`, `card` em `globals.css`.
- **Perfis de acesso**: ADMIN, GESTOR, OPERADOR (enum `UserRole`).
- **Cálculo automático**: `valorTotal = toneladas × precoTonelada`.
- **Placa brasileira**: ABC-1234 e ABC1D23 (Mercosul). Validação em `lib/utils.ts`.
- **Webhook público**: `/api/webhook/whatsapp` é excluído do middleware de autenticação.
- **Oportunidades expiram**: 48h sem ação → expiradas automaticamente.
- **IA não responde em grupos**: apenas capta e notifica.

## Banco de Dados

Schema: `prisma/schema.prisma`. Modelos: User, Motorista, Caminhao, Transportadora, OrigemDestino, Frete, GrupoWhatsapp, Oportunidade.

Seed: `prisma/seed.ts` — admin (`admin@arteita.com.br` / `admin123`).

## Variáveis de Ambiente

Copiar `.env.example` para `.env`. Obrigatórios para dev: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`. Para WhatsApp: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`. Para IA: `ANTHROPIC_API_KEY`.
