'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Search, Download, Filter } from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface OrigemDestino {
  id: string
  nome: string
  cidade?: string
  uf?: string
}

interface Transportadora {
  id: string
  razaoSocial: string
}

interface Caminhao {
  id: string
  placa: string
  modelo?: string
}

interface Motorista {
  id: string
  nome: string
}

interface Frete {
  id: string
  data: string
  origemId: string
  destinoId: string
  toneladas: number
  precoTonelada: number
  valorTotal: number
  transportadoraId: string
  ticketNota: string
  caminhaoId: string
  motoristaId: string
  observacao: string | null
  status: 'PENDENTE' | 'VALIDADO' | 'REJEITADO'
  origemRegistro: 'MANUAL' | 'WHATSAPP'
  origem: OrigemDestino
  destino: OrigemDestino
  transportadora: Transportadora
  caminhao: Caminhao
  motorista: Motorista
}

interface FreteForm {
  data: string
  origemId: string
  destinoId: string
  toneladas: string
  precoTonelada: string
  transportadoraId: string
  ticketNota: string
  caminhaoId: string
  motoristaId: string
  observacao: string
}

interface Filters {
  dataInicio: string
  dataFim: string
  origemId: string
  destinoId: string
  transportadoraId: string
  status: string
  search: string
}

// ============================================
// HELPERS
// ============================================

const emptyForm: FreteForm = {
  data: '',
  origemId: '',
  destinoId: '',
  toneladas: '',
  precoTonelada: '',
  transportadoraId: '',
  ticketNota: '',
  caminhaoId: '',
  motoristaId: '',
  observacao: '',
}

