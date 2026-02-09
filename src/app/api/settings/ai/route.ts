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
        const result = aiSettingsSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json({ error: 'Dados inválidos', details: result.error }, { status: 400 });
        }

        const { provider, model, freightExtractPrompt, groupMonitorPrompt } = result.data;

        // Busca configuração existente ou cria nova
        const existing = await db.aiSettings.findFirst({
            where: { active: true },
        });

        let config;

        if (existing) {
            config = await db.aiSettings.update({
                where: { id: existing.id },
                data: {
                    provider: provider || existing.provider,
                    model: model || existing.model,
                    freightExtractPrompt: freightExtractPrompt !== undefined ? freightExtractPrompt : existing.freightExtractPrompt,
                    groupMonitorPrompt: groupMonitorPrompt !== undefined ? groupMonitorPrompt : existing.groupMonitorPrompt,
                },
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

        return NextResponse.json(config);
    } catch (error) {
        console.error('[AiSettings] Error saving config:', error);
        return NextResponse.json({ error: 'Erro ao salvar configurações' }, { status: 500 });
    }
}
