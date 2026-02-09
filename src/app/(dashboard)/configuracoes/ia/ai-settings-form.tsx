'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AiSettings {
    id?: string;
    provider: 'claude' | 'openai' | 'kimi';
    model?: string;
    freightExtractPrompt?: string;
    groupMonitorPrompt?: string;
}

const DEFAULT_EXTRACT_PROMPT = `Voce e um assistente especializado em logistica de transportes.
Sua tarefa e extrair dados de tickets de pesagem, notas fiscais ou mensagens de texto sobre fretes.
Analise a imagem (se houver) e o texto fornecido (que pode conter correcoes ou dados complementares).

Extraia os seguintes campos e retorne EXCLUSIVAMENTE um objeto JSON:
{ 
  "data": "DD/MM/AAAA",
  "origem": "Cidade/UF",
  "destino": "Cidade/UF",
  "toneladas": number (peso liquido),
  "precoTonelada": number,
  "valorTotal": number,
  "transportadora": "Nome da empresa",
  "ticketNota": "Numero do ticket ou nota",
  "placa": "AAA-0000 ou AAA0A00",
  "motorista": "Nome do motorista",
  "observacao": "Outras informacoes relevantes" 
}

Regras:
1. Se nao conseguir identificar um campo, retorne null.
2. Priorize os dados da imagem, mas se o texto fornecer uma correcao (ex: "placa errada, a correta eh X"), use o texto.
3. Converta valores monetarios para numeros (ex: "R$ 1.000,00" -> 1000).
4. Retorne APENAS o JSON, sem markdown ou explicacoes.`;

export default function AiSettingsForm() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<AiSettings>({
        provider: 'claude',
        freightExtractPrompt: DEFAULT_EXTRACT_PROMPT,
    });

    useEffect(() => {
        fetch('/api/settings/ai')
            .then((res) => res.json())
            .then((data) => {
                if (data && !data.error) {
                    setSettings({
                        ...data,
                        freightExtractPrompt: data.freightExtractPrompt || DEFAULT_EXTRACT_PROMPT,
                    });
                }
                setLoading(false);
            })
            .catch((err) => {
                console.error('Erro ao carregar settings:', err);
                setLoading(false);
            });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch('/api/settings/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });

            const data = await res.json();

            if (res.ok) {
                alert('Configurações salvas com sucesso!');
                router.refresh();
            } else {
                console.error('Erro da API:', data);
                alert(`Erro ao salvar configurações: ${data.error || 'Erro desconhecido'}${data.details ? ` - ${JSON.stringify(data.details)}` : ''}`);
            }
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar configurações. Verifique o console para detalhes.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-4">Carregando configurações...</div>;
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto p-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Provedor de IA</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Provedor Principal
                        </label>
                        <select
                            value={settings.provider}
                            onChange={(e) => setSettings({ ...settings, provider: e.target.value as any })}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="claude">Anthropic (Claude)</option>
                            <option value="openai">OpenAI (GPT)</option>
                            <option value="kimi">Kimi (Moonshot AI)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            Certifique-se de que a API Key correspondente esteja configurada no .env (EASYPANEL).
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Modelo (Opcional - sobrescreve padrão)
                        </label>
                        <input
                            type="text"
                            value={settings.model || ''}
                            onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                            placeholder="Ex: gpt-4-turbo"
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Prompt: Extração de Fretes</h2>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        System Prompt para Leitura de Tickets e Mensagens
                    </label>
                    <div className="text-xs text-gray-500 mb-2">
                        Este prompt instrui a IA sobre como ler a imagem e o texto.
                        Mantenha as instruções de retorno JSON para garantir que o sistema funcione.
                    </div>
                    <textarea
                        value={settings.freightExtractPrompt || ''}
                        onChange={(e) => setSettings({ ...settings, freightExtractPrompt: e.target.value })}
                        rows={15}
                        className="w-full p-3 border border-gray-300 rounded-md font-mono text-sm bg-gray-50 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 opacity-75">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Prompt: Monitoramento de Grupos (Em Breve)</h2>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        System Prompt para Análise de Oportunidades
                    </label>
                    <textarea
                        value={settings.groupMonitorPrompt || ''}
                        onChange={(e) => setSettings({ ...settings, groupMonitorPrompt: e.target.value })}
                        rows={5}
                        placeholder="Prompt padrão será usado se vazio."
                        className="w-full p-3 border border-gray-300 rounded-md font-mono text-sm bg-gray-50 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={saving}
                    className={`px-6 py-2 rounded-md text-white font-medium ${saving ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                >
                    {saving ? 'Salvando...' : 'Salvar Configurações'}
                </button>
            </div>
        </form>
    );
}
