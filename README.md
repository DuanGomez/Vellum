# Vellum

**Agenda de citas para barberías, centros de estética y consultorios odontológicos.**

Los clientes reservan solos desde una página propia del negocio, cada profesional tiene su horario y sus ausencias, y el negocio recuerda las citas por WhatsApp.

- App: https://vellum-citas.pages.dev
- Demos: barbería, estética y odontología (botón «Probar la demo»; se regeneran solas cada día)

## Qué hace

- **Página de reservas pública** (`/reservar/<negocio>`): servicio → profesional (o «cualquiera») → día → hora libre → datos. Confirmación con código, archivo de calendario y mensaje de WhatsApp al negocio. El cliente puede cancelar desde `/cita/<código>`.
- **Disponibilidad real** calculada en el servidor: horario semanal por profesional con varios tramos por día, ausencias, duración del servicio, citas tomadas, anticipación mínima y días máximos. Una hora no se puede reservar dos veces.
- **Panel del negocio**
  - Agenda del día con una columna por profesional, línea de la hora actual y clic en un hueco para agendar; vista de semana.
  - Citas: crear, mover, marcar atendida / no asistió / cancelada, notas internas.
  - Recordatorios: las citas de mañana con el mensaje listo para enviar por WhatsApp con un toque; envío automático opcional con la API oficial de WhatsApp Cloud.
  - Clientes con historial y notas, servicios, equipo con horarios y ausencias, reportes (ingresos, inasistencia, servicios y horas más pedidas) y ajustes con enlace y QR para compartir.

## Tecnología

| Parte | Tecnología |
|---|---|
| Frontend (`web/`) | Angular 22 (componentes standalone y signals), SCSS |
| API (`api/`) | PHP 8.4 · Laravel 13 · Sanctum (tokens) |
| Base de datos | PostgreSQL (Neon) · SQLite en desarrollo |
| Despliegue | Cloudflare Pages (frontend) · Render con Docker + FrankenPHP (API) |

## Desarrollo local

```bash
# API (http://127.0.0.1:8010)
cd api
composer install
cp .env.example .env && php artisan key:generate
php artisan migrate --seed      # crea las tres demos
php artisan serve --port=8010

# Frontend (http://localhost:4310)
cd web
npm install
npx ng serve --port 4310
```

## Despliegue

1. **Base de datos:** crea una base en [Neon](https://neon.tech) y copia la cadena de conexión.
2. **API:** en Render → *New → Blueprint*, elige este repositorio y pega la cadena en `DB_URL`. Al arrancar migra la base y crea las demos.
3. **Frontend:** `cd web && npx ng build && npx wrangler pages deploy dist/web/browser --project-name vellum-citas`.

### Recordatorios automáticos (opcional)

Con una cuenta de WhatsApp Business en Meta, agrega en Render `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` y `WHATSAPP_TEMPLATE` (plantilla aprobada con 5 variables: cliente, servicio, negocio, fecha y hora). El workflow `recordatorios.yml` llama cada hora a `POST /api/cron/reminders` con la clave `CRON_KEY`.

---

Hecho por [Duan Gómez](https://duangomez.pages.dev) · [Dcodea](https://dcodea.pages.dev)
