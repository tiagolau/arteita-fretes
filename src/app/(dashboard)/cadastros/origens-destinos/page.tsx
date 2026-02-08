'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'

interface OrigemDestino {
  id: string
  nome: string
  cidade: string
  uf: string
}

const emptyForm = { nome: '', cidade: '', uf: '' }

export default function OrigensDestinosPage() {
  const [items, setItems] = useState<OrigemDestino[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<OrigemDestino | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)

  const fetchItems = async () => {
    try {
      setLoading(true)
      const params = search ? `?search=${encodeURIComponent(search)}` : ''
      const res = await fetch(`/api/origens-destinos${params}`)
      if (!res.ok) throw new Error('Erro ao buscar origens/destinos')
      const response = await res.json()
      setItems(response.data || [])
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar origens/destinos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [search])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (item: OrigemDestino) => {
    setEditing(item)
    setForm({
      nome: item.nome,
      cidade: item.cidade,
      uf: item.uf,
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
    setForm(emptyForm)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nome.trim()) {
      toast.error('Nome é obrigatório')
      return
    }

    try {
      setLoading(true)
      if (editing) {
        const res = await fetch(`/api/origens-destinos/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error('Erro ao atualizar origem/destino')
        toast.success('Origem/Destino atualizado com sucesso')
      } else {
        const res = await fetch('/api/origens-destinos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error('Erro ao criar origem/destino')
        toast.success('Origem/Destino criado com sucesso')
      }
      closeModal()
      fetchItems()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar origem/destino')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (item: OrigemDestino) => {
    if (!window.confirm(`Deseja realmente excluir "${item.nome}"?`)) return

    try {
      setLoading(true)
      const res = await fetch(`/api/origens-destinos/${item.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao excluir origem/destino')
      toast.success('Origem/Destino excluído com sucesso')
      fetchItems()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir origem/destino')
    } finally {
      setLoading(false)
    }
  }

  const UF_OPTIONS = [
    'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN',
    'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Origens / Destinos</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Novo Local
        </button>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar origens/destinos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-sm font-semibold text-gray-700">Nome</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700">Cidade</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700">UF</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    Carregando...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    Nenhuma origem/destino encontrado
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{item.nome}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.cidade}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.uf}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1.5 rounded-md text-arteita-blue-500 hover:bg-arteita-blue-500/10 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
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

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editing ? 'Editar Origem/Destino' : 'Nova Origem/Destino'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label-field">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label-field">Cidade</label>
                <input
                  type="text"
                  value={form.cidade}
                  onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-field">UF</label>
                <select
                  value={form.uf}
                  onChange={(e) => setForm({ ...form, uf: e.target.value })}
                  className="input-field"
                >
                  <option value="">Selecione...</option>
                  {UF_OPTIONS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
