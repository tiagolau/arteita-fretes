# PRD - Sistema de Gestão de Fretes

## Visão Geral

Sistema web interno para uma empresa de construção e sinalização gerenciar fretes dos seus caminhões. Os motoristas enviam tickets e comprovantes diretamente pelo WhatsApp, que são processados automaticamente. Uma IA monitora grupos de WhatsApp para captar oportunidades de frete em tempo real.

---

## Problema

- Controle de fretes feito manualmente (planilhas/papel), sem rastreabilidade
- Motoristas precisam ligar ou ir ao escritório para reportar cargas
- Oportunidades de frete em grupos de WhatsApp são perdidas por falta de monitoramento constante
- Dificuldade em gerar relatórios consolidados e controle financeiro

---

## Usuários

| Perfil | Descrição |
|--------|-----------|
| **Motorista** | Envia tickets/comprovantes de frete pelo WhatsApp |
| **Operador** | Valida fretes recebidos e registra manualmente quando necessário |
| **Gestor** | Consulta relatórios, acompanha indicadores, avalia oportunidades de frete |
| **Admin** | Gerencia cadastros, configurações de WhatsApp e regras da IA |

---

## Funcionalidades Principais

### 1. Registro de Frete

Formulário para cadastrar cada carga com os seguintes campos:

| Campo | Tipo | Obrigatório |
|-------|------|:-----------:|
| Data | Date | Sim |
| Origem | Text (selecionável) | Sim |
| Destino | Text (selecionável) | Sim |
| Toneladas | Número decimal | Sim |
| Preço por Tonelada (R$) | Número decimal | Sim |
| Transportadora | Seleção cadastrada | Sim |
| Ticket / Nota | Text | Sim |
| Placa do Caminhão | Seleção cadastrada | Sim |
| Motorista | Seleção cadastrada | Sim |
| Observação | Texto livre | Não |
| **Valor Total do Frete (R$)** | Calculado (Toneladas × Preço/Ton) | Auto |
| Anexos (fotos/PDF) | Arquivos recebidos via WhatsApp | Não |
| Status | Pendente / Validado / Rejeitado | Auto |

---

### 2. Integração WhatsApp — Recebimento de Tickets

Motoristas enviam tickets e comprovantes de frete pelo WhatsApp. O sistema recebe, processa e cria registros automaticamente.

#### Arquitetura de Integração

```
Motorista (WhatsApp)
    ↓
Evolution API (self-hosted) ←→ Fallback: API Oficial Meta WhatsApp
    ↓
Webhook → Backend (Node.js)
    ↓
IA (extração de dados) → Cria registro de frete
    ↓
Responde ao motorista com confirmação
```

#### Fluxo do Motorista

1. Motorista envia mensagem para o número da empresa no WhatsApp
2. Bot responde com menu: `"Envie o ticket do frete (foto ou PDF)"`
3. Motorista envia foto do ticket / comprovante / nota
4. **IA extrai os dados automaticamente** da imagem:
   - OCR na imagem → extrai texto
   - LLM interpreta e mapeia para os campos do frete (data, origem, destino, toneladas, valor, placa, etc.)
5. Bot responde com resumo: _"Frete registrado: 25t de São Paulo → Campinas, R$ 3.750,00. Confirma? (Sim/Não)"_
6. Motorista confirma → frete salvo com status **Pendente** (aguarda validação do operador)
7. Se dados incompletos → bot pergunta os campos faltantes em conversa natural

#### Mensagens Suportadas

| Tipo | Processamento |
|------|--------------|
| Foto do ticket | OCR + IA extrai dados |
| PDF do ticket | Parser PDF + IA extrai dados |
| Texto livre | IA interpreta e preenche campos |
| Áudio | Speech-to-text + IA interpreta |

#### Dual API (Evolution + Oficial)

| Aspecto | Evolution API | API Oficial Meta |
|---------|--------------|-----------------|
| Uso primário | Operação principal (sem custo por mensagem) | Fallback e envios em massa |
| Hospedagem | Self-hosted (VPS próprio) | Cloud Meta |
| Custo | Servidor apenas | Por mensagem/conversa |
| Estabilidade | Depende de sessão WhatsApp Web | Alta disponibilidade |
| Recursos | Grupos, status, reações | Templates aprovados, catálogo |

