# API de Vellum (Laravel) servida con FrankenPHP. Render pone el puerto en $PORT.
FROM dunglas/frankenphp:1-php8.4

RUN install-php-extensions pdo_pgsql intl zip opcache pcntl

# El binario trae la capacidad de usar puertos bajos (setcap) y Render no la
# permite («Operation not permitted»). Copiarlo la quita; usamos $PORT (alto).
RUN cp /usr/local/bin/frankenphp /tmp/frankenphp \
    && mv /tmp/frankenphp /usr/local/bin/frankenphp \
    && chmod 755 /usr/local/bin/frankenphp

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

COPY . .
RUN composer dump-autoload --optimize --no-dev \
    && mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    DB_CONNECTION=pgsql

CMD ["sh", "start.sh"]
