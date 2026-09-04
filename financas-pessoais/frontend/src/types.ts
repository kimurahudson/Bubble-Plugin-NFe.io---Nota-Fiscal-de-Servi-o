export type TransactionType = 'receita' | 'despesa'

export interface User {
  id: number
  name: string
  email: string
}

export interface Category {
  id: number
  name: string
  type: TransactionType
  color: string
}

export interface Bank {
  id: number
  name: string
}

export interface Transaction {
  id: number
  date: string
  description: string
  value: number
  type: TransactionType
  installment: number
  installmentTotal: number
  categoryId: number | null
  bankId: number | null
  createdAt: string
  updatedAt: string
}

export interface TransactionInput {
  date: string
  description: string
  value: number
  type: TransactionType
  installment: number
  installmentTotal: number
  categoryId: number | null
  bankId: number | null
}
