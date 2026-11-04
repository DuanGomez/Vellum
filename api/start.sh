#!/bin/sh
# Arranque en Render: prepara Laravel, migra la base y sirve la API.
set -e

# Render genera APP_KEY en base64 sin el prefijo que espera Laravel
case "$APP_KEY" in
  base64:*) ;;
  *) export APP_KEY="base64:$APP_KEY" ;;
esac

php artisan package:discover --ansi
php artisan config:cache
php artisan route:cache
php artisan migrate --force
php artisan vellum:boot

exec frankenphp php-server --listen ":${PORT:-8080}" --root public/
