import axios from 'axios';

interface OfficialApiConfig {
  token: string;
  phoneId: string;
  verifyToken?: string;
  appSecret?: string;
}

const GRAPH_API_VERSION = 'v20.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export class WhatsAppOfficialAPI {
  private token: string;
  private phoneId: string;
  private verifyToken: string;
  private appSecret: string;

  constructor(config?: OfficialApiConfig) {
    this.token = config?.token || process.env.WHATSAPP_BUSINESS_TOKEN || '';
    this.phoneId = config?.phoneId || process.env.WHATSAPP_BUSINESS_PHONE_ID || '';
    this.verifyToken = config?.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN || '';
    this.appSecret = config?.appSecret || '';

    if (!this.token || !this.phoneId) {
      console.warn(
        '[WhatsAppOfficialAPI] Token ou Phone ID não configurados'
      );
    }
  }

  // ============================================
  // VERIFICAÇÃO
  // ============================================

  getVerifyToken(): string {
    return this.verifyToken;
  }

  isConfigured(): boolean {
    return Boolean(this.token) && Boolean(this.phoneId);
  }

  // ============================================
  // MENSAGENS
  // ============================================

  async sendText(number: string, text: string): Promise<void> {
    await axios.post(
      `${GRAPH_API_BASE}/${this.phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: number,
        type: 'text',
        text: {
          body: text,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  async sendMedia(
    number: string,
    type: 'image' | 'document' | 'video' | 'audio',
    url: string,
    caption?: string,
    fileName?: string
  ): Promise<void> {
    const mediaPayload: Record<string, unknown> = { link: url };
    if (caption) mediaPayload.caption = caption;
    if (fileName) mediaPayload.filename = fileName;

    await axios.post(
      `${GRAPH_API_BASE}/${this.phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: number,
        type,
        [type]: mediaPayload,
      },
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // ============================================
  // MÍDIA
  // ============================================

  async downloadMedia(mediaId: string): Promise<Buffer> {
    // Step 1: Get media URL
    const metaResponse = await axios.get(
      `${GRAPH_API_BASE}/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      }
    );

    const mediaUrl = metaResponse.data?.url;
    if (!mediaUrl) {
      throw new Error('URL de mídia não retornada pela Meta API');
    }

    // Step 2: Download binary (URL expires in 5 min)
    const mediaResponse = await axios.get(mediaUrl, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      responseType: 'arraybuffer',
    });

    return Buffer.from(mediaResponse.data);
  }

  // ============================================
  // UTILIDADES
  // ============================================

  async markAsRead(messageId: string): Promise<void> {
    await axios.post(
      `${GRAPH_API_BASE}/${this.phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      },
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // ============================================
  // PARSER DE WEBHOOK
  // ============================================

  static parseWebhookPayload(body: Record<string, unknown>): {
    messages: Array<{
      from: string;
      id: string;
      timestamp: string;
      type: string;
      text?: string;
      mediaId?: string;
      caption?: string;
      fileName?: string;
    }>;
  } | null {
    try {
      const entry = (body.entry as Array<Record<string, unknown>>)?.[0];
      if (!entry) return null;

      const changes = (entry.changes as Array<Record<string, unknown>>)?.[0];
      if (!changes) return null;

      const value = changes.value as Record<string, unknown>;
      if (!value) return null;

      const rawMessages = value.messages as Array<Record<string, unknown>>;
      if (!rawMessages || rawMessages.length === 0) return null;

      const messages = rawMessages.map((msg) => {
        const type = msg.type as string;
        const result: {
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: string;
          mediaId?: string;
          caption?: string;
          fileName?: string;
        } = {
          from: msg.from as string,
          id: msg.id as string,
          timestamp: msg.timestamp as string,
          type,
        };

        if (type === 'text') {
          const textObj = msg.text as Record<string, unknown>;
          result.text = textObj?.body as string;
        } else if (['image', 'document', 'video', 'audio'].includes(type)) {
          const mediaObj = msg[type] as Record<string, unknown>;
          if (mediaObj) {
            result.mediaId = mediaObj.id as string;
            result.caption = mediaObj.caption as string;
            if (type === 'document') {
              result.fileName = mediaObj.filename as string;
            }
          }
        }

        return result;
      });

      return { messages };
    } catch {
      return null;
    }
  }
}
