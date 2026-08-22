-- BookRecord* テーブルの RLS ポリシー定義。
--
-- 【位置づけ】本ファイルは本番（共有 Supabase）に適用済みの定義の「写し」である。
-- schema.prisma と同じく正は本番側にあり、こちらから本番へ適用しない
-- （.claude/rules/database.md「スキーマ同期フロー」/ .claude/rules/production-data.md）。
--
-- 【用途】IT のテストコンテナへ適用し、ポリシーの実挙動を検証する。
-- Prisma は DATABASE_URL でオーナーロールとして接続するため RLS をバイパスする
-- （docs/06-security-specification.md §7.1）。IT は非オーナーロールで接続して検証する。
--
-- 【本番との突合】Supabase の SQL Editor で以下を実行し、本ファイルと一致することを確認する。
--   select tablename, policyname, cmd, roles, qual, with_check
--   from pg_policies
--   where schemaname = 'public'
--     and tablename in ('BookRecordBooks', 'BookRecordProgressLogs', 'BookRecordReflections')
--   order by tablename, cmd, policyname;
--
-- 最終突合日: 2026-08-22（11 ポリシー・docs/06 §7.2 の表と一致を確認）
--
-- 【ロール】本番のポリシーはいずれも roles = {public}（＝全ロール対象）であり、
-- anon / authenticated を名指ししていない。ここでも to 句を付けずに PUBLIC 既定とする。

alter table "BookRecordBooks" enable row level security;
alter table "BookRecordProgressLogs" enable row level security;
alter table "BookRecordReflections" enable row level security;

-- --- BookRecordBooks ---------------------------------------------------------
drop policy if exists "Public read" on "BookRecordBooks";
create policy "Public read" on "BookRecordBooks"
  for select using (true);

drop policy if exists "Auth write" on "BookRecordBooks";
create policy "Auth write" on "BookRecordBooks"
  for insert with check (auth.uid() is not null);

drop policy if exists "Auth update" on "BookRecordBooks";
create policy "Auth update" on "BookRecordBooks"
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "Auth delete" on "BookRecordBooks";
create policy "Auth delete" on "BookRecordBooks"
  for delete using (auth.uid() is not null);

-- --- BookRecordProgressLogs --------------------------------------------------
-- UPDATE ポリシーは意図的に存在しない。進捗ログは追記のみで編集不可
-- （docs/05-data-specification.md・docs/06-security-specification.md §7.2）。
drop policy if exists "Public read" on "BookRecordProgressLogs";
create policy "Public read" on "BookRecordProgressLogs"
  for select using (true);

drop policy if exists "Auth write" on "BookRecordProgressLogs";
create policy "Auth write" on "BookRecordProgressLogs"
  for insert with check (auth.uid() is not null);

drop policy if exists "Auth delete" on "BookRecordProgressLogs";
create policy "Auth delete" on "BookRecordProgressLogs"
  for delete using (auth.uid() is not null);

-- --- BookRecordReflections ---------------------------------------------------
drop policy if exists "Public read" on "BookRecordReflections";
create policy "Public read" on "BookRecordReflections"
  for select using (true);

drop policy if exists "Auth write" on "BookRecordReflections";
create policy "Auth write" on "BookRecordReflections"
  for insert with check (auth.uid() is not null);

drop policy if exists "Auth update" on "BookRecordReflections";
create policy "Auth update" on "BookRecordReflections"
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "Auth delete" on "BookRecordReflections";
create policy "Auth delete" on "BookRecordReflections"
  for delete using (auth.uid() is not null);
