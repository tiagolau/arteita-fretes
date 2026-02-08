'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Wifi,
  WifiOff,
  MessageCircle,
  Settings,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Power,
  PowerOff,
  Link,
  Unlink,
  Server,
  Smartphone,
  Loader2,
  ChevronDown,
  ChevronUp,
  Globe,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface WhatsAppConfigItem {
  id: string;
  tipo: string;
  nome: string;
  evolutionUrl: string | null;
  evolutionApiKey: string | null;
  evolutionInstance: string | null;
  metaToken: string | null;
  metaPhoneId: string | null;
  metaVerifyToken: string | null;
  metaAppSecret: string | null;
  active: boolean;
  connected: boolean;
}

interface ConfigStatus {
  id: string;
  tipo: string;
  nome: string;
  connected: boolean;
  instance: string | null;
  qrcode: string | null;
}

interface GrupoWhatsapp {
  id: string;
  nome: string;
  grupoId: string;
  active: boolean;
  palavrasChave: string[];
}

interface BotConfig {
  msgBoasVindas: string;
  msgConfirmacao: string;
  timeoutMinutos: number;
}

const defaultBotConfig: BotConfig = {
  msgBoasVindas: 'Olá {nome}! Envie o ticket do frete (foto ou PDF) para registrar.',
  msgConfirmacao: 'Frete registrado com sucesso! Aguardando validação do operador.',
  timeoutMinutos: 10,
};