**Estratégia:** Evolution API como canal principal. Se a sessão cair ou falhar, o sistema automaticamente roteia para a API Oficial até a reconexão.

#### Configurações (Admin)

- Número do WhatsApp conectado
- URL da instância Evolution API
- Token da API Oficial Meta (WhatsApp Business)
- Mensagens de boas-vindas e templates de confirmação
- Tempo de timeout da conversa (ex: 10 min sem resposta → encerra sessão)

---

### 3. IA em Grupos de WhatsApp — Captação de Oportunidades de Frete

A IA monitora grupos de WhatsApp do setor e identifica oportunidades de frete relevantes.

#### Fluxo

```
Grupos de WhatsApp (mercado de fretes)
    ↓
Evolution API (conectada aos grupos)
    ↓
Webhook → Backend recebe TODAS as mensagens dos grupos
    ↓
IA analisa cada mensagem em tempo real
    ↓
Oportunidade detectada?
    SIM → Salva no painel + Notifica gestor
    NÃO → Descarta silenciosamente
```

#### O que a IA identifica

| Dado Extraído | Exemplo na mensagem |
|---------------|-------------------|
| Tipo de carga | _"Preciso de frete para areia lavada"_ |
| Origem / Destino | _"Saindo de Guarulhos para Sorocaba"_ |
| Tonelagem | _"30 toneladas"_ |
| Preço oferecido | _"Pago R$ 45 a tonelada"_ |
| Urgência | _"Preciso pra amanhã cedo"_ |
| Contato | Número de quem postou no grupo |

#### Classificação da Oportunidade

| Prioridade | Critério |
|-----------|---------|
| **Alta** | Rota conhecida da empresa + preço acima da média + carga compatível |
| **Média** | Rota viável + preço na média |
| **Baixa** | Rota distante ou preço abaixo da média |

#### Painel de Oportunidades (Web)

- Lista de oportunidades captadas com dados extraídos
- Filtros: prioridade, rota, tipo de carga, data
- Status: Nova → Em Análise → Aceita → Descartada
- Ação rápida: "Responder no grupo" ou "Contatar no privado" (via Evolution API)
- Histórico de oportunidades por grupo

#### Configurações (Admin)

- Grupos monitorados (adicionar/remover por ID do grupo)
- Palavras-chave de interesse (ex: "areia", "brita", "construção", "sinalização")
- Rotas de interesse (origens/destinos prioritários)
- Preço mínimo por tonelada (para filtrar oportunidades ruins)
- Horário de monitoramento (ex: apenas horário comercial)
- Regras de notificação (WhatsApp do gestor, email, push no painel)

---

### 4. Cadastros Base

CRUD para entidades reutilizáveis:
- **Motoristas** — nome, CNH, telefone, WhatsApp (para vincular mensagens)
- **Caminhões** — placa, modelo, capacidade (ton)
- **Transportadoras** — razão social, CNPJ, contato
- **Origens/Destinos** — locais frequentes (nome, cidade/UF)
- **Grupos de WhatsApp** — nome do grupo, ID, status (ativo/pausado), palavras-chave

### 5. Listagem e Consulta de Fretes

- Tabela com todos os fretes (manuais + recebidos via WhatsApp)
- Coluna "Origem do registro": Manual / WhatsApp
- Filtros por: período, origem/destino, transportadora, motorista, placa, status
- Ordenação por data, valor, tonelagem
- Busca por ticket/nota
- Visualização do anexo original (foto/PDF enviado pelo motorista)

### 6. Relatórios e Exportação

- **Resumo por período** — total de fretes, toneladas e valor
- **Resumo por transportadora** — quantos fretes, valor total
- **Resumo por motorista** — quantos fretes, toneladas transportadas
- **Resumo por rota** (origem/destino) — volume e valor
- **Relatório de oportunidades** — captadas vs aceitas vs convertidas em frete
- **Exportação** — CSV e PDF

