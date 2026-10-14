#!/usr/bin/env bash
# Strait Systems service map checker.
# Requests each product's public site in turn, one every 5 s (so each product every 15 s),
# and rewrites $OUT/status.json atomically after every check. Served at /status/status.json.
# Add a product: one line in PRODUCTS (id must match the id in the site's PRODUCTS list).
set -u
OUT=${OUT:-/srv/strait-status}
GAP=${GAP:-5}
PRODUCTS=(
  "hb https://headerbench.com"
  "ra https://rashomonpricer.com"
  "rs https://renovshield.fr"
)
mkdir -p "$OUT"
declare -A OK MS AT
utc(){ date -u +%Y-%m-%dT%H:%M:%SZ; }
while true; do
  for entry in "${PRODUCTS[@]}"; do
    id=${entry%% *}; url=${entry#* }
    r=$(curl -s -o /dev/null -A "StraitStatus/1.0 (+https://straitsystems.com)" \
          -w '%{http_code} %{time_total}' --max-time 10 "$url" 2>/dev/null) || true
    code=${r%% *}; t=${r#* }
    [[ ${code:-000} =~ ^[23][0-9][0-9]$ ]] && OK[$id]=true || OK[$id]=false
    MS[$id]=$(awk -v t="${t:-0}" 'BEGIN{printf "%d", t*1000+0.5}')
    AT[$id]=$(utc)
    body=""
    for e in "${PRODUCTS[@]}"; do k=${e%% *}; [[ -n ${OK[$k]:-} ]] || continue
      body+=$(printf '"%s":{"ok":%s,"ms":%s,"checked":"%s"},' "$k" "${OK[$k]}" "${MS[$k]}" "${AT[$k]}"); done
    printf '{"now":"%s","every":15,"products":{%s}}\n' "$(utc)" "${body%,}" > "$OUT/.status.tmp" \
      && chmod 644 "$OUT/.status.tmp" && mv -f "$OUT/.status.tmp" "$OUT/status.json"
    sleep "$GAP"
  done
done
