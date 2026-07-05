'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { FolderPlus, Pencil, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'

interface Category {
  id: string
  name: string
  order: number
  createdAt: string
}

const schema = z.object({
  name: z.string().min(1, 'Obrigatório'),
  order: z.coerce.number().int().default(0),
})

type FormData = z.infer<typeof schema>

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [saving, setSaving] = useState(false)

  const createForm = useForm<FormData>({ resolver: zodResolver(schema) })
  const editForm = useForm<FormData>({ resolver: zodResolver(schema) })

  function loadCategories() {
    setLoading(true)
    api.get<Category[]>('/categories')
      .then((r) => setCategories(r.data))
      .catch(() => toast.error('Erro ao carregar categorias'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadCategories() }, [])

  async function onCreate(data: FormData) {
    setSaving(true)
    try {
      await api.post('/categories', data)
      setShowCreate(false)
      createForm.reset()
      loadCategories()
      toast.success('Categoria criada')
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao criar categoria')
    } finally {
      setSaving(false)
    }
  }

  function openEdit(cat: Category) {
    setEditingCategory(cat)
    editForm.reset({ name: cat.name, order: cat.order })
  }

  async function onEdit(data: FormData) {
    if (!editingCategory) return
    setSaving(true)
    try {
      await api.patch(`/categories/${editingCategory.id}`, data)
      setEditingCategory(null)
      loadCategories()
      toast.success('Categoria atualizada')
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao atualizar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta categoria? Os canais vinculados ficarão sem categoria.')) return
    try {
      await api.delete(`/categories/${id}`)
      loadCategories()
      toast.success('Categoria removida')
    } catch {
      toast.error('Erro ao remover categoria')
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-2xl font-bold text-white">Categorias</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <FolderPlus size={16} />
          Nova Categoria
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-left">
                <th className="px-4 py-3 font-medium">Ordem</th>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} className="border-b border-gray-800 last:border-0">
                  <td className="px-4 py-3 text-gray-500 w-16">{cat.order}</td>
                  <td className="px-4 py-3 text-white font-medium">{cat.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(cat)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors" title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(cat.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors" title="Remover">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                    Nenhuma categoria criada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-4">Nova Categoria</h3>
            <form onSubmit={createForm.handleSubmit(onCreate)} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Nome *</label>
                <input {...createForm.register('name')} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
                {createForm.formState.errors.name && <p className="text-red-400 text-xs mt-1">{createForm.formState.errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Ordem</label>
                <input {...createForm.register('order')} type="number" defaultValue={0} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); createForm.reset() }} className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50">{saving ? 'Criando...' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingCategory && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-4">Editar Categoria</h3>
            <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Nome *</label>
                <input {...editForm.register('name')} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
                {editForm.formState.errors.name && <p className="text-red-400 text-xs mt-1">{editForm.formState.errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Ordem</label>
                <input {...editForm.register('order')} type="number" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingCategory(null)} className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
