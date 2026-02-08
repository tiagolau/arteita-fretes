'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'

interface Caminhao {
  id: string
  placa: string
  modelo: string
  capacidade: number | string
}

const emptyForm = { placa: '', modelo: '', capacidade: '' }

export default function CaminhoesPage() {
  const [items, setItems] = useState<Caminhao[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Caminhao | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)

  const fetchItems = async () => {
    try {
      setLoading(true)
      const params = search ? `?search=${encodeURIComponent(search)}` : ''
      const res = await fetch(`/api/caminhoes${params}`)
      if (!res.ok) throw new Error('Erro ao buscar caminhões')
      const response = await res.json()
      setItems(response.data || [])
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar caminhões')
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

  const openEdit = (item: Caminhao) => {
    setEditing(item)
    setForm({
      placa: item.placa,
      modelo: item.modelo,
      capacidade: String(item.capacidade || ''),
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
    if (!form.placa.trim()) {
      toast.error('Placa é obrigatória')
      return
    }

    const payload = {
      ...form,
      capacidade: form.capacidade ? Number(form.capacidade) : null,
    }

    try {
      setLoading(true)
      if (editing) {
        const res = await fetch(`/api/caminhoes/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Erro ao atualizar caminhão')
        toast.success('Caminhão atualizado com sucesso')
      } else {
        const res = await fetch('/api/caminhoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Erro ao criar caminhão')
        toast.success('Caminhão criado com sucesso')
      }
      closeModal()
      fetchItems()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar caminhão')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (item: Caminhao) => {
    if (!window.confirm(`Deseja realmente excluir o caminhão "${item.placa}"?`)) return

    try {
      setLoading(true)
      const res = await fetch(`/api/caminhoes/${item.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao excluir caminhão')
      toast.success('Caminhão excluído com sucesso')
      fetchItems()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir caminhão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Caminhões</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Novo Caminhão
        </button>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar caminhões..."
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
                <th className="px-4 py-3 text-sm font-semibold text-gray-700">Placa</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700">Modelo</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700">Capacidade (ton)</th>
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
                    Nenhum caminhão encontrado
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{item.placa}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.modelo}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.capacidade ? `${item.capacidade} ton` : '—'}
                    </td>
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
              {editing ? 'Editar Caminhão' : 'Novo Caminhão'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label-field">
                  Placa <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.placa}
                  onChange={(e) => setForm({ ...form, placa: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label-field">Modelo</label>
                <input
                  type="text"
                  value={form.modelo}
                  onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-field">Capacidade (ton)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.capacidade}
                  onChange={(e) => setForm({ ...form, capacidade: e.target.value })}
                  className="input-field"
                />
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
