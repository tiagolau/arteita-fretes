import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { EvolutionAPI } from '@/lib/whatsapp/evolution-api';
import { whatsapp } from '@/lib/whatsapp';

// POST — Ações de instância Evolution API
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const config = await db.whatsAppConfig.findUnique({
      where: { id: params.id },
    });

    if (!config) {
      return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 404 });
    }

    if (config.tipo !== 'EVOLUTION') {
      return NextResponse.json(
        { error: 'Ações de instância só disponíveis para Evolution API' },
        { status: 400 }
      );
    }

    if (!config.evolutionUrl || !config.evolutionApiKey || !config.evolutionInstance) {
      return NextResponse.json(
        { error: 'Configuração Evolution incompleta (URL, API Key e Instance são obrigatórios)' },
        { status: 400 }
      );
    }

    const evolution = new EvolutionAPI({
      baseUrl: config.evolutionUrl,
      apiKey: config.evolutionApiKey,
      instance: config.evolutionInstance,
    });

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create': {
        const result = await evolution.createInstance({
          instanceName: config.evolutionInstance,
          qrcode: true,
        });

        await db.whatsAppConfig.update({
          where: { id: config.id },
          data: { connected: false },
        });

        whatsapp.invalidateCache();

        return NextResponse.json({
          success: true,
          instanceName: result.instanceName,
          status: result.status,
          qrcode: result.qrcode?.base64 || null,
        });
      }

      case 'connect': {
        const qrcode = await evolution.getQrCode();
        return NextResponse.json({ success: true, qrcode });
      }

      case 'status': {
        const status = await evolution.getStatus();

        // Atualizar status no banco
        await db.whatsAppConfig.update({
          where: { id: config.id },
          data: { connected: status.connected },
        });

        return NextResponse.json({
          success: true,
          connected: status.connected,
          instance: status.instance,
        });
      }

      case 'restart': {
        const result = await evolution.restartInstance();

        whatsapp.invalidateCache();

        return NextResponse.json({ success: true, state: result.state });
      }

      case 'logout': {
        await evolution.logoutInstance();

        await db.whatsAppConfig.update({
          where: { id: config.id },
          data: { connected: false },
        });

        whatsapp.invalidateCache();

        return NextResponse.json({ success: true });
      }

      case 'delete': {
        await evolution.deleteInstance();

        await db.whatsAppConfig.update({
          where: { id: config.id },
          data: { connected: false },
        });

        whatsapp.invalidateCache();

        return NextResponse.json({ success: true });
      }

      case 'set-webhook': {
        const appUrl = body.webhookUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const webhookUrl = `${appUrl}/api/webhook/whatsapp`;

        await evolution.setWebhook(webhookUrl, [
          'MESSAGES_UPSERT',
          'CONNECTION_UPDATE',
          'QRCODE_UPDATED',
        ]);

        return NextResponse.json({ success: true, webhookUrl });
      }

      case 'fetch-instances': {
        const instances = await evolution.fetchInstances();
        return NextResponse.json({ success: true, instances });
      }

      case 'get-webhook': {
        const webhook = await evolution.getWebhook();
        return NextResponse.json({ success: true, webhook });
      }

      case 'fetch-groups': {
        const groups = await evolution.fetchGroups();
        return NextResponse.json({
          success: true,
          groups: groups.map((g) => ({
            id: g.id,
            name: g.subject,
            size: g.size,
            desc: g.desc || '',
          })),
        });
      }

      default:
        return NextResponse.json(
          { error: `Ação inválida: ${action}. Use: create, connect, status, restart, logout, delete, set-webhook, fetch-instances, fetch-groups, get-webhook` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Erro na ação de instância:', error);
    const message = error instanceof Error ? error.message : 'Erro ao executar ação';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
