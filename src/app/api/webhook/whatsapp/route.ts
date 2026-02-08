import { NextResponse } from 'next/server';
import { bot } from '@/lib/whatsapp/bot';
import { processGroupMessage } from '@/lib/whatsapp/group-monitor';
import { WhatsAppOfficialAPI } from '@/lib/whatsapp/official-api';
import { db } from '@/lib/db';

interface MessagePayload {
  type: 'text' | 'image' | 'document' | 'audio';
  text?: string;
  mediaMessageId?: string;
}

// ============================================
// EVOLUTION API MESSAGE PARSER
// ============================================

function extractMessagePayload(message: Record<string, unknown>): MessagePayload | null {
  if (message.conversation) {
    return { type: 'text', text: message.conversation as string };
  }
  if (message.extendedTextMessage) {
    const ext = message.extendedTextMessage as Record<string, unknown>;
    return { type: 'text', text: (ext.text as string) || '' };
  }
  if (message.imageMessage) {
    const img = message.imageMessage as Record<string, unknown>;
    return { type: 'image', text: (img.caption as string) || undefined };
  }
  if (message.documentMessage) {
    const doc = message.documentMessage as Record<string, unknown>;
    return { type: 'document', text: (doc.caption as string) || (doc.fileName as string) || undefined };
  }
  if (message.audioMessage) {
    return { type: 'audio' };
  }
  return null;
}

function extractTextFromMessage(message: Record<string, unknown>): string {
  if (message.conversation) return message.conversation as string;
  if (message.extendedTextMessage) {
    const ext = message.extendedTextMessage as Record<string, unknown>;
    return (ext.text as string) || '';
  }
  if (message.imageMessage) {
    const img = message.imageMessage as Record<string, unknown>;
    return (img.caption as string) || '';
  }
  if (message.documentMessage) {
    const doc = message.documentMessage as Record<string, unknown>;
    return (doc.caption as string) || '';
  }
  return '';
}

// ============================================
// GET — Verificação de Webhook (Meta Official API)
// ============================================

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Se não tem parâmetros de verificação, retorna status simples
  if (!mode && !token) {
    return NextResponse.json({ status: 'OK' }, { status: 200 });
  }

  // Verificação Meta Official API
  if (mode === 'subscribe' && token && challenge) {
    // Buscar verify token de configs ativas no banco
    const configs = await db.whatsAppConfig.findMany({
      where: { tipo: 'META_OFFICIAL', active: true },
      select: { metaVerifyToken: true },
    });

    const validToken = configs.some((c) => c.metaVerifyToken === token);

    // Fallback para env var
    const envToken = process.env.WHATSAPP_VERIFY_TOKEN;
    if (validToken || (envToken && envToken === token)) {
      return new Response(challenge, { status: 200 });
    }

    return new Response('Forbidden', { status: 403 });
  }

  return new Response('Bad Request', { status: 400 });
}

// ============================================
// POST — Receber Mensagens (Evolution API + Meta Official)
// ============================================

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Detectar origem do webhook
    if (body.object === 'whatsapp_business_account') {
      return handleMetaOfficialWebhook(body);
    }

    // Default: Evolution API format
    return handleEvolutionWebhook(body);
  } catch (error) {
    console.error('[WEBHOOK] Erro ao processar webhook:', error);
    return NextResponse.json({ status: 'error handled' }, { status: 200 });
  }
}

// ============================================
// EVOLUTION API HANDLER
// ============================================

async function handleEvolutionWebhook(body: Record<string, unknown>) {
  const { event, data } = body as { event: string; data: Record<string, unknown> };

  if (event !== 'messages.upsert') {
    return NextResponse.json({ status: 'ignored' }, { status: 200 });
  }

  if (!data || !data.key) {
    return NextResponse.json({ status: 'no data' }, { status: 200 });
  }

  const key = data.key as Record<string, unknown>;
  const message = data.message as Record<string, unknown>;

  if (key.fromMe) {
    return NextResponse.json({ status: 'own message' }, { status: 200 });
  }

  if (!message) {
    return NextResponse.json({ status: 'no message' }, { status: 200 });
  }

  const remoteJid = (key.remoteJid as string) || '';
  const messageId = (key.id as string) || '';

  const isGroup = remoteJid.endsWith('@g.us');
  const isPrivate = remoteJid.endsWith('@s.whatsapp.net');

  if (isPrivate) {
    const phoneNumber = remoteJid.replace('@s.whatsapp.net', '');
    const messagePayload = extractMessagePayload(message);
    if (!messagePayload) {
      return NextResponse.json({ status: 'unsupported' }, { status: 200 });
    }
    if (messagePayload.type !== 'text') {
      messagePayload.mediaMessageId = messageId;
    }
    await bot.handleIncomingMessage(phoneNumber, messagePayload);
  } else if (isGroup) {
    const groupId = remoteJid;
    const participant = (key.participant as string) || (data.participant as string) || '';
    const senderNumber = participant.replace('@s.whatsapp.net', '');
    const messageText = extractTextFromMessage(message);
    if (messageText) {
      await processGroupMessage(groupId, senderNumber, messageText);
    }
  }

  return NextResponse.json({ status: 'processed' }, { status: 200 });
}

// ============================================
// META OFFICIAL API HANDLER
// ============================================

async function handleMetaOfficialWebhook(body: Record<string, unknown>) {
  const parsed = WhatsAppOfficialAPI.parseWebhookPayload(body);

  if (!parsed || parsed.messages.length === 0) {
    return NextResponse.json({ status: 'no messages' }, { status: 200 });
  }

  for (const msg of parsed.messages) {
    const phoneNumber = msg.from;

    // Mensagens privadas (Meta Official não suporta grupos)
    const messagePayload: MessagePayload = {
      type: msg.type as MessagePayload['type'],
      text: msg.text || msg.caption,
      mediaMessageId: msg.mediaId,
    };

    if (['text', 'image', 'document', 'audio'].includes(msg.type)) {
      await bot.handleIncomingMessage(phoneNumber, messagePayload);
    }
  }

  return NextResponse.json({ status: 'processed' }, { status: 200 });
}
