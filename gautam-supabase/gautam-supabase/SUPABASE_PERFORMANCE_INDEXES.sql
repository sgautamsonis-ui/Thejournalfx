-- Run this once in Supabase Dashboard -> SQL Editor -> New query.
-- These are non-destructive indexes for the filters and date ordering used by
-- TheJournalFX. Existing rows and Supabase Auth settings are not changed.
create index if not exists trades_user_date_idx
  on public.trades (user_id, date desc);

create index if not exists trades_user_account_date_idx
  on public.trades (user_id, account_id, date desc);

create index if not exists trades_user_id_idx
  on public.trades (user_id, id);

create index if not exists accounts_user_id_idx
  on public.accounts (user_id, id);

create index if not exists bias_user_type_date_idx
  on public.bias (user_id, type, date desc);
