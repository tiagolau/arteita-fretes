import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

// Schema de validação
const aiSettingsSchema = z.object({
    provider: z.enum(['claude', 'openai', 'kimi']).optional(),
    model: z.string().optional(),
    freightExtractPrompt: z.string().optional(),
    groupMonitorPrompt: z.string().optional(),
});

export async function GET() {
    try {
        const config = await db.aiSettings.findFirst({
            where: { active: true },
            orderBy: { updatedAt: 'desc' },
        });

        return NextResponse.json(config || { provider: 'claude' });
    } catch (error) {
        console.error('[AiSettings] Error getting config:', error);
        return NextResponse.json({ error: 'Erro ao buscar configurações' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        console.log('[AiSettings] Received body:', JSON.stringify(body, null, 2));

        const result = aiSettingsSchema.safeParse(body);

        if (!result.success) {
            console.log('[AiSettings] Validation failed:', result.error);
            return NextResponse.json({ error: 'Dados inválidos', details: result.error }, { status: 400 });
        }

        const { provider, model, freightExtractPrompt, groupMonitorPrompt } = result.data;
        console.log('[AiSettings] Parsed data:', { provider, model, hasPrompt: !!freightExtractPrompt });

        // Busca configuração existente ou cria nova
        const existing = await db.aiSettings.findFirst({
            where: { active: true },
        });

        console.log('[AiSettings] Existing config:', existing ? `ID: ${existing.id}, provider: ${existing.provider}` : 'none');

        let config;

        if (existing) {
            // Atualiza apenas os campos fornecidos
            const updateData: any = {};
            if (provider) updateData.provider = provider;
            if (model !== undefined) updateData.model = model;
            if (freightExtractPrompt !== undefined) updateData.freightExtractPrompt = freightExtractPrompt;
            if (groupMonitorPrompt !== undefined) updateData.groupMonitorPrompt = groupMonitorPrompt;

            console.log('[AiSettings] Update data:', Object.keys(updateData));

            config = await db.aiSettings.update({
                where: { id: existing.id },
                data: updateData,
            });
        } else {
            config = await db.aiSettings.create({
                data: {
                    provider: provider || 'claude',
                    model,
                    freightExtractPrompt,
                    groupMonitorPrompt,
                    active: true,
                },
            });
        }

        console.log('[AiSettings] Saved successfully:', config.id);
        return NextResponse.json(config);
    } catch (error) {
        console.error('[AiSettings] Error saving config:', error);
        // Captura mais detalhes do erro
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        const errorStack = error instanceof Error ? error.stack : undefined;
        return NextResponse.json({
            error: 'Erro ao salvar configurações',
            message: errorMessage,
            stack: errorStack
        }, { status: 500 });
    }
}
