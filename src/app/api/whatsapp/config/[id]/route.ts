import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { whatsapp } from '@/lib/whatsapp';

// GET — Detalhes de uma configuração
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const config = await db.whatsAppConfig.findUnique({
      where: { id: params.id },
    });

    if (!config) {
      return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      ...config,
      evolutionApiKey: config.evolutionApiKey ? '••••' + config.evolutionApiKey.slice(-4) : null,
      metaToken: config.metaToken ? '••••' + config.metaToken.slice(-4) : null,
      metaAppSecret: config.metaAppSecret ? '••••' + config.metaAppSecret.slice(-4) : null,
    });
  } catch (error) {
    console.error('Erro ao buscar config:', error);
    return NextResponse.json({ error: 'Erro ao buscar configuração' }, { status: 500 });
  }
}

// PUT — Atualizar configuração
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const existing = await db.whatsAppConfig.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if (body.nome !== undefined) data.nome = body.nome;
    if (body.active !== undefined) data.active = body.active;

    if (existing.tipo === 'EVOLUTION') {
      if (body.evolutionUrl !== undefined) data.evolutionUrl = body.evolutionUrl;
      if (body.evolutionApiKey !== undefined) data.evolutionApiKey = body.evolutionApiKey;
      if (body.evolutionInstance !== undefined) data.evolutionInstance = body.evolutionInstance;
    } else {
      if (body.metaToken !== undefined) data.metaToken = body.metaToken;
      if (body.metaPhoneId !== undefined) data.metaPhoneId = body.metaPhoneId;
      if (body.metaVerifyToken !== undefined) data.metaVerifyToken = body.metaVerifyToken;
      if (body.metaAppSecret !== undefined) data.metaAppSecret = body.metaAppSecret;
    }

    const updated = await db.whatsAppConfig.update({
      where: { id: params.id },
      data,
    });

    // Invalida cache do WhatsAppService
    whatsapp.invalidateCache();

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar config:', error);
    return NextResponse.json({ error: 'Erro ao atualizar configuração' }, { status: 500 });
  }
}

// DELETE — Remover configuração
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await db.whatsAppConfig.delete({
      where: { id: params.id },
    });

    whatsapp.invalidateCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar config:', error);
    return NextResponse.json({ error: 'Erro ao deletar configuração' }, { status: 500 });
  }
}
