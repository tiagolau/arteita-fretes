import { Metadata } from 'next';
import AiSettingsForm from './ai-settings-form';

export const metadata: Metadata = {
    title: 'Configurações de IA | Arteita Fretes',
    description: 'Gerencie os prompts e provedores de Inteligência Artificial.',
};

export default function AiSettingsPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Configurações de IA</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Personalize o comportamento da Inteligência Artificial para extração de dados e monitoramento.
                    </p>
                </div>
            </div>

            <AiSettingsForm />
        </div>
    );
}