const emptyFilters: Filters = {
  dataInicio: '',
  dataFim: '',
  origemId: '',
  destinoId: '',
  transportadoraId: '',
  status: '',
  search: '',
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function toDateInputValue(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toISOString().split('T')[0]
}

// ============================================
// STATUS BADGE
// ============================================

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDENTE: 'bg-yellow-100 text-yellow-800',
    VALIDADO: 'bg-green-100 text-green-800',
    REJEITADO: 'bg-red-100 text-red-800',
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  )
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function FretesPage() {
  // Data state
  const [fretes, setFretes] = useState<Frete[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)

  // Filter state
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Frete | null>(null)
  const [form, setForm] = useState<FreteForm>(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  // Dropdown options
  const [origens, setOrigens] = useState<OrigemDestino[]>([])
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([])
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([])
  const [motoristas, setMotoristas] = useState<Motorista[]>([])

  // ============================================
  // LOAD DROPDOWN OPTIONS
  // ============================================

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [origensRes, transportadorasRes, caminhoesRes, motoristasRes] = await Promise.all([
          fetch('/api/origens-destinos?perPage=1000'),
          fetch('/api/transportadoras?perPage=1000'),
          fetch('/api/caminhoes?perPage=1000'),
          fetch('/api/motoristas?perPage=1000'),
        ])

        if (origensRes.ok) {
          const data = await origensRes.json()
          setOrigens(Array.isArray(data) ? data : data.data || [])
        }
        if (transportadorasRes.ok) {
          const data = await transportadorasRes.json()
          setTransportadoras(Array.isArray(data) ? data : data.data || [])
        }
        if (caminhoesRes.ok) {
          const data = await caminhoesRes.json()
          setCaminhoes(Array.isArray(data) ? data : data.data || [])
        }
        if (motoristasRes.ok) {
          const data = await motoristasRes.json()
          setMotoristas(Array.isArray(data) ? data : data.data || [])
        }
      } catch (err) {
        console.error('Error loading options:', err)
      }
    }

    loadOptions()
  }, [])

  // ============================================
  // FETCH FRETES
  // ============================================

  const fetchFretes = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')

      if (filters.dataInicio) params.set('dataInicio', filters.dataInicio)
      if (filters.dataFim) params.set('dataFim', filters.dataFim)
      if (filters.origemId) params.set('origemId', filters.origemId)
      if (filters.destinoId) params.set('destinoId', filters.destinoId)
      if (filters.transportadoraId) params.set('transportadoraId', filters.transportadoraId)
      if (filters.status) params.set('status', filters.status)
      if (filters.search) params.set('search', filters.search)

      const res = await fetch(`/api/fretes?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao buscar fretes')

      const json = await res.json()
      setFretes(json.data)
      setTotal(json.total)
      setTotalPages(json.totalPages)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar fretes')
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => {
    fetchFretes()
  }, [fetchFretes])

  // ============================================
  // EXPORT CSV
  // ============================================

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.dataInicio) params.set('dataInicio', filters.dataInicio)
      if (filters.dataFim) params.set('dataFim', filters.dataFim)
      if (filters.origemId) params.set('origemId', filters.origemId)
      if (filters.destinoId) params.set('destinoId', filters.destinoId)
      if (filters.transportadoraId) params.set('transportadoraId', filters.transportadoraId)
      if (filters.status) params.set('status', filters.status)
      if (filters.search) params.set('search', filters.search)

      const res = await fetch(`/api/fretes/export?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao exportar fretes')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'fretes.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.success('CSV exportado com sucesso')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao exportar fretes')
    }
  }

  // ============================================
  // MODAL HANDLERS
  // ============================================

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (frete: Frete) => {
    setEditing(frete)
    setForm({
      data: toDateInputValue(frete.data),
      origemId: frete.origemId,
      destinoId: frete.destinoId,
      toneladas: String(frete.toneladas),
      precoTonelada: String(frete.precoTonelada),
      transportadoraId: frete.transportadoraId,
      ticketNota: frete.ticketNota,
      caminhaoId: frete.caminhaoId,
      motoristaId: frete.motoristaId,
      observacao: frete.observacao || '',
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
    setForm(emptyForm)
  }

  // ============================================
  // FORM SUBMIT
  // ============================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.data || !form.origemId || !form.destinoId || !form.toneladas || !form.precoTonelada || !form.transportadoraId || !form.ticketNota || !form.caminhaoId || !form.motoristaId) {
      toast.error('Preencha todos os campos obrigatorios')
      return
    }

    try {
      setSubmitting(true)
      const payload = {
        data: form.data,
        origemId: form.origemId,
        destinoId: form.destinoId,
        toneladas: parseFloat(form.toneladas),
        precoTonelada: parseFloat(form.precoTonelada),
        transportadoraId: form.transportadoraId,
        ticketNota: form.ticketNota,
        caminhaoId: form.caminhaoId,
        motoristaId: form.motoristaId,
        observacao: form.observacao || null,
      }

      if (editing) {
        const res = await fetch(`/api/fretes/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Erro ao atualizar frete')
        }
        toast.success('Frete atualizado com sucesso')
      } else {
        const res = await fetch('/api/fretes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Erro ao criar frete')
        }
        toast.success('Frete criado com sucesso')
      }

      closeModal()
      fetchFretes()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar frete')
    } finally {
      setSubmitting(false)
    }
  }

  // ============================================
  // DELETE
  // ============================================

  const handleDelete = async (frete: Frete) => {
    const motivo = window.prompt(
      `Deseja realmente excluir o frete "${frete.ticketNota}"?\n\nInforme o motivo da exclusao:`
    )

    if (!motivo) return

    try {
      setLoading(true)
      const res = await fetch(`/api/fretes/${frete.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteMotivo: motivo }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao excluir frete')
      }
      toast.success('Frete excluido com sucesso')
      fetchFretes()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir frete')
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // CALCULATED VALUE
  // ============================================

  const valorTotalCalculado =
    form.toneladas && form.precoTonelada
      ? parseFloat(form.toneladas) * parseFloat(form.precoTonelada)
      : 0

  // ============================================
  // FILTER HANDLERS
  // ============================================

  const handleFilterChange = (field: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
    setPage(1)
  }

  const clearFilters = () => {
    setFilters(emptyFilters)
    setPage(1)
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Fretes</h1>
        <div className="flex items-center gap-3">
          <button onClick={handleExport} className="btn-gold flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Frete
          </button>
        </div>
      </div>

      {/* Search + Filter Toggle */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por ticket/nota..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`btn-secondary flex items-center gap-2 ${filtersOpen ? 'ring-2 ring-blue-300' : ''}`}
          >
            <Filter className="h-4 w-4" />
            Filtros
          </button>
        </div>

        {/* Collapsible Filters */}
        {filtersOpen && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="label-field">Data Inicio</label>
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
              <div>
                <label className="label-field">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="input-field"
                >
                  <option value="">Todos</option>
                  <option value="PENDENTE">Pendente</option>
                  <option value="VALIDADO">Validado</option>
                  <option value="REJEITADO">Rejeitado</option>
                </select>
              </div>
              <div>
                <label className="label-field">Origem</label>
                <select
                  value={filters.origemId}
                  onChange={(e) => handleFilterChange('origemId', e.target.value)}
                  className="input-field"
                >
                  <option value="">Todas</option>
                  {origens.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field">Destino</label>
                <select
                  value={filters.destinoId}
                  onChange={(e) => handleFilterChange('destinoId', e.target.value)}
                  className="input-field"
                >
                  <option value="">Todos</option>
                  {origens.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field">Transportadora</label>
                <select
                  value={filters.transportadoraId}
                  onChange={(e) => handleFilterChange('transportadoraId', e.target.value)}
                  className="input-field"
                >
                  <option value="">Todas</option>
                  {transportadoras.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.razaoSocial}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={clearFilters} className="btn-secondary text-sm">
                Limpar Filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-sm font-semibold text-gray-700">Data</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700">Origem / Destino</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">Toneladas</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">R$/Ton</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">Valor Total</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700">Transportadora</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700">Ticket</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700">Placa</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700">Motorista</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && fretes.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                    Carregando...
                  </td>
                </tr>
              ) : fretes.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                    Nenhum frete encontrado
                  </td>
                </tr>
              ) : (
                fretes.map((frete) => (
                  <tr key={frete.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {formatDate(frete.data)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {frete.origem.nome} <span className="text-gray-400 mx-1">&rarr;</span> {frete.destino.nome}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right whitespace-nowrap">
                      {formatCurrency(frete.toneladas)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right whitespace-nowrap">
                      R$ {formatCurrency(frete.precoTonelada)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium text-right whitespace-nowrap">
                      R$ {formatCurrency(frete.valorTotal)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {frete.transportadora.razaoSocial}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {frete.ticketNota}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {frete.caminhao.placa}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {frete.motorista.nome}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={frete.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(frete)}
                          className="p-1.5 rounded-md text-blue-500 hover:bg-blue-50 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(frete)}
                          className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors"
                          title="Excluir"
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Mostrando {fretes.length} de {total} fretes
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-sm text-gray-700">
              Pagina {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Proximo
            </button>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editing ? 'Editar Frete' : 'Novo Frete'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Row 1: Data */}
              <div>
                <label className="label-field">
                  Data <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              {/* Row 2: Origem / Destino */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-field">
                    Origem <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.origemId}
                    onChange={(e) => setForm({ ...form, origemId: e.target.value })}
                    className="input-field"
                    required
                  >
                    <option value="">Selecione...</option>
                    {origens.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-field">
                    Destino <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.destinoId}
                    onChange={(e) => setForm({ ...form, destinoId: e.target.value })}
                    className="input-field"
                    required
                  >
                    <option value="">Selecione...</option>
                    {origens.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Toneladas / Preco / Valor Total */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label-field">
                    Toneladas <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.toneladas}
                    onChange={(e) => setForm({ ...form, toneladas: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="label-field">
                    Preco por Tonelada <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.precoTonelada}
                    onChange={(e) => setForm({ ...form, precoTonelada: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="label-field">Valor Total</label>
                  <input
                    type="text"
                    value={valorTotalCalculado ? `R$ ${formatCurrency(valorTotalCalculado)}` : ''}
                    className="input-field bg-gray-100"
                    disabled
                  />
                </div>
              </div>

              {/* Row 4: Transportadora / Caminhao / Motorista */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label-field">
                    Transportadora <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.transportadoraId}
                    onChange={(e) => setForm({ ...form, transportadoraId: e.target.value })}
                    className="input-field"
                    required
                  >
                    <option value="">Selecione...</option>
                    {transportadoras.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.razaoSocial}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-field">
                    Caminhao <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.caminhaoId}
                    onChange={(e) => setForm({ ...form, caminhaoId: e.target.value })}
                    className="input-field"
                    required
                  >
                    <option value="">Selecione...</option>
                    {caminhoes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.placa} {c.modelo ? `- ${c.modelo}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-field">
                    Motorista <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.motoristaId}
                    onChange={(e) => setForm({ ...form, motoristaId: e.target.value })}
                    className="input-field"
                    required
                  >
                    <option value="">Selecione...</option>
                    {motoristas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 5: Ticket/Nota */}
              <div>
                <label className="label-field">
                  Ticket/Nota <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.ticketNota}
                  onChange={(e) => setForm({ ...form, ticketNota: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              {/* Row 6: Observacao */}
              <div>
                <label className="label-field">Observacao</label>
                <textarea
                  value={form.observacao}
                  onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                  className="input-field"
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
