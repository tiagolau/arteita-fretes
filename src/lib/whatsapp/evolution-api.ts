import axios, { AxiosInstance } from 'axios';

interface EvolutionConfig {
  baseUrl: string;
  apiKey: string;
  instance: string;
}

interface SendTextPayload {
  number: string;
  text: string;
}

interface SendMediaPayload {
  number: string;
  mediatype: 'image' | 'document' | 'audio' | 'video';
  media: string;
  caption?: string;
  fileName?: string;
}

interface InstanceStatus {
  connected: boolean;
  qrcode?: string;
  instance?: string;
}

interface CreateInstanceOptions {
  instanceName: string;
  token?: string;
  qrcode?: boolean;
}

interface WebhookConfig {
  enabled: boolean;
  url: string;
  webhookByEvents?: boolean;
  webhookBase64?: boolean;
  events?: string[];
}

const DEFAULT_WEBHOOK_EVENTS = [
  'MESSAGES_UPSERT',
  'CONNECTION_UPDATE',
  'QRCODE_UPDATED',
];

export class EvolutionAPI {
  private client: AxiosInstance;
  private instance: string;
  private apiKey: string;

  constructor(config?: EvolutionConfig) {
    const baseURL = config?.baseUrl || process.env.EVOLUTION_API_URL;
    this.apiKey = config?.apiKey || process.env.EVOLUTION_API_KEY || '';
    this.instance = config?.instance || process.env.EVOLUTION_INSTANCE || '';

    if (!baseURL) {
      console.warn('[EvolutionAPI] URL não configurada');
    }

    this.client = axios.create({
      baseURL: baseURL || 'http://localhost:8080',
      headers: {
        apikey: this.apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  // ============================================
  // GERENCIAMENTO DE INSTÂNCIA
  // ============================================

  async createInstance(options: CreateInstanceOptions): Promise<{
    instanceName: string;
    status: string;
    qrcode?: { code: string; base64: string };
  }> {
    const response = await this.client.post('/instance/create', {
      instanceName: options.instanceName,
      token: options.token || '',
      qrcode: options.qrcode !== false,
      integration: 'WHATSAPP-BAILEYS',
    });

    this.instance = options.instanceName;
    return response.data;
  }

  async deleteInstance(): Promise<void> {
    await this.client.delete(`/instance/delete/${this.instance}`);
  }

  async logoutInstance(): Promise<void> {
    await this.client.delete(`/instance/logout/${this.instance}`);
  }

  async restartInstance(): Promise<{ state: string }> {
    const response = await this.client.put(
      `/instance/restart/${this.instance}`
    );
    return response.data?.instance || response.data;
  }

  async fetchInstances(): Promise<Array<{ instanceName: string; state: string }>> {
    const response = await this.client.get('/instance/fetchInstances');
    return response.data || [];
  }

  // ============================================
  // WEBHOOK
  // ============================================

  async setWebhook(webhookUrl: string, events?: string[]): Promise<void> {
    const config: WebhookConfig = {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      webhookBase64: false,
      events: events || DEFAULT_WEBHOOK_EVENTS,
    };

    await this.client.post(`/webhook/set/${this.instance}`, {
      webhook: config,
    });
  }

  async getWebhook(): Promise<WebhookConfig | null> {
    try {
      const response = await this.client.get(
        `/webhook/find/${this.instance}`
      );
      return response.data || null;
    } catch {
      return null;
    }
  }

  // ============================================
  // STATUS E CONEXÃO
  // ============================================

  async getStatus(): Promise<InstanceStatus> {
    try {
      const response = await this.client.get(
        `/instance/connectionState/${this.instance}`
      );
      const data = response.data;

      return {
        connected: data?.instance?.state === 'open',
        qrcode: data?.qrcode,
        instance: this.instance,
      };
    } catch (error) {
      console.error('[EvolutionAPI] Erro ao obter status:', error);
      return { connected: false, instance: this.instance };
    }
  }

  async getQrCode(): Promise<string | null> {
    try {
      const response = await this.client.get(
        `/instance/connect/${this.instance}`
      );
      const data = response.data;

      if (data?.base64) {
        return data.base64;
      }

      if (data?.qrcode?.base64) {
        return data.qrcode.base64;
      }

      return null;
    } catch (error) {
      console.error('[EvolutionAPI] Erro ao obter QR code:', error);
      return null;
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      const status = await this.getStatus();
      return status.connected;
    } catch {
      return false;
    }
  }

  // ============================================
  // GRUPOS
  // ============================================

  async fetchGroups(): Promise<Array<{
    id: string;
    subject: string;
    size: number;
    creation: number;
    owner: string;
    desc?: string;
  }>> {
    const response = await this.client.get(
      `/group/fetchAllGroups/${this.instance}?getParticipants=false`
    );
    return response.data || [];
  }

  // ============================================
  // MENSAGENS
  // ============================================

  async sendText(payload: SendTextPayload): Promise<void> {
    await this.client.post(`/message/sendText/${this.instance}`, {
      number: payload.number,
      text: payload.text,
    });
  }

  async sendMedia(payload: SendMediaPayload): Promise<void> {
    await this.client.post(`/message/sendMedia/${this.instance}`, {
      number: payload.number,
      mediatype: payload.mediatype,
      media: payload.media,
      caption: payload.caption,
      fileName: payload.fileName,
    });
  }

  async downloadMedia(messageId: string): Promise<Buffer> {
    const response = await this.client.post(
      `/chat/getBase64FromMediaMessage/${this.instance}`,
      {
        message: {
          key: {
            id: messageId,
          },
        },
      }
    );

    const base64Data = response.data?.base64;
    if (!base64Data) {
      throw new Error('Nenhum dado base64 retornado do download de mídia');
    }

    return Buffer.from(base64Data, 'base64');
  }
}
