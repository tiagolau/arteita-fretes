import { EvolutionAPI } from './evolution-api';
import { WhatsAppOfficialAPI } from './official-api';
import { db } from '@/lib/db';

interface CachedConfig {
  evolution: { baseUrl: string; apiKey: string; instance: string } | null;
  official: { token: string; phoneId: string; verifyToken: string; appSecret: string } | null;
  lastLoaded: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds

export class WhatsAppService {
  private evolutionClient: EvolutionAPI | null = null;
  private officialClient: WhatsAppOfficialAPI | null = null;
  private cache: CachedConfig = { evolution: null, official: null, lastLoaded: 0 };

  private async loadConfig(): Promise<void> {
    const now = Date.now();
    if (now - this.cache.lastLoaded < CACHE_TTL_MS) return;

    try {
      const configs = await db.whatsAppConfig.findMany({
        where: { active: true },
      });

      const evoConfig = configs.find((c) => c.tipo === 'EVOLUTION');
      const metaConfig = configs.find((c) => c.tipo === 'META_OFFICIAL');

      if (evoConfig?.evolutionUrl && evoConfig.evolutionApiKey && evoConfig.evolutionInstance) {
        this.cache.evolution = {
          baseUrl: evoConfig.evolutionUrl,
          apiKey: evoConfig.evolutionApiKey,
          instance: evoConfig.evolutionInstance,
        };
        this.evolutionClient = new EvolutionAPI(this.cache.evolution);
      } else {
        // Fallback para env vars
        const envUrl = process.env.EVOLUTION_API_URL;
        const envKey = process.env.EVOLUTION_API_KEY;
        const envInstance = process.env.EVOLUTION_INSTANCE;
        if (envUrl) {
          this.cache.evolution = {
            baseUrl: envUrl,
            apiKey: envKey || '',
            instance: envInstance || '',
          };
          this.evolutionClient = new EvolutionAPI(this.cache.evolution);
        } else {
          this.evolutionClient = null;
          this.cache.evolution = null;
        }
      }

      if (metaConfig?.metaToken && metaConfig.metaPhoneId) {
        this.cache.official = {
          token: metaConfig.metaToken,
          phoneId: metaConfig.metaPhoneId,
          verifyToken: metaConfig.metaVerifyToken || '',
          appSecret: metaConfig.metaAppSecret || '',
        };
        this.officialClient = new WhatsAppOfficialAPI(this.cache.official);
      } else {
        // Fallback para env vars
        const envToken = process.env.WHATSAPP_BUSINESS_TOKEN;
        const envPhoneId = process.env.WHATSAPP_BUSINESS_PHONE_ID;
        if (envToken && envPhoneId) {
          this.cache.official = {
            token: envToken,
            phoneId: envPhoneId,
            verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
            appSecret: '',
          };
          this.officialClient = new WhatsAppOfficialAPI(this.cache.official);
        } else {
          this.officialClient = null;
          this.cache.official = null;
        }
      }

      this.cache.lastLoaded = now;
    } catch (error) {
      console.error('[WhatsAppService] Erro ao carregar config:', error);
      // Em caso de erro no banco, tenta env vars
      if (!this.evolutionClient) {
        this.evolutionClient = new EvolutionAPI();
      }
    }
  }

  /** Força recarga do config (útil após salvar no banco) */
  invalidateCache(): void {
    this.cache.lastLoaded = 0;
  }

  async sendText(number: string, text: string): Promise<void> {
    console.log(`[WhatsAppService] Enviando texto para ${number} (${text.length} chars)`);
    await this.loadConfig();

    // Tenta Evolution primeiro
    if (this.evolutionClient) {
      try {
        const connected = await this.evolutionClient.isConnected();
        if (connected) {
          await this.evolutionClient.sendText({ number, text });
          console.log(`[WhatsAppService] Texto enviado via Evolution para ${number}`);
          return;
        }
      } catch (error) {
        console.warn('[WhatsAppService] Evolution falhou, tentando Official:', error);
      }
    }

    // Fallback: Meta Official
    if (this.officialClient?.isConfigured()) {
      await this.officialClient.sendText(number, text);
      console.log(`[WhatsAppService] Texto enviado via Meta Official para ${number}`);
      return;
    }

    console.error('[WhatsAppService] Erro: Nenhuma API WhatsApp disponível para envio');
    throw new Error('[WhatsAppService] Nenhuma API WhatsApp disponível.');
  }

  async sendMedia(
    number: string,
    mediatype: 'image' | 'document' | 'audio' | 'video',
    media: string,
    caption?: string,
    fileName?: string
  ): Promise<void> {
    await this.loadConfig();

    if (this.evolutionClient) {
      try {
        const connected = await this.evolutionClient.isConnected();
        if (connected) {
          await this.evolutionClient.sendMedia({ number, mediatype, media, caption, fileName });
          return;
        }
      } catch (error) {
        console.warn('[WhatsAppService] Evolution falhou para sendMedia:', error);
      }
    }

    if (this.officialClient?.isConfigured()) {
      await this.officialClient.sendMedia(number, mediatype, media, caption, fileName);
      return;
    }

    throw new Error('[WhatsAppService] Envio de mídia falhou. Nenhuma API disponível.');
  }

  async downloadMedia(messageId: string): Promise<Buffer> {
    await this.loadConfig();

    if (this.evolutionClient) {
      try {
        return await this.evolutionClient.downloadMedia(messageId);
      } catch (error) {
        console.warn('[WhatsAppService] Evolution download falhou:', error);
      }
    }

    if (this.officialClient?.isConfigured()) {
      return this.officialClient.downloadMedia(messageId);
    }

    throw new Error('[WhatsAppService] Download de mídia falhou.');
  }

  async getStatus(): Promise<{ evolution: boolean; official: boolean }> {
    await this.loadConfig();

    let evolutionConnected = false;
    if (this.evolutionClient) {
      try {
        evolutionConnected = await this.evolutionClient.isConnected();
      } catch {
        evolutionConnected = false;
      }
    }

    return {
      evolution: evolutionConnected,
      official: this.officialClient?.isConfigured() || false,
    };
  }

  async getQrCode(): Promise<string | null> {
    await this.loadConfig();
    if (!this.evolutionClient) return null;
    return this.evolutionClient.getQrCode();
  }

  /** Acesso direto ao client Evolution (para gerenciamento de instância) */
  getEvolutionClient(): EvolutionAPI | null {
    return this.evolutionClient;
  }

  /** Cria um client Evolution temporário com config específico */
  createEvolutionClient(config: { baseUrl: string; apiKey: string; instance: string }): EvolutionAPI {
    return new EvolutionAPI(config);
  }
}

export const whatsapp = new WhatsAppService();
