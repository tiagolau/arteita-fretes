'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'

interface Transportadora {
  id: string
  razaoSocial: string
  cnpj: string
  contato: string
  telefone: string
}

const emptyForm = { razaoSocial: '', cnpj: '', contato: '', telefone: '' }

export default function TransportadorasPage() {
  const [items, setItems] = useState<Transportadora[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Transportadora | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)

  const fetchItems = async () => {
    try {
      setLoading(true)
      const params = search ? `?search=${encodeURIComponent(search)}` : ''
      const res = await fetch(`/api/transportadoras${params}`)
      if (!res.ok) throw new Error('Erro ao buscar transportadoras')
      const response = await res.json()
      setItems(response.data || [])
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar transportadoras')
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

  const openEdit = (item: Transportadora) => {
    setEditing(item)
    setForm({
      razaoSocial: item.razaoSocial,
      cnpj: item.cnpj,
      contato: item.contato,
      telefone: item.telefone,
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
    if (!form.razaoSocial.trim()) {
      toast.error('Razão Social é obrigatória')
      return
    }

    try {
      setLoading(true)
      if (editing) {
        const res = await fetch(`/api/transportadoras/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error('Erro ao atualizar transportadora')
        toast.success('Transportadora atualizada com sucesso')
      } else {
        const res = await fetch('/api/transportadoras', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error('Erro ao criar transportadora')
        toast.success('Transportadora criada com sucesso')
      }
      closeModal()
      fetchItems()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar transportadora')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (item: Transportadora) => {
    if (!window.confirm(`Deseja realmente excluir a transportadora "${item.razaoSocial}"?`)) return

    try {
      setLoading(true)
      const res = await fetch(`/api/transportadoras/${item.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao excluir transportadora')
      toast.success('Transportadora excluída com sucesso')
      fetchItems()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir transportadora')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Transportadoras</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nova Transportadora
        </button>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar transportadoras..."
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
                <th className="px-4 py-3 text-sm font-semibold text-gray-700">Razão Social</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700">CNPJ</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700">Contato</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700">Telefone</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Carregando...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Nenhuma transportadora encontrada
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{item.razaoSocial}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.cnpj}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.contato}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.telefone}</td>
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
              {editing ? 'Editar Transportadora' : 'Nova Transportadora'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label-field">
                  Razão Social <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.razaoSocial}
                  onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label-field">CNPJ</label>
                <input
                  type="text"
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-field">Contato</label>
                <input
                  type="text"
                  value={form.contato}
                  onChange={(e) => setForm({ ...form, contato: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-field">Telefone</label>
                <input
                  type="text"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
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
