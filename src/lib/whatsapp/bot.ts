import { whatsapp } from './index';
import {
  extractFreightData,
  FreightExtractedData,
} from '../ai/extract-freight';
import { db } from '../db';

// ============================================
// TYPES
// ============================================

type ConversationState =
  | 'IDLE'
  | 'AWAITING_TICKET'
  | 'AWAITING_CONFIRMATION'
  | 'AWAITING_MISSING_FIELDS';

interface ConversationSession {
  state: ConversationState;
  data: Partial<FreightExtractedData>;
  missingFields: string[];
  lastActivity: Date;
  motoristaId: string;
  motoristaNome: string;
}

interface MessagePayload {
  text?: string;
  imageBase64?: string;
  imageMediaType?: string;
  documentBase64?: string;
  mediaMessageId?: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video';
}

// ============================================
// SESSION MANAGEMENT
// ============================================

const sessions = new Map<string, ConversationSession>();

const SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const REQUIRED_FIELDS: (keyof FreightExtractedData)[] = [
  'data',
  'origem',
  'destino',
  'toneladas',
  'precoTonelada',
  'transportadora',
  'ticketNota',
  'placa',
  'motorista',
];

const FIELD_LABELS: Record<string, string> = {
  data: 'Data',
  origem: 'Origem',
  destino: 'Destino',
  toneladas: 'Toneladas',
  precoTonelada: 'Preco por Tonelada',
  valorTotal: 'Valor Total',
  transportadora: 'Transportadora',
  ticketNota: 'Ticket/Nota',
  placa: 'Placa',
  motorista: 'Motorista',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Normaliza número de telefone brasileiro para comparação.
 * Retorna array com variações possíveis (com e sem 9º dígito).
 * Ex: "31991570107" → ["5531991570107", "553191570107"]
 */
function normalizePhoneVariations(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  const variations: string[] = [];

  let full = digits;
  // Se tem 10 ou 11 dígitos (sem código do país), adiciona 55
  if (full.length === 10 || full.length === 11) {
    full = `55${full}`;
  }
  variations.push(full);

  // Gerar variação com/sem 9º dígito (Brasil: 55 + DDD(2) + número)
  if (full.startsWith('55') && full.length >= 12) {
    const ddd = full.substring(2, 4);
    const local = full.substring(4);

    if (local.length === 9 && local.startsWith('9')) {
      // Tem 9 dígitos, gerar variação sem o 9 extra
      variations.push(`55${ddd}${local.substring(1)}`);
    } else if (local.length === 8) {
      // Tem 8 dígitos, gerar variação com 9 extra
      variations.push(`55${ddd}9${local}`);
    }
  }

  return variations;
}

/** Normaliza para formato padrão (apenas para log) */
function normalizePhone(phone: string): string {
  return normalizePhoneVariations(phone)[0];
}

function cleanExpiredSessions(): void {
  const now = Date.now();
  for (const [key, session] of sessions.entries()) {
    if (now - session.lastActivity.getTime() > SESSION_TIMEOUT_MS) {
      sessions.delete(key);
    }
  }
}

function getSession(from: string): ConversationSession | undefined {
  return sessions.get(from);
}

function setSession(from: string, session: ConversationSession): void {
  session.lastActivity = new Date();
  sessions.set(from, session);
}

function deleteSession(from: string): void {
  sessions.delete(from);
}

function getMissingFields(
  data: Partial<FreightExtractedData>
): string[] {
  return REQUIRED_FIELDS.filter(
    (field) => data[field] === null || data[field] === undefined
  );
}

function formatSummary(data: Partial<FreightExtractedData>): string {
  const lines: string[] = ['*Resumo do Frete:*', ''];
  for (const field of REQUIRED_FIELDS) {
    const label = FIELD_LABELS[field] || field;
    const value = data[field];
    if (value !== null && value !== undefined) {
      lines.push(`- ${label}: ${value}`);
    }
  }
  if (data.valorTotal) {
    lines.push(`- Valor Total: R$ ${Number(data.valorTotal).toFixed(2)}`);
  }
  if (data.observacao) {
    lines.push(`- Observacao: ${data.observacao}`);
  }
  lines.push('');
  lines.push('Esta correto? Responda *sim* para confirmar ou *nao* para cancelar.');
  return lines.join('\n');
}

function formatMissingFieldsRequest(missingFields: string[]): string {
  const labels = missingFields.map(
    (f) => FIELD_LABELS[f] || f
  );
  return `Nao consegui identificar os seguintes campos:\n${labels.map((l) => `- ${l}`).join('\n')}\n\nPor favor, envie as informacoes que faltam em uma mensagem de texto.`;
}

// ============================================
// MAIN HANDLER
// ============================================

async function handleIncomingMessage(
  from: string,
  message: MessagePayload
): Promise<void> {
  // Clean expired sessions on every call
  cleanExpiredSessions();

  // Look up motorista by WhatsApp number (normalized, com variações do 9º dígito)
  const fromVariations = normalizePhoneVariations(from);
  console.log(`[Bot] Mensagem de: ${from} | Variações: ${fromVariations.join(', ')}`);

  const motoristas = await db.motorista.findMany({
    where: {
      active: true,
      whatsapp: { not: null },
    },
  });

  const motorista = motoristas.find((m) => {
    if (!m.whatsapp) return false;
    const mVariations = normalizePhoneVariations(m.whatsapp);
    // Match se qualquer variação do remetente bater com qualquer variação do cadastro
    return fromVariations.some((fv) => mVariations.includes(fv));
  });

  if (!motorista) {
    console.log(`[Bot] Nenhum match. Motoristas: ${motoristas.map((m) => `${m.nome}: ${m.whatsapp} -> ${normalizePhoneVariations(m.whatsapp || '').join('/')}`).join(' | ')}`);
  }

  if (!motorista) {
    await whatsapp.sendText(
      from,
      'Numero nao reconhecido. Procure o escritorio para cadastro.'
    );
    return;
  }

  let session = getSession(from);

  console.log(`[Bot] Sessão atual para ${from}: ${session ? session.state : 'NOVA'} | Motorista: ${motorista.nome}`);

  // If no session exists, start a new one
  if (!session) {
    session = {
      state: 'IDLE',
      data: {},
      missingFields: [],
      lastActivity: new Date(),
      motoristaId: motorista.id,
      motoristaNome: motorista.nome,
    };
    setSession(from, session);
    console.log(`[Bot] Nova sessão criada (IDLE)`);
  } else {
    // Atualiza timestamp
    session.lastActivity = new Date();
    sessions.set(from, session);
  }

  const oldState = session.state;

  switch (session.state) {
    case 'IDLE':
      await handleIdle(from, session, message);
      break;

    case 'AWAITING_TICKET':
      await handleAwaitingTicket(from, message, session);
      break;

    case 'AWAITING_CONFIRMATION':
      await handleAwaitingConfirmation(from, message, session);
      break;

    case 'AWAITING_MISSING_FIELDS':
      await handleAwaitingMissingFields(from, message, session);
      break;

    default:
      console.warn(`[Bot] Estado desconhecido: ${session.state}. Resetando para IDLE.`);
      session.state = 'IDLE';
      setSession(from, session);
      await handleIdle(from, session, message);
  }

  if (oldState !== session.state) {
    console.log(`[Bot] Transição de estado: ${oldState} -> ${session.state} para ${from}`);
  }
}

// ============================================
// STATE HANDLERS
// ============================================

async function handleIdle(
  from: string,
  session: ConversationSession,
  message?: MessagePayload // Adicionado parametro opcional message
): Promise<void> {
  // Se já veio com mídia na primeira mensagem, processa direto
  if (message && (message.type === 'image' || message.type === 'document' || message.imageBase64)) {
    console.log(`[Bot] handleIdle: Mídia detectada na primeira mensagem. Processando como ticket...`);
    session.state = 'AWAITING_TICKET';
    setSession(from, session);
    await handleAwaitingTicket(from, message, session);
    return;
  }

  console.log(`[Bot] handleIdle: Enviando boas-vindas para ${from}`);
  await whatsapp.sendText(
    from,
    `Ola ${session.motoristaNome}! Envie o ticket do frete (foto ou PDF) para registrar.`
  );
  session.state = 'AWAITING_TICKET';
  setSession(from, session);
}

async function handleAwaitingTicket(
  from: string,
  message: MessagePayload,
  session: ConversationSession
): Promise<void> {
  let extractedData: FreightExtractedData;

  try {
    if (
      (message.type === 'image' || message.type === 'document') &&
      message.mediaMessageId
    ) {
      console.log(`[Bot] Recebida Mídia (${message.type}). Iniciando extração IA...`);
      // Download media and extract data from image
      const mediaBuffer = await whatsapp.downloadMedia(message.mediaMessageId);
      const base64 = mediaBuffer.toString('base64');
      const mediaType =
        message.type === 'image' ? 'image/jpeg' : 'image/png';

      extractedData = await extractFreightData({
        imageBase64: base64,
        imageMediaType: message.imageMediaType || mediaType,
      });
    } else if (
      message.type === 'image' &&
      message.imageBase64
    ) {
      console.log(`[Bot] Recebida Imagem Base64. Iniciando extração IA...`);
      extractedData = await extractFreightData({
        imageBase64: message.imageBase64,
        imageMediaType: message.imageMediaType || 'image/jpeg',
      });
    } else if (message.text) {
      console.log(`[Bot] Recebido Texto. Iniciando extração IA...`);
      extractedData = await extractFreightData({
        text: message.text,
      });
    } else {
      console.log(`[Bot] Mensagem não suportada ou sem conteúdo válido.`);
      await whatsapp.sendText(
        from,
        'Por favor, envie uma foto do ticket, um PDF ou uma descricao em texto do frete.'
      );
      return;
    }

    console.log(`[Bot] Extração IA concluída com sucesso. Dados:`, JSON.stringify(extractedData));
  } catch (error) {
    console.error('[Bot] Error extracting freight data:', error);
    await whatsapp.sendText(
      from,
      'Desculpe, nao consegui processar o ticket. Tente novamente com uma foto mais nitida ou envie os dados por texto.'
    );
    return;
  }

  session.data = extractedData;

  // Calculate valorTotal if we have toneladas and precoTonelada
  if (
    extractedData.toneladas &&
    extractedData.precoTonelada &&
    !extractedData.valorTotal
  ) {
    session.data.valorTotal =
      extractedData.toneladas * extractedData.precoTonelada;
  }

  const missing = getMissingFields(session.data);

  if (missing.length === 0) {
    // All required fields present - ask for confirmation
    const summary = formatSummary(session.data);
    await whatsapp.sendText(from, summary);
    session.state = 'AWAITING_CONFIRMATION';
    session.missingFields = [];
  } else {
    // Some fields are missing
    await whatsapp.sendText(from, formatMissingFieldsRequest(missing));
    session.state = 'AWAITING_MISSING_FIELDS';
    session.missingFields = missing;
  }

  setSession(from, session);
}

async function handleAwaitingConfirmation(
  from: string,
  message: MessagePayload,
  session: ConversationSession
): Promise<void> {
  const text = (message.text || '').trim().toLowerCase();

  if (['sim', 's', 'confirmo'].includes(text)) {
    try {
      // Create the frete in the database
      // We need to look up or create origemId, destinoId, transportadoraId, caminhaoId
      const origemRecord = await findOrCreateOrigemDestino(
        session.data.origem || 'Desconhecido'
      );
      const destinoRecord = await findOrCreateOrigemDestino(
        session.data.destino || 'Desconhecido'
      );
      const transportadoraRecord = await findOrCreateTransportadora(
        session.data.transportadora || 'Desconhecida'
      );
      const caminhaoRecord = await findOrCreateCaminhao(
        session.data.placa || 'SEM-PLACA'
      );

      await db.frete.create({
        data: {
          data: session.data.data
            ? new Date(session.data.data)
            : new Date(),
          origemId: origemRecord.id,
          destinoId: destinoRecord.id,
          toneladas: Number(session.data.toneladas) || 0,
          precoTonelada: Number(session.data.precoTonelada) || 0,
          valorTotal: Number(session.data.valorTotal) || 0,
          transportadoraId: transportadoraRecord.id,
          ticketNota: session.data.ticketNota || `WA-${Date.now()}`,
          caminhaoId: caminhaoRecord.id,
          motoristaId: session.motoristaId,
          observacao: session.data.observacao || null,
          status: 'PENDENTE',
          origemRegistro: 'WHATSAPP',
        },
      });

      await whatsapp.sendText(
        from,
        'Frete registrado com sucesso! Aguardando validacao.'
      );
    } catch (error) {
      console.error('[Bot] Error creating frete:', error);
      await whatsapp.sendText(
        from,
        'Desculpe, ocorreu um erro ao registrar o frete. Tente novamente mais tarde.'
      );
    }

    session.state = 'IDLE';
    session.data = {};
    session.missingFields = [];
    deleteSession(from);
  } else if (['nao', 'n', 'cancelar', 'não'].includes(text)) {
    await whatsapp.sendText(
      from,
      'Frete cancelado. Envie um novo ticket quando quiser.'
    );
    session.state = 'IDLE';
    session.data = {};
    session.missingFields = [];
    deleteSession(from);
  } else {
    await whatsapp.sendText(
      from,
      'Por favor, responda *sim* para confirmar ou *nao* para cancelar.'
    );
  }
}

async function handleAwaitingMissingFields(
  from: string,
  message: MessagePayload,
  session: ConversationSession
): Promise<void> {
  if (!message.text) {
    await whatsapp.sendText(
      from,
      'Por favor, envie as informacoes que faltam em uma mensagem de texto.'
    );
    return;
  }

  // Try to extract the missing fields from the text using AI
  try {
    const supplementaryData = await extractFreightData({
      text: message.text,
    });

    // Merge only the missing fields
    for (const field of session.missingFields) {
      const key = field as keyof FreightExtractedData;
      if (
        supplementaryData[key] !== null &&
        supplementaryData[key] !== undefined
      ) {
        (session.data as any)[key] = supplementaryData[key];
      }
    }

    // Recalculate valorTotal if needed
    if (
      session.data.toneladas &&
      session.data.precoTonelada &&
      !session.data.valorTotal
    ) {
      session.data.valorTotal =
        Number(session.data.toneladas) * Number(session.data.precoTonelada);
    }
  } catch (error) {
    console.error('[Bot] Error extracting supplementary data:', error);
    // Even if AI extraction fails, try simple field parsing below
  }

  // Check which fields are still missing
  const stillMissing = getMissingFields(session.data);

  if (stillMissing.length === 0) {
    // All fields now present - show summary
    const summary = formatSummary(session.data);
    await whatsapp.sendText(from, summary);
    session.state = 'AWAITING_CONFIRMATION';
    session.missingFields = [];
  } else {
    // Still missing some fields
    await whatsapp.sendText(from, formatMissingFieldsRequest(stillMissing));
    session.missingFields = stillMissing;
  }

  setSession(from, session);
}

// ============================================
// DATABASE HELPER FUNCTIONS
// ============================================

async function findOrCreateOrigemDestino(
  nome: string
): Promise<{ id: string }> {
  const existing = await db.origemDestino.findFirst({
    where: {
      nome: {
        equals: nome,
        mode: 'insensitive',
      },
      active: true,
    },
  });

  if (existing) return existing;

  return db.origemDestino.create({
    data: { nome },
  });
}

async function findOrCreateTransportadora(
  razaoSocial: string
): Promise<{ id: string }> {
  const existing = await db.transportadora.findFirst({
    where: {
      razaoSocial: {
        equals: razaoSocial,
        mode: 'insensitive',
      },
      active: true,
    },
  });

  if (existing) return existing;

  return db.transportadora.create({
    data: { razaoSocial },
  });
}

async function findOrCreateCaminhao(
  placa: string
): Promise<{ id: string }> {
  const existing = await db.caminhao.findFirst({
    where: {
      placa: {
        equals: placa,
        mode: 'insensitive',
      },
      active: true,
    },
  });

  if (existing) return existing;

  return db.caminhao.create({
    data: { placa },
  });
}

// ============================================
// EXPORTS
// ============================================

export const bot = { handleIncomingMessage };
