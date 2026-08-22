-- IT で RLS ポリシーの実挙動を検証するための足場。**テストコンテナ限定**。
-- 本番（Supabase）には auth スキーマ・anon / authenticated ロールが存在するが、
-- 素の postgres イメージには無いため、検証に必要な最小限だけ再現する。
--
-- 本番へ適用しない（.claude/rules/production-data.md「禁止する操作」）。
-- 適用経路は tests/support/it-global-setup.ts のみで、接続先は allowlist で
-- localhost に限定済み（.claude/rules/testing.md「テスト用 DB の接続先」）。

create schema if not exists auth;

-- Supabase の auth.uid() 相当。JWT クレームの sub を返す。
-- IT 側は set_config('request.jwt.claims', ...) で未認証／認証済みを切り替える。
-- クレーム未設定・空文字でも落ちないようにする（未設定＝未認証として null を返す）。
create or replace function auth.uid() returns uuid
language plpgsql
stable
as $$
declare
  claims text := current_setting('request.jwt.claims', true);
begin
  if claims is null or claims = '' then
    return null;
  end if;

  return nullif(claims::json ->> 'sub', '')::uuid;
end;
$$;

do $$
begin
  -- 本番と同じロール名を用意する。ポリシーは roles = {public} のため式には現れないが、
  -- 本番との差を減らすために作っておく。
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;

  -- RLS を観測するための非オーナーロール。
  -- **テーブルのオーナー（postgres）は既定で RLS をバイパスする**ため、
  -- オーナー接続のままではポリシーが 1 行も効かない（docs/06 §7.1 と同じ理由）。
  -- 使い捨てコンテナ限定の固定パスワードであり、シークレットではない。
  if not exists (select 1 from pg_roles where rolname = 'rls_tester') then
    create role rls_tester login password 'rls_tester';
  end if;
end
$$;

grant usage on schema public to rls_tester;
grant usage on schema auth to rls_tester;
grant execute on function auth.uid() to rls_tester;
grant select, insert, update, delete on all tables in schema public to rls_tester;
grant usage, select on all sequences in schema public to rls_tester;
