'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  MessageSquare,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Phone,
  MapPin,
  DollarSign,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';

interface Oportunidade {
  id: string;
  mensagemOriginal: string;
  tipoCarga: string | null;
  origem: string | null;
  destino: string | null;
  tonelagem: number | null;
  precoOferecido: number | null;
  urgencia: string | null;
  contato: string | null;
  prioridade: 'ALTA' | 'MEDIA' | 'BAIXA';
  status: 'NOVA' | 'EM_ANALISE' | 'ACEITA' | 'DESCARTADA';
  createdAt: string;
  grupo: { id: string; nome: string };
}

interface Grupo {
  id: string;
  nome: string;
}

const prioridadeStyles = {
  ALTA: 'bg-red-100 text-red-800',
  MEDIA: 'bg-yellow-100 text-yellow-800',
  BAIXA: 'bg-gray-100 text-gray-700',
};

const statusStyles = {
  NOVA: 'bg-blue-100 text-blue-800',
  EM_ANALISE: 'bg-yellow-100 text-yellow-800',
  ACEITA: 'bg-green-100 text-green-800',
  DESCARTADA: 'bg-gray-100 text-gray-600',
};

const statusLabels = {
  NOVA: 'Nova',
  EM_ANALISE: 'Em Análise',
  ACEITA: 'Aceita',
  DESCARTADA: 'Descartada',
};

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'agora mesmo';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function OportunidadesPage() {
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [filters, setFilters] = useState({
    status: '',
    prioridade: '',
    grupoId: '',
    dataInicio: '',
    dataFim: '',
  });

  const [stats, setStats] = useState({ total: 0, novas: 0, emAnalise: 0, aceitas: 0 });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '12' });
      if (filters.status) params.set('status', filters.status);
      if (filters.prioridade) params.set('prioridade', filters.prioridade);
      if (filters.grupoId) params.set('grupoId', filters.grupoId);
      if (filters.dataInicio) params.set('dataInicio', filters.dataInicio);
      if (filters.dataFim) params.set('dataFim', filters.dataFim);

      const res = await fetch(`/api/oportunidades?${params}`);
      if (!res.ok) throw new Error('Erro ao buscar oportunidades');
      const json = await res.json();
      setOportunidades(json.data);
      setTotal(json.total);
      setTotalPages(json.totalPages);

      // Calculate stats from unfiltered data
      const statsRes = await fetch('/api/oportunidades?limit=9999');
      if (statsRes.ok) {
        const allData = await statsRes.json();
        const all = allData.data as Oportunidade[];
        setStats({
          total: all.length,
          novas: all.filter((o) => o.status === 'NOVA').length,
          emAnalise: all.filter((o) => o.status === 'EM_ANALISE').length,
          aceitas: all.filter((o) => o.status === 'ACEITA').length,
        });
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetch('/api/grupos-whatsapp')
      .then((r) => r.json())
      .then((d) => setGrupos(Array.isArray(d) ? d : d.data || []));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/oportunidades/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Erro ao atualizar');
      toast.success(`Status atualizado para ${statusLabels[status as keyof typeof statusLabels]}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Oportunidades de Frete</h1>
          <p className="mt-1 text-sm text-gray-500">{stats.total} oportunidades no total</p>
        </div>
        <button onClick={fetchData} className="btn-secondary flex items-center gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card flex items-center gap-4">
          <div className="rounded-lg bg-gray-100 p-3">
            <MessageSquare className="h-6 w-6 text-gray-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-500">Total</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="rounded-lg bg-blue-100 p-3">
            <TrendingUp className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.novas}</p>
            <p className="text-sm text-gray-500">Novas</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="rounded-lg bg-yellow-100 p-3">
            <Clock className="h-6 w-6 text-yellow-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.emAnalise}</p>
            <p className="text-sm text-gray-500">Em Análise</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="rounded-lg bg-green-100 p-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.aceitas}</p>
            <p className="text-sm text-gray-500">Aceitas</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="label-field">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="input-field"
            >
              <option value="">Todos</option>
              <option value="NOVA">Nova</option>
              <option value="EM_ANALISE">Em Análise</option>
              <option value="ACEITA">Aceita</option>
              <option value="DESCARTADA">Descartada</option>
            </select>
          </div>
          <div>
            <label className="label-field">Prioridade</label>
            <select
              value={filters.prioridade}
              onChange={(e) => handleFilterChange('prioridade', e.target.value)}
              className="input-field"
            >
              <option value="">Todas</option>
              <option value="ALTA">Alta</option>
              <option value="MEDIA">Média</option>
              <option value="BAIXA">Baixa</option>
            </select>
          </div>
          <div>
            <label className="label-field">Grupo</label>
            <select
              value={filters.grupoId}
              onChange={(e) => handleFilterChange('grupoId', e.target.value)}
              className="input-field"
            >
              <option value="">Todos</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Data Início</label>
            <input
              type="date"
              value={filters.dataInicio}
              onChange={(e) => handleFilterChange('dataInicio', e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field">Data Fim</label>
            <input
              type="date"
              value={filters.dataFim}
              onChange={(e) => handleFilterChange('dataFim', e.target.value)}
              className="input-field"
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => {
              setFilters({ status: '', prioridade: '', grupoId: '', dataInicio: '', dataFim: '' });
              setPage(1);
            }}
            className="btn-secondary text-sm"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* Opportunities Cards */}
      {loading && oportunidades.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Carregando...</div>
      ) : oportunidades.length === 0 ? (
        <div className="card text-center py-12">
          <MessageSquare className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">Nenhuma oportunidade encontrada</p>
          <p className="mt-1 text-sm text-gray-400">
            As oportunidades aparecerão automaticamente quando a IA detectar fretes nos grupos do
            WhatsApp.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {oportunidades.map((op) => (
            <div key={op.id} className="card space-y-3">
              {/* Header badges */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${prioridadeStyles[op.prioridade]}`}
                  >
                    {op.prioridade === 'ALTA' ? 'Alta' : op.prioridade === 'MEDIA' ? 'Média' : 'Baixa'}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[op.status]}`}
                  >
                    {statusLabels[op.status]}
                  </span>
                </div>
                <span className="text-xs text-gray-400">{timeAgo(op.createdAt)}</span>
              </div>

              {/* Data */}
              <div className="space-y-2">
                {op.tipoCarga && (
                  <p className="text-sm font-medium text-gray-900">{op.tipoCarga}</p>
                )}

                {(op.origem || op.destino) && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>
                      {op.origem || '?'} → {op.destino || '?'}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-4 text-sm text-gray-600">
                  {op.tonelagem && (
                    <span>{op.tonelagem} ton</span>
                  )}
                  {op.precoOferecido && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      {formatCurrency(op.precoOferecido)}/ton
                    </span>
                  )}
                </div>

                {op.urgencia && (
                  <p className="text-sm text-orange-600 font-medium">
                    <Clock className="inline h-3.5 w-3.5 mr-1" />
                    {op.urgencia}
                  </p>
                )}

                {op.contato && (
                  <p className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Phone className="h-3.5 w-3.5" />
                    {op.contato}
                  </p>
                )}

                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center rounded-md bg-arteita-blue-50 px-2 py-0.5 text-xs text-arteita-blue-500">
                    {op.grupo?.nome || 'Grupo'}
                  </span>
                </div>
              </div>

              {/* Expandable original message */}
              <div>
                <button
                  onClick={() => toggleExpand(op.id)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                >
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${expandedIds.has(op.id) ? 'rotate-180' : ''}`}
                  />
                  Mensagem original
                </button>
                {expandedIds.has(op.id) && (
                  <p className="mt-1 rounded-md bg-gray-50 p-2 text-xs text-gray-500 whitespace-pre-wrap">
                    {op.mensagemOriginal}
                  </p>
                )}
              </div>

              {/* Actions */}
              {op.status !== 'DESCARTADA' && op.status !== 'ACEITA' && (
                <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
                  {op.status === 'NOVA' && (
                    <button
                      onClick={() => updateStatus(op.id, 'EM_ANALISE')}
                      className="btn-secondary text-xs"
                    >
                      Analisar
                    </button>
                  )}
                  <button
                    onClick={() => updateStatus(op.id, 'ACEITA')}
                    className="btn-primary text-xs"
                  >
                    Aceitar
                  </button>
                  <button
                    onClick={() => updateStatus(op.id, 'DESCARTADA')}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Descartar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Mostrando {oportunidades.length} de {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-sm text-gray-700">
              Página {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              Próximo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
