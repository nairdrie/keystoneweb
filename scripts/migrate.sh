#!/usr/bin/env bash
# Applies pending SQL migrations from migrations/ to the database in $DATABASE_URL.
#
# Usage:  DATABASE_URL=postgres://... scripts/migrate.sh [apply|dry-run|baseline]
#
#   apply     (default) run every migration not yet recorded in public.schema_migrations
#   dry-run   list what apply would run; changes nothing
#   baseline  record every migration file as applied WITHOUT running it.
#             One-time setup for a DB whose schema is already up to date.
#
# Rules:
#   - Only files named NNN_name.sql are migrations (schema.sql, template_metadata_*.sql
#     etc. are ignored). Order is plain filename sort; duplicate numbers are fine
#     because the full filename is the key.
#   - Each migration runs in one transaction together with its tracking row, so it
#     either fully applies or not at all. Don't put BEGIN/COMMIT in the file.
#   - For statements that can't run in a transaction (CREATE INDEX CONCURRENTLY, ...),
#     put `-- migrate:no-transaction` in the first 5 lines of the file.
#   - Never edit a migration after it has run; add a new one. Edited files are
#     reported as a checksum warning, not re-run.
#   - Stops at the first failure. Later migrations are not attempted.

set -euo pipefail

MODE="${1:-apply}"
DB_URL="${DATABASE_URL:?DATABASE_URL is not set}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-migrations}"
# Fail fast instead of queueing behind long-running queries (a waiting ALTER TABLE
# blocks every read of that table). A failed run is safe to re-run.
LOCK_TIMEOUT="${MIGRATE_LOCK_TIMEOUT:-15s}"

case "$MODE" in apply|dry-run|baseline) ;; *)
  echo "Unknown mode '$MODE' (expected apply, dry-run or baseline)" >&2; exit 2 ;;
esac

clean() { printf '%s' "$1" | tr -cd 'A-Za-z0-9._@-'; }
APPLIED_BY="$(clean "${GITHUB_ACTOR:-$(whoami 2>/dev/null || echo unknown)}")"
GIT_SHA="$(clean "${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}")"

psql_q() { psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -At "$@"; }

summary() {
  echo "$1"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then echo "$1" >> "$GITHUB_STEP_SUMMARY"; fi
}

# --- Tracking table -----------------------------------------------------------
# Lives in public so the nightly prod -> staging sync copies it along with the
# schema it describes. RLS on with no policies + revoked grants keeps it off the
# Supabase API.
ensure_table() {
  psql_q <<'SQL'
SET client_min_messages = warning;
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename   text PRIMARY KEY,
  checksum   text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by text NOT NULL,
  git_sha    text
);
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON public.schema_migrations FROM %I', r);
    END IF;
  END LOOP;
END $$;
SQL
}

if [ "$MODE" != "dry-run" ]; then
  ensure_table
fi

declare -A APPLIED=()
if [ "$(psql_q -c "SELECT to_regclass('public.schema_migrations') IS NOT NULL")" = "t" ]; then
  while IFS='|' read -r name sum; do
    [ -n "$name" ] && APPLIED["$name"]="$sum"
  done < <(psql_q -c "SELECT filename, checksum FROM public.schema_migrations")
fi

# --- Collect migration files --------------------------------------------------
PENDING=()
while IFS= read -r path; do
  name="$(basename "$path")"
  [[ "$name" =~ ^[0-9]+_[A-Za-z0-9_-]+\.sql$ ]] || continue
  sum="$(sha256sum "$path" | cut -d' ' -f1)"
  if [ -n "${APPLIED[$name]+x}" ]; then
    if [ "${APPLIED[$name]}" != "$sum" ]; then
      echo "::warning file=$path::$name changed after it was applied. It will NOT be re-run; put the change in a new migration."
    fi
  else
    PENDING+=("$path")
  fi
done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' | LC_ALL=C sort)

summary "### DB migrations ($MODE)"
summary "- Already applied: ${#APPLIED[@]}"
summary "- Pending: ${#PENDING[@]}"
for p in "${PENDING[@]}"; do summary "  - \`$(basename "$p")\`"; done

if [ "${#PENDING[@]}" -eq 0 ]; then
  summary "Nothing to do."
  exit 0
fi

if [ "$MODE" = "dry-run" ]; then
  exit 0
fi

# --- Baseline -----------------------------------------------------------------
if [ "$MODE" = "baseline" ]; then
  {
    echo "BEGIN;"
    for p in "${PENDING[@]}"; do
      name="$(basename "$p")"
      sum="$(sha256sum "$p" | cut -d' ' -f1)"
      echo "INSERT INTO public.schema_migrations (filename, checksum, applied_by, git_sha)
            VALUES ('$name', '$sum', 'baseline:$APPLIED_BY', '$GIT_SHA') ON CONFLICT DO NOTHING;"
    done
    echo "COMMIT;"
  } | psql_q
  summary "Recorded ${#PENDING[@]} migration(s) as applied without running them."
  exit 0
fi

# --- Apply --------------------------------------------------------------------
# Guard: an empty tracking table almost always means "never baselined", and
# applying all ~100 historical migrations to prod would be a disaster.
if [ "${#APPLIED[@]}" -eq 0 ]; then
  echo "::error::public.schema_migrations is empty. Run this once with mode=baseline (when prod is up to date) before applying." >&2
  exit 1
fi

for p in "${PENDING[@]}"; do
  name="$(basename "$p")"
  sum="$(sha256sum "$p" | cut -d' ' -f1)"
  record="INSERT INTO public.schema_migrations (filename, checksum, applied_by, git_sha)
          VALUES ('$name', '$sum', '$APPLIED_BY', '$GIT_SHA')"

  echo "::group::Applying $name"
  if head -n 5 "$p" | grep -qi -- '-- *migrate:no-transaction'; then
    psql "$DB_URL" -X -v ON_ERROR_STOP=1 \
      -c "SET lock_timeout = '$LOCK_TIMEOUT'" -f "$p" -c "$record"
  else
    if grep -qiE '^[[:space:]]*(BEGIN|COMMIT|ROLLBACK|START[[:space:]]+TRANSACTION)[[:space:]]*;' "$p"; then
      echo "::error file=$p::$name contains BEGIN/COMMIT. The runner wraps each migration in a transaction itself; remove them (or add -- migrate:no-transaction)." >&2
      exit 1
    fi
    psql "$DB_URL" -X -v ON_ERROR_STOP=1 --single-transaction \
      -c "SET LOCAL lock_timeout = '$LOCK_TIMEOUT'" -f "$p" -c "$record"
  fi
  echo "::endgroup::"
  summary "Applied \`$name\`"
done

summary "Done: applied ${#PENDING[@]} migration(s)."
