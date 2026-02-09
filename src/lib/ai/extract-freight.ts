import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { db } from '@/lib/db';

// ============================================
// TYPES
// ============================================

export interface FreightExtractedData {
  data: string | null;
  origem: string | null;
  destino: string | null;
  toneladas: number | null;
  precoTonelada: number | null;
  valorTotal: number | null;
  transportadora: string | null;
  ticketNota: string | null;
  placa: string | null;
  motorista: string | null;
  observacao: string | null;
}

export interface OpportunityClassification {
  isOpportunity: boolean;
  tipoCarga: string | null;
  origem: string | null;
  destino: string | null;
  tonelagem: number | null;
  precoOferecido: number | null;
  urgencia: string | null;
  contato: string | null;
  prioridade: 'ALTA' | 'MEDIA' | 'BAIXA';
}

interface ExtractFreightInput {
  imageBase64?: string;
  imageMediaType?: string;
  text?: string;
}

interface ClassifyOpportunityConfig {
  keywords: string[];
  preferredRoutes: string[];
  minPricePerTon: number;
}

type AiProvider = 'claude' | 'kimi' | 'openai';

// ============================================
// AI PROVIDER DETECTION
// ============================================

function getProvider(): AiProvider {
  const provider = (process.env.AI_PROVIDER || 'claude').toLowerCase();
  if (provider === 'kimi' || provider === 'moonshot') return 'kimi';
  if (provider === 'openai') return 'openai';
  return 'claude';
}

function getAnthropicClient(): Anthropic {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

function getKimiClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.KIMI_API_KEY,
    baseURL: 'https://api.moonshot.ai/v1',
  });
}

function getOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

function getOpenAICompatibleClient(): OpenAI {
  const provider = getProvider();
  if (provider === 'kimi') return getKimiClient();
  return getOpenAIClient();
}

function getModel(): string {
  const provider = getProvider();
  switch (provider) {
    case 'kimi':
      return process.env.KIMI_MODEL || 'kimi-k2.5';
    case 'openai':
      return process.env.OPENAI_MODEL || 'gpt-4o';
    case 'claude':
    default:
      return process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';
  }
}

// ============================================
// GENERIC AI CALL
// ============================================

async function callAI(params: {
  systemPrompt: string;
  userText?: string;
  imageBase64?: string;
  imageMediaType?: string;
}): Promise<string> {
  const provider = getProvider();

  if (provider === 'claude') {
    return callAnthropic(params);
  }

  return callOpenAICompatible(params);
}

