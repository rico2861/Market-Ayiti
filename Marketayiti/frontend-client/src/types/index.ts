// ── User ───────────────────────────────────────────────────────
export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'suspended' | 'banned';

export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  balance: number;
  bonus_balance: number;
  is_email_verified: number;
  created_at: string;
}

// ── Market ─────────────────────────────────────────────────────
export type MarketCategory = 'politik' | 'spo' | 'ekonomi' | 'kilti' | 'sosyal' | 'lot' | 'nouvo';
export type MarketStatus = 'active' | 'closed' | 'resolved' | 'draft' | 'cancelled';

export interface Market {
  id: string;
  slug: string;
  title: string;
  description?: string;
  category: MarketCategory;
  status: MarketStatus;
  end_date: string;
  min_bet: number;
  max_bet: number;
  yes_pool: number;
  no_pool: number;
  yes_prob: number;
  no_prob: number;
  total_volume?: number;
  local_volume?: number;
  bet_count: number;
  resolution?: 'yes' | 'no' | null;
  resolution_source?: string;
  image_url?: string;
  option_a?: string;
  option_b?: string;
  created_at: string;
  updated_at: string;
}

export interface MarketFilters {
  category?: MarketCategory | '';
  status?: MarketStatus | 'all' | '';
  search?: string;
  sort?: 'volume' | 'new' | 'ending' | 'competitive';
  skip?: number;
  limit?: number;
}

// ── Bet ────────────────────────────────────────────────────────
export type BetOption = 'yes' | 'no';
export type BetStatus = 'active' | 'won' | 'lost' | 'cancelled' | 'refunded';

export interface Bet {
  id: string;
  user_id: string;
  market_id: string;
  option: BetOption;
  amount: number;
  potential_payout: number;
  actual_payout?: number;
  odds_at_bet: number;
  status: BetStatus;
  settled_at?: string;
  created_at: string;
  market_title?: string;
  market_slug?: string;
  market_category?: MarketCategory;
  market_status?: MarketStatus;
  market_resolution?: 'yes' | 'no' | null;
}

// ── Transaction ────────────────────────────────────────────────
export type TxType = 'deposit' | 'withdrawal' | 'bet' | 'win' | 'refund' | 'adjustment';
export type TxStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  balance_before: number;
  balance_after: number;
  status: TxStatus;
  description?: string;
  reference_id?: string;
  payment_method?: string;
  created_at: string;
}

// ── Payment Method ─────────────────────────────────────────────
export interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  min: number;
  max: number;
  fee_pct: number;
  processing_time: string;
  color: string;
}

// ── Locale ─────────────────────────────────────────────────────
export type Locale = 'ht' | 'fr';
export const SUPPORTED_LOCALES: readonly Locale[] = ['ht', 'fr'] as const;
