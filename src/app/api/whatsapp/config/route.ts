import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET — Listar todas as configurações WhatsApp
export async function GET() {
  try {
    const configs = await db.whatsAppConfig.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Mascarar campos sensíveis
    const masked = configs.map((c) => ({
      ...c,
      evolutionApiKey: c.evolutionApiKey ? '••••' + c.evolutionApiKey.slice(-4) : null,
      metaToken: c.metaToken ? '••••' + c.metaToken.slice(-4) : null,
      metaAppSecret: c.metaAppSecret ? '••••' + c.metaAppSecret.slice(-4) : null,
    }));

    return NextResponse.json({ data: masked });
  } catch (error) {
    console.error('Erro ao listar configs WhatsApp:', error);
    return NextResponse.json({ error: 'Erro ao listar configurações' }, { status: 500 });
  }
}

// POST — Criar nova configuração
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tipo, nome } = body;

    if (!tipo || !nome) {
      return NextResponse.json(
        { error: 'Campos "tipo" e "nome" são obrigatórios' },
        { status: 400 }
      );
    }

    if (!['EVOLUTION', 'META_OFFICIAL'].includes(tipo)) {
      return NextResponse.json(
        { error: 'Tipo deve ser "EVOLUTION" ou "META_OFFICIAL"' },
        { status: 400 }
      );
    }

    if (tipo === 'EVOLUTION') {
      const { evolutionUrl, evolutionApiKey, evolutionInstance } = body;
      if (!evolutionUrl || !evolutionApiKey || !evolutionInstance) {
        return NextResponse.json(
          { error: 'Evolution API requer: evolutionUrl, evolutionApiKey, evolutionInstance' },
          { status: 400 }
        );
      }

      const config = await db.whatsAppConfig.create({
        data: {
          tipo,
          nome,
          evolutionUrl,
          evolutionApiKey,
          evolutionInstance,
        },
      });
      return NextResponse.json(config, { status: 201 });
    }

    // META_OFFICIAL
    const { metaToken, metaPhoneId, metaVerifyToken, metaAppSecret } = body;
    if (!metaToken || !metaPhoneId) {
      return NextResponse.json(
        { error: 'Meta Official requer: metaToken, metaPhoneId' },
        { status: 400 }
      );
    }

    const config = await db.whatsAppConfig.create({
      data: {
        tipo,
        nome,
        metaToken,
        metaPhoneId,
        metaVerifyToken: metaVerifyToken || '',
        metaAppSecret: metaAppSecret || '',
      },
    });

    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar config WhatsApp:', error);
    return NextResponse.json({ error: 'Erro ao criar configuração' }, { status: 500 });
  }
}
