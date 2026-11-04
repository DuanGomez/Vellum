<?php

namespace App\Services;

use App\Models\Appointment;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Http;

/**
 * Mensajes por WhatsApp.
 *  - Siempre: enlaces wa.me con el mensaje listo (el negocio lo envía con un toque).
 *  - Opcional: envío automático con la API oficial de WhatsApp Cloud si están
 *    WHATSAPP_TOKEN y WHATSAPP_PHONE_ID (y WHATSAPP_TEMPLATE para los mensajes
 *    que inicia el negocio, como exige Meta).
 */
class WhatsApp
{
    private const DAYS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

    private const MONTHS = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    /** Número en formato internacional sin signos (Colombia por defecto). */
    public static function digits(?string $phone): string
    {
        $d = preg_replace('/\D+/', '', (string) $phone);
        if (strlen($d) === 10 && str_starts_with($d, '3')) {
            $d = '57'.$d;
        }

        return $d;
    }

    public static function link(?string $phone, string $text): string
    {
        return 'https://wa.me/'.self::digits($phone).'?text='.rawurlencode($text);
    }

    public static function dateLabel(CarbonImmutable $d): string
    {
        return self::DAYS[$d->dayOfWeekIso].' '.$d->day.' de '.self::MONTHS[$d->month];
    }

    public static function hourLabel(CarbonImmutable $d): string
    {
        return $d->format('g:i').' '.($d->hour < 12 ? 'a. m.' : 'p. m.');
    }

    private static function vars(Appointment $a): array
    {
        $a->loadMissing('business', 'client', 'service', 'professional');
        $start = Availability::local($a->starts_at);
        $first = explode(' ', trim($a->client->name))[0] ?: $a->client->name;

        return [
            '{cliente}' => $first,
            '{servicio}' => $a->service->name,
            '{negocio}' => $a->business->name,
            '{fecha}' => self::dateLabel($start),
            '{hora}' => self::hourLabel($start),
            '{profesional}' => $a->professional->name,
        ];
    }

    /** Mensaje de recordatorio con la plantilla del negocio. */
    public static function reminderText(Appointment $a): string
    {
        return strtr($a->business->reminderTemplate(), self::vars($a));
    }

    /** Mensaje que el cliente le manda al negocio al reservar. */
    public static function confirmationText(Appointment $a): string
    {
        $v = self::vars($a);

        return "Hola {$v['{negocio}']}, acabo de reservar {$v['{servicio}']} con {$v['{profesional}']} el {$v['{fecha}']} a las {$v['{hora}']}. "
            ."Mi nombre es {$a->client->name}. Código de la cita: {$a->code}.";
    }

    public static function autoEnabled(): bool
    {
        return (bool) config('services.whatsapp.token') && (bool) config('services.whatsapp.phone_id');
    }

    /** Envía el recordatorio por la API oficial. Devuelve true si Meta lo aceptó. */
    public static function sendReminder(Appointment $a): bool
    {
        if (! self::autoEnabled()) {
            return false;
        }
        $v = self::vars($a);
        $payload = ['messaging_product' => 'whatsapp', 'to' => self::digits($a->client->phone)];
        $template = config('services.whatsapp.template');
        if ($template) {
            $params = [$v['{cliente}'], $v['{servicio}'], $v['{negocio}'], $v['{fecha}'], $v['{hora}']];
            $payload += ['type' => 'template', 'template' => [
                'name' => $template,
                'language' => ['code' => 'es'],
                'components' => [[
                    'type' => 'body',
                    'parameters' => array_map(fn ($x) => ['type' => 'text', 'text' => $x], $params),
                ]],
            ]];
        } else {
            $payload += ['type' => 'text', 'text' => ['body' => self::reminderText($a)]];
        }

        return Http::withToken(config('services.whatsapp.token'))
            ->timeout(15)
            ->post('https://graph.facebook.com/v21.0/'.config('services.whatsapp.phone_id').'/messages', $payload)
            ->successful();
    }
}
