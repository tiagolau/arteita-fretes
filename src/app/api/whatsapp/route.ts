import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { EvolutionAPI } from '@/lib/whatsapp/evolution-api';
import { WhatsAppOfficialAPI } from '@/lib/whatsapp/official-api';

// GET — Status de todas as conexões WhatsApp
export async function GET() {
  try {
    const configs = await db.whatsAppConfig.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
    });

    const statuses = await Promise.all(
      configs.map(async (config) => {
        if (config.tipo === 'EVOLUTION' && config.evolutionUrl && config.evolutionApiKey && config.evolutionInstance) {
          const evo = new EvolutionAPI({
            baseUrl: config.evolutionUrl,
            apiKey: config.evolutionApiKey,
            instance: config.evolutionInstance,
          });
          try {
            const status = await evo.getStatus();
            // Atualizar status no banco
            if (status.connected !== config.connected) {
              await db.whatsAppConfig.update({
                where: { id: config.id },
                data: { connected: status.connected },
              });
            }
            let qrcode: string | null = null;
            if (!status.connected) {
              qrcode = await evo.getQrCode();
            }
            return {
              id: config.id,
              tipo: config.tipo,
              nome: config.nome,
              connected: status.connected,
              instance: config.evolutionInstance,
              qrcode,
            };
          } catch {
            return {
              id: config.id,
              tipo: config.tipo,
              nome: config.nome,
              connected: false,
              instance: config.evolutionInstance,
              qrcode: null,
            };
          }
        }

        if (config.tipo === 'META_OFFICIAL' && config.metaToken && config.metaPhoneId) {
          const official = new WhatsAppOfficialAPI({
            token: config.metaToken,
            phoneId: config.metaPhoneId,
          });
          return {
            id: config.id,
            tipo: config.tipo,
            nome: config.nome,
            connected: official.isConfigured(),
            instance: null,
            qrcode: null,
          };
        }

        return {
          id: config.id,
          tipo: config.tipo,
          nome: config.nome,
          connected: false,
          instance: null,
          qrcode: null,
        };
      })
    );

    // Fallback: se não tem configs no banco, usa env vars
    if (configs.length === 0) {
      const envEvoUrl = process.env.EVOLUTION_API_URL;
      const envEvoKey = process.env.EVOLUTION_API_KEY;
      const envEvoInstance = process.env.EVOLUTION_INSTANCE;

      let evolution = false;
      let qrcode: string | null = null;

      if (envEvoUrl && envEvoKey && envEvoInstance) {
        const evo = new EvolutionAPI({ baseUrl: envEvoUrl, apiKey: envEvoKey, instance: envEvoInstance });
        try {
          evolution = await evo.isConnected();
          if (!evolution) {
            qrcode = await evo.getQrCode();
          }
        } catch { /* ignore */ }
      }

      const envToken = process.env.WHATSAPP_BUSINESS_TOKEN;
      const envPhoneId = process.env.WHATSAPP_BUSINESS_PHONE_ID;
      const official = Boolean(envToken && envPhoneId);

      return NextResponse.json({ evolution, official, qrcode, configs: [] });
    }

    return NextResponse.json({ configs: statuses });
  } catch (error) {
    console.error('Erro ao obter status WhatsApp:', error);
    return NextResponse.json(
      { evolution: false, official: false, qrcode: null, configs: [] },
      { status: 500 }
    );
  }
}

// POST — Ações rápidas (reconectar)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, configId } = body;

    if (action === 'reconnect') {
      if (configId) {
        const config = await db.whatsAppConfig.findUnique({
          where: { id: configId },
        });
        if (config?.tipo === 'EVOLUTION' && config.evolutionUrl && config.evolutionApiKey && config.evolutionInstance) {
          const evo = new EvolutionAPI({
            baseUrl: config.evolutionUrl,
            apiKey: config.evolutionApiKey,
            instance: config.evolutionInstance,
          });
          const qrcode = await evo.getQrCode();
          return NextResponse.json({ success: true, qrcode });
        }
      }

      // Fallback env vars
      const evo = new EvolutionAPI();
      const qrcode = await evo.getQrCode();
      return NextResponse.json({ success: true, qrcode });
    }

    return NextResponse.json(
      { error: 'Ação inválida. Use { action: "reconnect" }' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Erro ao executar ação WhatsApp:', error);
    return NextResponse.json({ error: 'Erro ao executar ação' }, { status: 500 });
  }
}
