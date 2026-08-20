#!/bin/sh
# Actualiza la IP pública en DuckDNS. Requiere DUCKDNS_DOMAIN y DUCKDNS_TOKEN.
set -eu
. /opt/elhoss/deploy/.env
if [ -z "${DUCKDNS_DOMAIN:-}" ] || [ -z "${DUCKDNS_TOKEN:-}" ]; then
  echo "Falta DUCKDNS_DOMAIN o DUCKDNS_TOKEN"
  exit 1
fi
curl -fsS "https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&ip="
echo
