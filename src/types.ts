export type CategoryType = 'expense' | 'income'
export type DebtStatus = 'active' | 'paid_off'
export type PaymentKind = 'cuota' | 'abono_capital'
export type RecurringFrequency = 'monthly' | 'once' | 'yearly'
export type AccountType = 'ahorros' | 'corriente' | 'tarjeta_credito' | 'efectivo' | 'otro'

export interface Category {
  id: string
  name: string
  icon: string
  type: CategoryType
  color: string
  is_frequent: boolean
  sort_order: number
  archived: boolean
}

export interface Account {
  id: string
  name: string
  type: AccountType
  icon: string
  color: string
  initial_balance: number
  debt_id: string | null
  is_default: boolean
  archived: boolean
}

export interface Transaction {
  id: string
  amount: number
  type: CategoryType
  category_id: string | null
  note: string | null
  occurred_at: string
  created_at: string
  account_id: string | null
  transfer_id: string | null
}

export interface Debt {
  id: string
  name: string
  original_amount: number | null
  current_balance: number
  interest_rate_ea: number | null
  monthly_payment: number | null
  payment_day: number | null
  end_date: string | null
  status: DebtStatus
  notes: string | null
  archived: boolean
}

export interface DebtPayment {
  id: string
  debt_id: string
  amount: number
  kind: PaymentKind
  paid_at: string
  account_id: string | null
}

export interface RecurringPayment {
  id: string
  name: string
  amount: number | null
  due_day: number | null
  due_date: string | null
  frequency: RecurringFrequency
  debt_id: string | null
  active: boolean
  category_id: string | null
}

export interface Goal {
  id: string
  name: string
  target_amount: number
  current_amount: number
  deadline: string | null
  icon: string
  sort_order: number
  is_debt_free_goal: boolean
  archived: boolean
}

export interface Settings {
  id: string
  monthly_income_expected: number
  monthly_essential_budget: number
}
