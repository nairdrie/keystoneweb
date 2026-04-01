-- PostgREST computed column for priority sort order.
-- Named ops_tickets_priority_rank(ops_tickets) so PostgREST exposes it as
-- a virtual column "priority_rank" that can be used in ORDER BY.

CREATE OR REPLACE FUNCTION public.ops_tickets_priority_rank(public.ops_tickets)
RETURNS integer AS $$
  SELECT CASE $1.priority
    WHEN 'urgent' THEN 0
    WHEN 'high'   THEN 1
    WHEN 'medium' THEN 2
    ELSE                3
  END;
$$ LANGUAGE sql STABLE;
