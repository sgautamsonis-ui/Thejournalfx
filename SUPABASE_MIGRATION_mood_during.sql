-- Run this once in Supabase SQL editor (Project > SQL Editor) before using
-- the new "Mood During" fields in Add Trade. Without this, mood_during
-- data will be silently dropped when a trade is saved.

alter table public.trades
  add column if not exists mood_during text[] default '{}';

alter table public.trades
  add column if not exists mood_during_notes text default '';
