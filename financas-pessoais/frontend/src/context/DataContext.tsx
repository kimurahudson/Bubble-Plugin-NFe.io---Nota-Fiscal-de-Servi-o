import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../api'
import type { Bank, Category } from '../types'

interface DataContextValue {
  categories: Category[]
  banks: Bank[]
  loading: boolean
  reloadCategories: () => Promise<void>
  reloadBanks: () => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)

  const reloadCategories = useCallback(async () => {
    const res = await api.get<{ categories: Category[] }>('/categories')
    setCategories(res.categories)
  }, [])

  const reloadBanks = useCallback(async () => {
    const res = await api.get<{ banks: Bank[] }>('/banks')
    setBanks(res.banks)
  }, [])

  useEffect(() => {
    Promise.all([reloadCategories(), reloadBanks()]).finally(() => setLoading(false))
  }, [reloadCategories, reloadBanks])

  return (
    <DataContext.Provider value={{ categories, banks, loading, reloadCategories, reloadBanks }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData deve ser usado dentro de DataProvider')
  return ctx
}
