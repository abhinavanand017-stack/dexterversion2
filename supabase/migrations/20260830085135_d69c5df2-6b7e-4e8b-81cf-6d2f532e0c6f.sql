create or replace view public.stock_index_counts as
select idx as index_name, count(*)::int as constituent_count
from public.stock_universe, unnest(index_membership) as idx
group by idx;

grant select on public.stock_index_counts to anon;
grant select on public.stock_index_counts to authenticated;
grant select on public.stock_index_counts to service_role;