#!/usr/bin/env bash
# Génère les secrets du catalogue dynamique dans .vercel/catalog-secrets.env (ignoré par Git, droits 600).
# N'affiche jamais les valeurs. Un jeton de flux distinct pour la Preview et pour la production.
set -euo pipefail
cd "$(dirname "$0")/.."
FILE=.vercel/catalog-secrets.env
if [ -f "$FILE" ]; then echo "$FILE existe déjà : rien n'est régénéré."; exit 0; fi
mkdir -p .vercel
umask 077
{
  echo "LISTING_FEED_TOKEN_PREVIEW=$(openssl rand -hex 32)"
  echo "LISTING_FEED_TOKEN_PRODUCTION=$(openssl rand -hex 32)"
  echo "SYNC_HMAC_SECRET=$(openssl rand -hex 32)"
  echo "LISTING_FEED_URL=https://lxkhozdshbpdjnanbnzi.supabase.co/functions/v1/listing-feed"
} > "$FILE"
git check-ignore -q "$FILE" || { echo "ERREUR : $FILE n'est pas ignoré par Git"; rm -f "$FILE"; exit 1; }
echo "Secrets générés dans $FILE (valeurs non affichées) :"
sed 's/=.*//' "$FILE"
