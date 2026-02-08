import Anthropic from '@anthropic-ai/sdk';

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

// ============================================
// AI CLIENT
// ============================================

function getAnthropicClient(): Anthropic {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

// ============================================
// EXTRACT FREIGHT DATA
// ============================================

const EXTRACT_SYSTEM_PROMPT = `Voce e um assistente que extrai dados de tickets e comprovantes de frete. Analise a imagem ou texto e extraia os seguintes campos em JSON: { "data", "origem", "destino", "toneladas", "precoTonelada", "valorTotal", "transportadora", "ticketNota", "placa", "motorista", "observacao" }. Se nao conseguir identificar um campo, retorne null. Retorne APENAS o JSON, sem explicacoes.`;

export async function extractFreightData(
  input: ExtractFreightInput
): Promise<FreightExtractedData> {
  const client = getAnthropicClient();

  const content: Anthropic.MessageCreateParams['messages'][0]['content'] = [];

  if (input.imageBase64) {
    const mediaType = (input.imageMediaType || 'image/jpeg') as
      | 'image/jpeg'
      | 'image/png'
      | 'image/gif'
      | 'image/webp';

    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: input.imageBase64,
      },
    });
  }

  if (input.text) {
    content.push({
      type: 'text',
      text: input.text,
    });
  }

  if (content.length === 0) {
    throw new Error(
      '[extractFreightData] No input provided. Provide imageBase64 or text.'
    );
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: EXTRACT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    const rawText = textBlock.text.trim();

    // Try to extract JSON from the response (handle potential markdown code blocks)
    let jsonString = rawText;
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonString = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonString);

    return {
      data: parsed.data ?? null,
      origem: parsed.origem ?? null,
      destino: parsed.destino ?? null,
      toneladas: parsed.toneladas != null ? Number(parsed.toneladas) : null,
      precoTonelada:
        parsed.precoTonelada != null ? Number(parsed.precoTonelada) : null,
      valorTotal:
        parsed.valorTotal != null ? Number(parsed.valorTotal) : null,
      transportadora: parsed.transportadora ?? null,
      ticketNota: parsed.ticketNota ?? null,
      placa: parsed.placa ?? null,
      motorista: parsed.motorista ?? null,
      observacao: parsed.observacao ?? null,
    };
  } catch (error) {
    console.error('[extractFreightData] Error extracting freight data:', error);
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
  const client = getAnthropicClient();

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
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    const rawText = textBlock.text.trim();

    let jsonString = rawText;
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonString = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonString);

    return {
      isOpportunity: Boolean(parsed.isOpportunity),
      tipoCarga: parsed.tipoCarga ?? null,
      origem: parsed.origem ?? null,
      destino: parsed.destino ?? null,
      tonelagem: parsed.tonelagem != null ? Number(parsed.tonelagem) : null,
      precoOferecido:
        parsed.precoOferecido != null ? Number(parsed.precoOferecido) : null,
      urgencia: parsed.urgencia ?? null,
      contato: parsed.contato ?? null,
      prioridade: ['ALTA', 'MEDIA', 'BAIXA'].includes(parsed.prioridade)
        ? parsed.prioridade
        : 'BAIXA',
    };
  } catch (error) {
    console.error('[classifyOpportunity] Error classifying opportunity:', error);
    throw error;
  }
}
