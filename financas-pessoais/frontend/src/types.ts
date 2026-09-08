export type TransactionType = 'receita' | 'despesa'

export interface User {
  id: number
  name: string
  email: string
}

export interface LoginResult {
  token?: string
  user?: User
  requires2fa?: boolean
  devicePending?: boolean
  deviceLabel?: string
}

export type DeviceStatus = 'pending' | 'trusted' | 'revoked'

export interface Device {
  id: number
  label: string
  status: DeviceStatus
  createdAt: string
  lastSeenAt: string
  isCurrent: boolean
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