---

## Regras de Negócio

1. `Valor Total = Toneladas × Preço por Tonelada` — calculado automaticamente
2. Placa do caminhão deve seguir formato brasileiro (ABC-1234 ou ABC1D23)
3. Ticket/Nota deve ser único por registro (sem duplicatas)
4. Fretes registrados podem ser editados, mas não excluídos (soft delete com motivo)
5. Fretes criados via WhatsApp entram com status **Pendente** até validação do operador
6. Motorista só é reconhecido se seu WhatsApp estiver cadastrado no sistema
7. Motorista não cadastrado recebe mensagem: _"Número não reconhecido. Procure o escritório para cadastro."_
8. Oportunidades de frete expiram automaticamente após 48h sem ação
9. IA não responde em grupos automaticamente — apenas capta e notifica (evitar spam)

---

## Requisitos Não-Funcionais

- **Responsivo** — desktop e tablet (escritório e campo)
- **Autenticação** — login email/senha com controle de perfis
- **Performance** — listagem deve suportar +10.000 registros com paginação
- **Backup** — banco de dados com backup diário
- **Alta disponibilidade do WhatsApp** — fallback automático Evolution → API Oficial
- **Fila de mensagens** — mensagens do WhatsApp processadas via fila (Redis/BullMQ) para não perder nada
- **Armazenamento de mídia** — fotos e PDFs salvos em storage (S3 ou similar)
- **Rate limiting** — respeitar limites da API Oficial Meta (1.000 conversas/dia no tier gratuito)
- **Logs de IA** — toda decisão da IA (extração de dados, classificação de oportunidade) deve ser logada para auditoria

---

## Stack Sugerida

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React + Next.js |
| Backend/API | Node.js + Next.js API Routes |
| Banco de Dados | PostgreSQL |
| ORM | Prisma |
| Autenticação | NextAuth.js |
| Estilo | Tailwind CSS |
| Fila de mensagens | Redis + BullMQ |
| WhatsApp (primário) | Evolution API (self-hosted) |
| WhatsApp (fallback) | API Oficial Meta (Cloud API) |
| IA / LLM | Claude API ou OpenAI API |
| OCR | Google Vision API ou Tesseract |
| Speech-to-text | Whisper (OpenAI) |
| Storage de mídia | AWS S3 ou MinIO (self-hosted) |
| Relatórios PDF | @react-pdf/renderer |

---

## MVP (Versão 1) — Frete + WhatsApp Básico

1. Login básico (email/senha)
2. CRUD de cadastros base (motoristas, caminhões, transportadoras, rotas)
3. Registro manual de frete com todos os campos
4. Listagem de fretes com filtros
5. Exportação CSV
6. **Integração WhatsApp via Evolution API:**
   - Motorista envia foto do ticket
   - IA extrai dados e cria frete como Pendente
   - Bot confirma com motorista
   - Operador valida no painel

### Versão 2 — Captação de Oportunidades

7. Monitoramento de grupos de WhatsApp
8. IA identifica e classifica oportunidades
9. Painel de oportunidades com filtros e ações
10. Notificações ao gestor (WhatsApp + painel)
11. Fallback para API Oficial Meta

### Versão 3 — Inteligência e Escala

12. Dashboard com gráficos e indicadores
13. Relatórios PDF
14. Processamento de áudio (Whisper)
15. Sugestão automática de preço baseada em histórico
16. Integração com sistemas contábeis

---

## Métricas de Sucesso

| Métrica | Meta |
|---------|------|
| Tempo para registrar frete (manual) | < 1 minuto |
| Tempo para registrar frete (WhatsApp) | < 30 segundos (motorista envia foto e confirma) |
| Precisão da IA na extração de tickets | > 90% dos campos extraídos corretamente |
| Consulta de histórico | < 10 segundos |
| Oportunidades captadas vs perdidas | Captar > 95% das oportunidades postadas nos grupos |
| Tempo entre oportunidade e notificação | < 2 minutos |
| Adoção pela equipe | 100% dos fretes no sistema em 30 dias |
