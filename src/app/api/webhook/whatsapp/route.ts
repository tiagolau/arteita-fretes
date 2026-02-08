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
  console.log('[WEBHOOK] Extracting payload from:', JSON.stringify(message));
  if (message.conversation) {
    console.log('[WEBHOOK] Type detected: text (conversation)');
    return { type: 'text', text: message.conversation as string };
  }
  if (message.extendedTextMessage) {
    console.log('[WEBHOOK] Type detected: extendedText');
    const ext = message.extendedTextMessage as Record<string, unknown>;
    return { type: 'text', text: (ext.text as string) || '' };
  }
  if (message.imageMessage) {
    console.log('[WEBHOOK] Type detected: image');
    const img = message.imageMessage as Record<string, unknown>;
    return { type: 'image', text: (img.caption as string) || undefined };
  }
  if (message.documentMessage) {
    console.log('[WEBHOOK] Type detected: document');
    const doc = message.documentMessage as Record<string, unknown>;
    return { type: 'document', text: (doc.caption as string) || (doc.fileName as string) || undefined };
  }
  if (message.audioMessage) {
    console.log('[WEBHOOK] Type detected: audio');
    return { type: 'audio' };
  }

  // Suporte a viewOnceMessage (imagens/vídeos de visualização única)
  if (message.viewOnceMessage) {
    console.log('[WEBHOOK] Type detected: viewOnceMessage');
    const viewOnce = message.viewOnceMessage as Record<string, unknown>;
    const messageContent = viewOnce.message as Record<string, unknown>;
    if (messageContent) {
      return extractMessagePayload(messageContent);
    }
  }

  // Suporte a viewOnceMessageV2
  if (message.viewOnceMessageV2) {
    console.log('[WEBHOOK] Type detected: viewOnceMessageV2');
    const viewOnce = message.viewOnceMessageV2 as Record<string, unknown>;
    const messageContent = viewOnce.message as Record<string, unknown>;
    if (messageContent) {
      return extractMessagePayload(messageContent);
    }
  }

  console.log('[WEBHOOK] Unknown message type');
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
    console.log('[WEBHOOK] Recebido payload:', JSON.stringify(body, null, 2));

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
    console.log(`[WEBHOOK] Private message from ${remoteJid}`);
    const phoneNumber = remoteJid.replace('@s.whatsapp.net', '');
    const messagePayload = extractMessagePayload(message);

    if (!messagePayload) {
      console.log('[WEBHOOK] Payload extraction failed or unsupported type');
      return NextResponse.json({ status: 'unsupported' }, { status: 200 });
    }

    if (messagePayload.type !== 'text') {
      messagePayload.mediaMessageId = messageId;
      console.log(`[WEBHOOK] Media message detected. ID: ${messageId}`);
    } else {
      console.log('[WEBHOOK] Text message detected');
    }

    await bot.handleIncomingMessage(phoneNumber, messagePayload);
  } else if (isGroup) {
    console.log(`[WEBHOOK] Group message from ${remoteJid}`);
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