export default function WhatsAppConfigPage() {
  // ============================================
  // STATE
  // ============================================

  // Configs
  const [configs, setConfigs] = useState<WhatsAppConfigItem[]>([]);
  const [configStatuses, setConfigStatuses] = useState<ConfigStatus[]>([]);
  const [configsLoading, setConfigsLoading] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<WhatsAppConfigItem | null>(null);
  const [configTab, setConfigTab] = useState<'EVOLUTION' | 'META_OFFICIAL'>('EVOLUTION');

  // Config form
  const [configForm, setConfigForm] = useState({
    nome: '',
    evolutionUrl: '',
    evolutionApiKey: '',
    evolutionInstance: '',
    metaToken: '',
    metaPhoneId: '',
    metaVerifyToken: '',
    metaAppSecret: '',
  });

  // Instance actions
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeQrCode, setActiveQrCode] = useState<{ configId: string; base64: string } | null>(null);
  const [expandedConfig, setExpandedConfig] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');

  // Groups
  const [grupos, setGrupos] = useState<GrupoWhatsapp[]>([]);
  const [grupoModalOpen, setGrupoModalOpen] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState<GrupoWhatsapp | null>(null);
  const [grupoForm, setGrupoForm] = useState({ nome: '', grupoId: '', palavrasChave: '' });
  const [gruposLoading, setGruposLoading] = useState(false);

  // WhatsApp groups from Evolution API (for group picker)
  const [whatsappGroups, setWhatsappGroups] = useState<Array<{ id: string; name: string; size: number; desc: string }>>([]);
  const [whatsappGroupsLoading, setWhatsappGroupsLoading] = useState(false);
  const [showGroupPicker, setShowGroupPicker] = useState(false);

  // Bot config
  const [botConfig, setBotConfig] = useState<BotConfig>(defaultBotConfig);

  // ============================================
  // CONFIGS - CRUD
  // ============================================

  const fetchConfigs = useCallback(async () => {
    try {
      setConfigsLoading(true);
      const res = await fetch('/api/whatsapp/config');
      if (res.ok) {
        const data = await res.json();
        setConfigs(data.data || []);
      }
    } catch {
      // silently fail
    } finally {
      setConfigsLoading(false);
    }
  }, []);

  const fetchStatuses = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp');
      if (res.ok) {
        const data = await res.json();
        setConfigStatuses(data.configs || []);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
    fetchStatuses();
    const interval = setInterval(fetchStatuses, 10000);
    return () => clearInterval(interval);
  }, [fetchConfigs, fetchStatuses]);

  const getConfigStatus = (configId: string): ConfigStatus | undefined => {
    return configStatuses.find((s) => s.id === configId);
  };

  const openCreateConfig = (tipo: 'EVOLUTION' | 'META_OFFICIAL') => {
    setEditingConfig(null);
    setConfigTab(tipo);
    setConfigForm({
      nome: '',
      evolutionUrl: '',
      evolutionApiKey: '',
      evolutionInstance: '',
      metaToken: '',
      metaPhoneId: '',
      metaVerifyToken: '',
      metaAppSecret: '',
    });
    setConfigModalOpen(true);
  };

  const openEditConfig = (config: WhatsAppConfigItem) => {
    setEditingConfig(config);
    setConfigTab(config.tipo as 'EVOLUTION' | 'META_OFFICIAL');
    setConfigForm({
      nome: config.nome,
      evolutionUrl: config.evolutionUrl || '',
      evolutionApiKey: '',
      evolutionInstance: config.evolutionInstance || '',
      metaToken: '',
      metaPhoneId: config.metaPhoneId || '',
      metaVerifyToken: '',
      metaAppSecret: '',
    });
    setConfigModalOpen(true);
  };

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: Record<string, string> = {
      tipo: configTab,
      nome: configForm.nome,
    };

    if (configTab === 'EVOLUTION') {
      if (!configForm.evolutionUrl || !configForm.evolutionInstance) {
        toast.error('URL e Nome da Instância são obrigatórios');
        return;
      }
      payload.evolutionUrl = configForm.evolutionUrl;
      payload.evolutionInstance = configForm.evolutionInstance;
      // Sempre enviar evolutionApiKey para Evolution (obrigatório na API)
      payload.evolutionApiKey = configForm.evolutionApiKey;
    } else {
      if (!configForm.metaPhoneId) {
        toast.error('Phone Number ID é obrigatório');
        return;
      }
      payload.metaPhoneId = configForm.metaPhoneId;
      if (configForm.metaToken) payload.metaToken = configForm.metaToken;
      if (configForm.metaVerifyToken) payload.metaVerifyToken = configForm.metaVerifyToken;
      if (configForm.metaAppSecret) payload.metaAppSecret = configForm.metaAppSecret;
    }


    try {
      if (editingConfig) {
        const res = await fetch(`/api/whatsapp/config/${editingConfig.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        // Verificar se foi redirecionado para login (sessão expirada)
        if (res.redirected || res.url.includes('/login')) {
          toast.error('Sessão expirada. Faça login novamente.');
          window.location.href = '/login';
          return;
        }

        if (!res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const data = await res.json();
            throw new Error(data.error || 'Erro ao atualizar');
          } else {
            throw new Error(`Erro ${res.status}: ${res.statusText}`);
          }
        }
        toast.success('Configuração atualizada');
      } else {
        if (configTab === 'EVOLUTION' && !configForm.evolutionApiKey) {
          toast.error('API Key é obrigatória para nova configuração Evolution');
          return;
        }
        if (configTab === 'META_OFFICIAL' && !configForm.metaToken) {
          toast.error('Access Token é obrigatório para nova configuração Meta');
          return;
        }
        const res = await fetch('/api/whatsapp/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        // Verificar se foi redirecionado para login (sessão expirada)
        if (res.redirected || res.url.includes('/login')) {
          toast.error('Sessão expirada. Faça login novamente.');
          window.location.href = '/login';
          return;
        }

        if (!res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const data = await res.json();
            throw new Error(data.error || 'Erro ao criar configuração');
          } else {
            throw new Error(`Erro ${res.status}: ${res.statusText}`);
          }
        }
        toast.success('Configuração criada');
      }
      setConfigModalOpen(false);
      fetchConfigs();
      fetchStatuses();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar configuração');
    }
  };

  const deleteConfig = async (config: WhatsAppConfigItem) => {
    if (!window.confirm(`Excluir a configuração "${config.nome}"?`)) return;
    try {
      await fetch(`/api/whatsapp/config/${config.id}`, { method: 'DELETE' });
      toast.success('Configuração excluída');
      fetchConfigs();
      fetchStatuses();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  // ============================================
  // INSTANCE ACTIONS (Evolution API)
  // ============================================

  const executeInstanceAction = async (configId: string, action: string, extra?: Record<string, string>) => {
    const actionKey = `${configId}-${action}`;
    setActionLoading(actionKey);

    try {
      const res = await fetch(`/api/whatsapp/config/${configId}/instance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Erro ao executar ação');
        return;
      }

      switch (action) {
        case 'create':
          toast.success('Instância criada!');
          if (data.qrcode) {
            setActiveQrCode({ configId, base64: data.qrcode });
          }
          break;
        case 'connect':
          if (data.qrcode) {
            setActiveQrCode({ configId, base64: data.qrcode });
            toast.success('QR Code gerado');
          } else {
            toast.success('Já conectado');
          }
          break;
        case 'restart':
          toast.success('Instância reiniciada');
          break;
        case 'logout':
          toast.success('Desconectado');
          setActiveQrCode(null);
          break;
        case 'delete':
          toast.success('Instância deletada');
          setActiveQrCode(null);
          break;
        case 'set-webhook':
          toast.success(`Webhook configurado: ${data.webhookUrl}`);
          break;
      }

      fetchStatuses();
      fetchConfigs();
    } catch {
      toast.error('Erro ao executar ação');
    } finally {
      setActionLoading(null);
    }
  };

  const isActionLoading = (configId: string, action: string) =>
    actionLoading === `${configId}-${action}`;

  // ============================================
  // GROUPS
  // ============================================

  const fetchGrupos = async () => {
    try {
      setGruposLoading(true);
      const res = await fetch('/api/grupos-whatsapp');
      if (res.ok) {
        const data = await res.json();
        setGrupos(Array.isArray(data) ? data : data.data || []);
      }
    } catch {
      toast.error('Erro ao carregar grupos');
    } finally {
      setGruposLoading(false);
    }
  };

  useEffect(() => {
    fetchGrupos();
  }, []);

  const fetchWhatsappGroups = async () => {
    // Buscar grupos de todas as configs Evolution conectadas
    const evolutionConfigs = configs.filter(
      (c) => c.tipo === 'EVOLUTION' && c.connected
    );

    if (evolutionConfigs.length === 0) {
      toast.error('Nenhuma conexão Evolution API ativa. Conecte primeiro.');
      return;
    }

    setWhatsappGroupsLoading(true);
    try {
      const allGroups: Array<{ id: string; name: string; size: number; desc: string }> = [];

      for (const cfg of evolutionConfigs) {
        const res = await fetch(`/api/whatsapp/config/${cfg.id}/instance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'fetch-groups' }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.groups) {
            allGroups.push(...data.groups);
          }
        }
      }

      setWhatsappGroups(allGroups);
      setShowGroupPicker(true);

      if (allGroups.length === 0) {
        toast.error('Nenhum grupo encontrado neste número.');
      }
    } catch {
      toast.error('Erro ao buscar grupos do WhatsApp');
    } finally {
      setWhatsappGroupsLoading(false);
    }
  };

  const selectWhatsappGroup = (group: { id: string; name: string }) => {
    setGrupoForm({
      ...grupoForm,
      nome: grupoForm.nome || group.name,
      grupoId: group.id,
    });
    setShowGroupPicker(false);
  };

  const openCreateGrupo = () => {
    setEditingGrupo(null);
    setGrupoForm({ nome: '', grupoId: '', palavrasChave: '' });
    setShowGroupPicker(false);
    setWhatsappGroups([]);
    setGrupoModalOpen(true);
  };

  const openEditGrupo = (grupo: GrupoWhatsapp) => {
    setEditingGrupo(grupo);
    setGrupoForm({
      nome: grupo.nome,
      grupoId: grupo.grupoId,
      palavrasChave: grupo.palavrasChave.join(', '),
    });
    setGrupoModalOpen(true);
  };

  const handleGrupoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grupoForm.nome.trim() || !grupoForm.grupoId.trim()) {
      toast.error('Nome e ID do Grupo são obrigatórios');
      return;
    }

    const payload = {
      nome: grupoForm.nome,
      grupoId: grupoForm.grupoId,
      palavrasChave: grupoForm.palavrasChave
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
    };

    try {
      if (editingGrupo) {
        const res = await fetch(`/api/grupos-whatsapp/${editingGrupo.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        toast.success('Grupo atualizado');
      } else {
        const res = await fetch('/api/grupos-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        toast.success('Grupo adicionado');
      }
      setGrupoModalOpen(false);
      fetchGrupos();
    } catch {
      toast.error('Erro ao salvar grupo');
    }
  };

  const toggleGrupoActive = async (grupo: GrupoWhatsapp) => {
    try {
      await fetch(`/api/grupos-whatsapp/${grupo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !grupo.active }),
      });
      fetchGrupos();
      toast.success(grupo.active ? 'Grupo pausado' : 'Grupo ativado');
    } catch {
      toast.error('Erro ao alterar status');
    }
  };

  const deleteGrupo = async (grupo: GrupoWhatsapp) => {
    if (!window.confirm(`Excluir o grupo "${grupo.nome}"?`)) return;
    try {
      await fetch(`/api/grupos-whatsapp/${grupo.id}`, { method: 'DELETE' });
      toast.success('Grupo excluído');
      fetchGrupos();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  // ============================================
  // BOT CONFIG
  // ============================================

  useEffect(() => {
    const saved = localStorage.getItem('arteita-bot-config');
    if (saved) {
      try {
        setBotConfig(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  const saveBotConfig = () => {
    localStorage.setItem('arteita-bot-config', JSON.stringify(botConfig));
    toast.success('Configurações do bot salvas');
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Configurações WhatsApp</h1>

      {/* ============================================ */}
      {/* SEÇÃO 1: CONEXÕES WHATSAPP */}
      {/* ============================================ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Conexões WhatsApp</h2>
          <div className="flex gap-2">
            <button
              onClick={() => openCreateConfig('EVOLUTION')}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Server className="h-4 w-4" />
              Evolution API
            </button>
            <button
              onClick={() => openCreateConfig('META_OFFICIAL')}
              className="btn-gold flex items-center gap-2 text-sm"
            >
              <Globe className="h-4 w-4" />
              Meta Official
            </button>
          </div>
        </div>

        {configsLoading && configs.length === 0 ? (
          <div className="card flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : configs.length === 0 ? (
          <div className="card py-8 text-center text-gray-500">
            <Server className="mx-auto h-10 w-10 text-gray-300 mb-3" />
            <p className="font-medium">Nenhuma conexão configurada</p>
            <p className="text-sm mt-1">
              Adicione uma conexão Evolution API ou Meta Official para começar.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {configs.map((config) => {
              const status = getConfigStatus(config.id);
              const isExpanded = expandedConfig === config.id;
              const isConnected = status?.connected || config.connected;
              const isEvolution = config.tipo === 'EVOLUTION';

              return (
                <div key={config.id} className="card">
                  {/* Header */}
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedConfig(isExpanded ? null : config.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-full p-2 ${isConnected ? 'bg-green-100' : 'bg-red-100'}`}
                      >
                        {isConnected ? (
                          <Wifi className="h-5 w-5 text-green-600" />
                        ) : (
                          <WifiOff className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">{config.nome}</p>
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${isEvolution
                              ? 'bg-arteita-blue-50 text-arteita-blue-500'
                              : 'bg-amber-50 text-amber-700'
                              }`}
                          >
                            {isEvolution ? 'Evolution' : 'Meta Official'}
                          </span>
                        </div>
                        <p className={`text-xs ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                          {isConnected ? 'Conectado' : 'Desconectado'}
                          {isEvolution && config.evolutionInstance && (
                            <span className="text-gray-400 ml-2">
                              ({config.evolutionInstance})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditConfig(config);
                        }}
                        className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConfig(config);
                        }}
                        className="p-1.5 rounded-md text-red-400 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      {isEvolution ? (
                        /* Evolution API Actions */
                        <div className="space-y-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => executeInstanceAction(config.id, 'create')}
                              disabled={!!actionLoading}
                              className="btn-primary flex items-center gap-1.5 text-xs"
                            >
                              {isActionLoading(config.id, 'create') ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Plus className="h-3.5 w-3.5" />
                              )}
                              Criar Instância
                            </button>
                            <button
                              onClick={() => executeInstanceAction(config.id, 'connect')}
                              disabled={!!actionLoading}
                              className="btn-secondary flex items-center gap-1.5 text-xs"
                            >
                              {isActionLoading(config.id, 'connect') ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Smartphone className="h-3.5 w-3.5" />
                              )}
                              QR Code
                            </button>
                            <button
                              onClick={() =>
                                executeInstanceAction(config.id, 'set-webhook', webhookUrl ? { webhookUrl } : undefined)
                              }
                              disabled={!!actionLoading}
                              className="btn-secondary flex items-center gap-1.5 text-xs"
                            >
                              {isActionLoading(config.id, 'set-webhook') ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Link className="h-3.5 w-3.5" />
                              )}
                              Config. Webhook
                            </button>
                            <button
                              onClick={() => executeInstanceAction(config.id, 'restart')}
                              disabled={!!actionLoading}
                              className="btn-secondary flex items-center gap-1.5 text-xs"
                            >
                              {isActionLoading(config.id, 'restart') ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5" />
                              )}
                              Reiniciar
                            </button>
                            <button
                              onClick={() => executeInstanceAction(config.id, 'logout')}
                              disabled={!!actionLoading}
                              className="btn-secondary flex items-center gap-1.5 text-xs text-orange-600 border-orange-200 hover:bg-orange-50"
                            >
                              {isActionLoading(config.id, 'logout') ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Unlink className="h-3.5 w-3.5" />
                              )}
                              Desconectar
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm('Deletar a instância na Evolution API?')) {
                                  executeInstanceAction(config.id, 'delete');
                                }
                              }}
                              disabled={!!actionLoading}
                              className="btn-secondary flex items-center gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
                            >
                              {isActionLoading(config.id, 'delete') ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <PowerOff className="h-3.5 w-3.5" />
                              )}
                              Deletar Instância
                            </button>
                          </div>

                          {/* Webhook URL */}
                          <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">
                              URL do Webhook (endereço público deste sistema)
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="url"
                                value={webhookUrl}
                                onChange={(e) => setWebhookUrl(e.target.value)}
                                className="input-field font-mono text-xs flex-1"
                                placeholder="https://meu-dominio.com.br"
                              />
                            </div>
                            <p className="mt-1 text-xs text-gray-400">
                              Informe a URL pública onde este sistema está acessível. O caminho <span className="font-mono">/api/webhook/whatsapp</span> será adicionado automaticamente.
                            </p>
                          </div>

                          {/* Info */}
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                            <div>
                              <span className="font-medium">URL:</span> {config.evolutionUrl}
                            </div>
                            <div>
                              <span className="font-medium">API Key:</span> {config.evolutionApiKey}
                            </div>
                            <div>
                              <span className="font-medium">Instância:</span>{' '}
                              {config.evolutionInstance}
                            </div>
                          </div>

                          {/* QR Code */}
                          {activeQrCode?.configId === config.id && (
                            <div className="flex flex-col items-center gap-3 py-4 bg-gray-50 rounded-lg">
                              <p className="text-sm text-gray-600">
                                Escaneie o QR Code com o WhatsApp:
                              </p>
                              <img
                                src={`data:image/png;base64,${activeQrCode.base64}`}
                                alt="QR Code WhatsApp"
                                className="h-56 w-56 rounded-lg border bg-white p-2"
                              />
                              <p className="text-xs text-gray-400">
                                Clique em &quot;QR Code&quot; para atualizar
                              </p>
                            </div>
                          )}

                          {/* QR Code from status (auto-refresh) */}
                          {!activeQrCode?.configId &&
                            !isConnected &&
                            status?.qrcode && (
                              <div className="flex flex-col items-center gap-3 py-4 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-600">
                                  Escaneie o QR Code com o WhatsApp:
                                </p>
                                <img
                                  src={`data:image/png;base64,${status.qrcode}`}
                                  alt="QR Code WhatsApp"
                                  className="h-56 w-56 rounded-lg border bg-white p-2"
                                />
                                <p className="text-xs text-gray-400">
                                  Atualiza automaticamente a cada 10s
                                </p>
                              </div>
                            )}
                        </div>
                      ) : (
                        /* Meta Official API Info */
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                            <div>
                              <span className="font-medium">Phone ID:</span> {config.metaPhoneId}
                            </div>
                            <div>
                              <span className="font-medium">Token:</span> {config.metaToken}
                            </div>
                          </div>

                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                            <p className="font-medium mb-2">Configuração do Webhook no Meta Dashboard:</p>
                            <ol className="list-decimal list-inside space-y-1 text-xs">
                              <li>
                                Acesse{' '}
                                <span className="font-mono bg-amber-100 px-1 rounded">
                                  developers.facebook.com
                                </span>{' '}
                                → Seu App → WhatsApp → Configurações
                              </li>
                              <li>
                                URL do Webhook:{' '}
                                <span className="font-mono bg-amber-100 px-1 rounded">
                                  {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhook/whatsapp
                                </span>
                              </li>
                              <li>
                                Verify Token:{' '}
                                <span className="font-mono bg-amber-100 px-1 rounded">
                                  {config.metaVerifyToken || '(defina ao editar)'}
                                </span>
                              </li>
                              <li>Inscreva-se nos eventos: <strong>messages</strong></li>
                            </ol>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => executeInstanceAction(config.id, 'status')}
                              disabled={!!actionLoading}
                              className="btn-secondary flex items-center gap-1.5 text-xs"
                            >
                              <Power className="h-3.5 w-3.5" />
                              Testar Conexão
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ============================================ */}
      {/* SEÇÃO 2: GRUPOS MONITORADOS */}
      {/* ============================================ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Grupos Monitorados</h2>
          <button onClick={openCreateGrupo} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" />
            Novo Grupo
          </button>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-sm font-semibold text-gray-700">Nome</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-700">ID do Grupo</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-700">Palavras-chave</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {gruposLoading && grupos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      Carregando...
                    </td>
                  </tr>
                ) : grupos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      Nenhum grupo monitorado. Adicione um grupo para captar oportunidades.
                    </td>
                  </tr>
                ) : (
                  grupos.map((grupo) => (
                    <tr key={grupo.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{grupo.nome}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-mono text-xs">
                        {grupo.grupoId}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {grupo.palavrasChave.map((kw, i) => (
                            <span
                              key={i}
                              className="inline-flex rounded-md bg-arteita-blue-50 px-2 py-0.5 text-xs text-arteita-blue-500"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleGrupoActive(grupo)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${grupo.active ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${grupo.active ? 'translate-x-6' : 'translate-x-1'
                              }`}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditGrupo(grupo)}
                            className="p-1.5 rounded-md text-arteita-blue-500 hover:bg-arteita-blue-500/10"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteGrupo(grupo)}
                            className="p-1.5 rounded-md text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* SEÇÃO 3: CONFIG DO BOT */}
      {/* ============================================ */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Configurações do Bot</h2>
        <div className="card space-y-4">
          <div>
            <label className="label-field">
              <MessageCircle className="inline h-4 w-4 mr-1" />
              Mensagem de Boas-vindas
            </label>
            <textarea
              value={botConfig.msgBoasVindas}
              onChange={(e) => setBotConfig({ ...botConfig, msgBoasVindas: e.target.value })}
              className="input-field"
              rows={2}
              placeholder="Use {nome} para o nome do motorista"
            />
            <p className="mt-1 text-xs text-gray-400">
              Use {'{nome}'} para incluir o nome do motorista
            </p>
          </div>
          <div>
            <label className="label-field">
              <MessageCircle className="inline h-4 w-4 mr-1" />
              Mensagem de Confirmação
            </label>
            <textarea
              value={botConfig.msgConfirmacao}
              onChange={(e) => setBotConfig({ ...botConfig, msgConfirmacao: e.target.value })}
              className="input-field"
              rows={2}
            />
          </div>
          <div className="max-w-xs">
            <label className="label-field">
              <Settings className="inline h-4 w-4 mr-1" />
              Timeout da Sessão (minutos)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={botConfig.timeoutMinutos}
              onChange={(e) =>
                setBotConfig({ ...botConfig, timeoutMinutos: parseInt(e.target.value) || 10 })
              }
              className="input-field"
            />
          </div>
          <div className="flex justify-end">
            <button onClick={saveBotConfig} className="btn-primary">
              Salvar Configurações
            </button>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* MODAL: CRIAR/EDITAR CONFIG */}
      {/* ============================================ */}
      {configModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setConfigModalOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingConfig ? 'Editar Configuração' : 'Nova Configuração'}
            </h2>

            {/* Tabs (only for new config) */}
            {!editingConfig && (
              <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setConfigTab('EVOLUTION')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${configTab === 'EVOLUTION'
                    ? 'bg-white text-arteita-blue-500 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <Server className="h-4 w-4" />
                  Evolution API
                </button>
                <button
                  onClick={() => setConfigTab('META_OFFICIAL')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${configTab === 'META_OFFICIAL'
                    ? 'bg-white text-amber-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <Globe className="h-4 w-4" />
                  Meta Official
                </button>
              </div>
            )}

            <form onSubmit={handleConfigSubmit} className="space-y-4">
              <div>
                <label className="label-field">
                  Nome da Configuração <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={configForm.nome}
                  onChange={(e) => setConfigForm({ ...configForm, nome: e.target.value })}
                  className="input-field"
                  placeholder="Ex: Arteita Principal"
                  required
                />
              </div>

              {configTab === 'EVOLUTION' ? (
                <>
                  <div>
                    <label className="label-field">
                      URL do Servidor <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      value={configForm.evolutionUrl}
                      onChange={(e) =>
                        setConfigForm({ ...configForm, evolutionUrl: e.target.value })
                      }
                      className="input-field font-mono text-sm"
                      placeholder="http://localhost:8080"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-field">
                      API Key {!editingConfig && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="password"
                      value={configForm.evolutionApiKey}
                      onChange={(e) =>
                        setConfigForm({ ...configForm, evolutionApiKey: e.target.value })
                      }
                      className="input-field font-mono text-sm"
                      placeholder={editingConfig ? '(deixe vazio para manter)' : 'sua-api-key'}
                      required={!editingConfig}
                    />
                  </div>
                  <div>
                    <label className="label-field">
                      Nome da Instância <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={configForm.evolutionInstance}
                      onChange={(e) =>
                        setConfigForm({ ...configForm, evolutionInstance: e.target.value })
                      }
                      className="input-field font-mono text-sm"
                      placeholder="arteita"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Nome único para identificar a instância na Evolution API
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="label-field">
                      Access Token {!editingConfig && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="password"
                      value={configForm.metaToken}
                      onChange={(e) =>
                        setConfigForm({ ...configForm, metaToken: e.target.value })
                      }
                      className="input-field font-mono text-sm"
                      placeholder={editingConfig ? '(deixe vazio para manter)' : 'EAAx...'}
                      required={!editingConfig}
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Token permanente do System User no Business Manager
                    </p>
                  </div>
                  <div>
                    <label className="label-field">
                      Phone Number ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={configForm.metaPhoneId}
                      onChange={(e) =>
                        setConfigForm({ ...configForm, metaPhoneId: e.target.value })
                      }
                      className="input-field font-mono text-sm"
                      placeholder="123456789012345"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-field">Verify Token</label>
                    <input
                      type="text"
                      value={configForm.metaVerifyToken}
                      onChange={(e) =>
                        setConfigForm({ ...configForm, metaVerifyToken: e.target.value })
                      }
                      className="input-field font-mono text-sm"
                      placeholder="meu-token-de-verificacao"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Token usado na verificação do webhook no Meta Dashboard
                    </p>
                  </div>
                  <div>
                    <label className="label-field">App Secret (opcional)</label>
                    <input
                      type="password"
                      value={configForm.metaAppSecret}
                      onChange={(e) =>
                        setConfigForm({ ...configForm, metaAppSecret: e.target.value })
                      }
                      className="input-field font-mono text-sm"
                      placeholder={editingConfig ? '(deixe vazio para manter)' : ''}
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfigModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* MODAL: CRIAR/EDITAR GRUPO */}
      {/* ============================================ */}
      {grupoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setGrupoModalOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingGrupo ? 'Editar Grupo' : 'Novo Grupo'}
            </h2>
            <form onSubmit={handleGrupoSubmit} className="space-y-4">
              <div>
                <label className="label-field">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={grupoForm.nome}
                  onChange={(e) => setGrupoForm({ ...grupoForm, nome: e.target.value })}
                  className="input-field"
                  placeholder="Ex: Fretes MG"
                  required
                />
              </div>
              <div>
                <label className="label-field">
                  Grupo do WhatsApp <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={grupoForm.grupoId}
                    onChange={(e) => setGrupoForm({ ...grupoForm, grupoId: e.target.value })}
                    className="input-field font-mono text-sm flex-1"
                    placeholder="ID do grupo ou selecione abaixo"
                    required
                  />
                  <button
                    type="button"
                    onClick={fetchWhatsappGroups}
                    disabled={whatsappGroupsLoading}
                    className="btn-secondary flex items-center gap-1.5 text-xs whitespace-nowrap"
                  >
                    {whatsappGroupsLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Buscar
                  </button>
                </div>

                {/* Group Picker List */}
                {showGroupPicker && whatsappGroups.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                    {whatsappGroups.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => selectWhatsappGroup(group)}
                        className={`w-full text-left px-3 py-2 hover:bg-arteita-blue-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                          grupoForm.grupoId === group.id ? 'bg-arteita-blue-50' : ''
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-900">{group.name}</p>
                        <p className="text-xs text-gray-500">
                          <span className="font-mono">{group.id}</span>
                          <span className="ml-2">({group.size} membros)</span>
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                {showGroupPicker && whatsappGroups.length === 0 && !whatsappGroupsLoading && (
                  <p className="mt-2 text-xs text-gray-400">
                    Nenhum grupo encontrado. Verifique se o WhatsApp está conectado.
                  </p>
                )}

                {!showGroupPicker && (
                  <p className="mt-1 text-xs text-gray-400">
                    Digite o ID manualmente ou clique em &quot;Buscar&quot; para listar os grupos
                  </p>
                )}
              </div>
              <div>
                <label className="label-field">Palavras-chave</label>
                <input
                  type="text"
                  value={grupoForm.palavrasChave}
                  onChange={(e) => setGrupoForm({ ...grupoForm, palavrasChave: e.target.value })}
                  className="input-field"
                  placeholder="areia, brita, construção, frete"
                />
                <p className="mt-1 text-xs text-gray-400">Separadas por vírgula</p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setGrupoModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