async function callAnthropic(params: {
  systemPrompt: string;
  userText?: string;
  imageBase64?: string;
  imageMediaType?: string;
}): Promise<string> {
  const client = getAnthropicClient();

  const content: Anthropic.MessageCreateParams['messages'][0]['content'] = [];

  if (params.imageBase64) {
    const mediaType = (params.imageMediaType || 'image/jpeg') as
      | 'image/jpeg'
      | 'image/png'
      | 'image/gif'
      | 'image/webp';

    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: params.imageBase64,
      },
    });
  }

  if (params.userText) {
    content.push({ type: 'text', text: params.userText });
  }

  if (content.length === 0) {
    throw new Error('Nenhum input fornecido para a IA.');
  }

  const response = await client.messages.create({
    model: getModel(),
    max_tokens: 1024,
    system: params.systemPrompt,
    messages: [{ role: 'user', content }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Sem resposta de texto da IA (Anthropic)');
  }

  return textBlock.text.trim();
}

async function callOpenAICompatible(params: {
  systemPrompt: string;
  userText?: string;
  imageBase64?: string;
  imageMediaType?: string;
}): Promise<string> {
  const client = getOpenAICompatibleClient();

  const userContent: OpenAI.ChatCompletionContentPart[] = [];

  if (params.imageBase64) {
    const mediaType = params.imageMediaType || 'image/jpeg';
    userContent.push({
      type: 'image_url',
      image_url: {
        url: `data:${mediaType};base64,${params.imageBase64}`,
      },
    });
  }

  if (params.userText) {
    userContent.push({ type: 'text', text: params.userText });
  }

  if (userContent.length === 0) {
    throw new Error('Nenhum input fornecido para a IA.');
  }

  const response = await client.chat.completions.create({
    model: getModel(),
    max_tokens: 1024,
    messages: [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: userContent },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error('Sem resposta de texto da IA');
  }

  return text.trim();
}

// ============================================
// PARSE JSON RESPONSE
// ============================================

function parseJsonResponse(rawText: string): Record<string, unknown> {
  let jsonString = rawText;
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonString = jsonMatch[1].trim();
  }
  return JSON.parse(jsonString);
}

// ============================================
// EXTRACT FREIGHT DATA
// ============================================

const EXTRACT_SYSTEM_PROMPT = `Voce e um assistente que extrai dados de tickets e comprovantes de frete. Analise a imagem ou texto e extraia os seguintes campos em JSON: { "data", "origem", "destino", "toneladas", "precoTonelada", "valorTotal", "transportadora", "ticketNota", "placa", "motorista", "observacao" }. Se nao conseguir identificar um campo, retorne null. Retorne APENAS o JSON, sem explicacoes.`;

export async function extractFreightData(
  input: ExtractFreightInput
): Promise<FreightExtractedData> {
  if (!input.imageBase64 && !input.text) {
    throw new Error('Forneça imageBase64 ou text.');
  }

  try {
    // Buscar configurações de IA e Prompt customizado
    const aiConfig = await db.aiSettings.findFirst({
      where: { active: true },
      orderBy: { updatedAt: 'desc' },
    });

    let systemPrompt = EXTRACT_SYSTEM_PROMPT;

    // Se houver prompt customizado, usa ele
    if (aiConfig?.freightExtractPrompt) {
      systemPrompt = aiConfig.freightExtractPrompt;
      // Garante instrução JSON se não tiver
      if (!systemPrompt.includes('JSON')) {
        systemPrompt += '\n\nIMPORTANTE: Retorne APENAS um objeto JSON válido com os campos extraídos, sem markdown.';
      }
    }

    const rawText = await callAI({
      systemPrompt: systemPrompt,
      userText: input.text ? `Texto da mensagem (Contexto complementar): "${input.text}"` : undefined,
      imageBase64: input.imageBase64,
      imageMediaType: input.imageMediaType,
    });

    const parsed = parseJsonResponse(rawText);

    return {
      data: (parsed.data as string) ?? null,
      origem: (parsed.origem as string) ?? null,
      destino: (parsed.destino as string) ?? null,
      toneladas: parsed.toneladas != null ? Number(parsed.toneladas) : null,
      precoTonelada: parsed.precoTonelada != null ? Number(parsed.precoTonelada) : null,
      valorTotal: parsed.valorTotal != null ? Number(parsed.valorTotal) : null,
      transportadora: (parsed.transportadora as string) ?? null,
      ticketNota: (parsed.ticketNota as string) ?? null,
      placa: (parsed.placa as string) ?? null,
      motorista: (parsed.motorista as string) ?? null,
      observacao: (parsed.observacao as string) ?? null,
    };
  } catch (error) {
    console.error('[extractFreightData] Erro:', error);
    throw error;
  }
}

// ============================================
// CLASSIFY OPPORTUNITY
// ============================================

export async function classifyOpportunity(
  message: string,
  config: ClassifyOpportunityConfig
): Promise<OpportunityClassification> {
  const systemPrompt = `Voce e um assistente que analisa mensagens de grupos de WhatsApp para identificar oportunidades de frete.

Analise a mensagem e determine:
1. Se e uma oportunidade de frete (isOpportunity: true/false)
2. Se sim, extraia: tipoCarga, origem, destino, tonelagem, precoOferecido, urgencia, contato
3. Classifique a prioridade como ALTA, MEDIA ou BAIXA baseado nos seguintes criterios:
   - Palavras-chave de interesse: ${config.keywords.join(', ')}
   - Rotas preferenciais: ${config.preferredRoutes.join(', ')}
   - Preco minimo por tonelada: R$ ${config.minPricePerTon}

   ALTA: contem palavras-chave E rota preferencial E preco acima do minimo
   MEDIA: atende pelo menos 2 dos 3 criterios
   BAIXA: atende 0 ou 1 criterio

Retorne APENAS JSON no formato:
{
  "isOpportunity": boolean,
  "tipoCarga": string | null,
  "origem": string | null,
  "destino": string | null,
  "tonelagem": number | null,
  "precoOferecido": number | null,
  "urgencia": string | null,
  "contato": string | null,
  "prioridade": "ALTA" | "MEDIA" | "BAIXA"
}`;

  try {
    const rawText = await callAI({
      systemPrompt,
      userText: message,
    });

    const parsed = parseJsonResponse(rawText);

    return {
      isOpportunity: Boolean(parsed.isOpportunity),
      tipoCarga: (parsed.tipoCarga as string) ?? null,
      origem: (parsed.origem as string) ?? null,
      destino: (parsed.destino as string) ?? null,
      tonelagem: parsed.tonelagem != null ? Number(parsed.tonelagem) : null,
      precoOferecido: parsed.precoOferecido != null ? Number(parsed.precoOferecido) : null,
      urgencia: (parsed.urgencia as string) ?? null,
      contato: (parsed.contato as string) ?? null,
      prioridade: ['ALTA', 'MEDIA', 'BAIXA'].includes(parsed.prioridade as string)
        ? (parsed.prioridade as 'ALTA' | 'MEDIA' | 'BAIXA')
        : 'BAIXA',
    };
  } catch (error) {
    console.error('[classifyOpportunity] Erro:', error);
    throw error;
  }
}
