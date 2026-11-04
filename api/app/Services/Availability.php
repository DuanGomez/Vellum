<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\Business;
use App\Models\Professional;
use App\Models\Service;
use App\Models\TimeOff;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Calcula las horas libres para un servicio: cruza el horario semanal de cada
 * profesional con sus ausencias, las citas ya tomadas, la duración del servicio
 * y la anticipación mínima del negocio.
 */
class Availability
{
    public const TZ = 'America/Bogota';

    public static function now(): CarbonImmutable
    {
        return CarbonImmutable::now(self::TZ);
    }

    public static function local($value): CarbonImmutable
    {
        return CarbonImmutable::parse(
            $value instanceof \DateTimeInterface ? $value->format('Y-m-d H:i:s') : $value,
            self::TZ
        );
    }

    /** Profesionales activos que hacen el servicio (o uno en particular). */
    public static function candidates(Business $business, Service $service, ?int $professionalId = null): Collection
    {
        return $business->professionals()
            ->where('active', true)
            ->whereHas('services', fn ($q) => $q->where('services.id', $service->id))
            ->when($professionalId, fn ($q) => $q->where('professionals.id', $professionalId))
            ->with('schedules')
            ->get();
    }

    /**
     * Horas libres de un día: [['time' => '09:30', 'professionals' => [1, 3]], ...]
     */
    public static function slots(Business $business, Service $service, string $date, ?int $professionalId = null, ?int $ignoreAppointment = null): array
    {
        $day = CarbonImmutable::parse($date, self::TZ)->startOfDay();
        $now = self::now();
        if ($day->lt($now->startOfDay()) || $day->gt($now->startOfDay()->addDays($business->max_days))) {
            return [];
        }
        $earliest = $now->addMinutes($business->min_notice);
        $pros = self::candidates($business, $service, $professionalId);
        if ($pros->isEmpty()) {
            return [];
        }

        $busy = self::busy($pros->pluck('id')->all(), $day, $day->endOfDay(), $ignoreAppointment);
        $step = max(5, (int) $business->slot_step);
        $duration = (int) $service->duration;
        $byTime = [];

        foreach ($pros as $pro) {
            foreach ($pro->schedules->where('weekday', $day->dayOfWeekIso) as $range) {
                $start = $day->setTimeFromTimeString($range->start);
                $end = $day->setTimeFromTimeString($range->end);
                for ($t = $start; $t->addMinutes($duration)->lte($end); $t = $t->addMinutes($step)) {
                    if ($t->lt($earliest)) {
                        continue;
                    }
                    if (self::overlaps($busy[$pro->id] ?? [], $t, $t->addMinutes($duration))) {
                        continue;
                    }
                    $byTime[$t->format('H:i')][] = $pro->id;
                }
            }
        }
        ksort($byTime);

        $out = [];
        foreach ($byTime as $time => $ids) {
            $out[] = ['time' => $time, 'professionals' => array_values(array_unique($ids))];
        }

        return $out;
    }

    /** Días con al menos una hora libre en un rango (para pintar el calendario). */
    public static function openDays(Business $business, Service $service, string $from, int $days, ?int $professionalId = null): array
    {
        $out = [];
        $start = CarbonImmutable::parse($from, self::TZ);
        for ($i = 0; $i < $days; $i++) {
            $d = $start->addDays($i)->format('Y-m-d');
            $out[$d] = count(self::slots($business, $service, $d, $professionalId)) > 0;
        }

        return $out;
    }

    /** ¿Está libre ese profesional en ese tramo? (para validar una reserva) */
    public static function isFree(Professional $pro, CarbonImmutable $start, CarbonImmutable $end, ?int $ignoreAppointment = null): bool
    {
        $busy = self::busy([$pro->id], $start->startOfDay(), $end->endOfDay(), $ignoreAppointment);

        return ! self::overlaps($busy[$pro->id] ?? [], $start, $end);
    }

    /** ¿Ese tramo cae dentro del horario semanal del profesional? */
    public static function withinSchedule(Professional $pro, CarbonImmutable $start, CarbonImmutable $end): bool
    {
        foreach ($pro->schedules()->where('weekday', $start->dayOfWeekIso)->get() as $range) {
            $rs = $start->setTimeFromTimeString($range->start);
            $re = $start->setTimeFromTimeString($range->end);
            if ($start->gte($rs) && $end->lte($re)) {
                return true;
            }
        }

        return false;
    }

    /** Tramos ocupados por profesional (citas vigentes y ausencias). */
    private static function busy(array $proIds, CarbonImmutable $from, CarbonImmutable $to, ?int $ignore): array
    {
        $out = [];
        $f = $from->format('Y-m-d H:i:s');
        $t = $to->format('Y-m-d H:i:s');
        $rows = Appointment::query()
            ->whereIn('professional_id', $proIds)
            ->where('status', '!=', 'cancelada')
            ->when($ignore, fn ($q) => $q->where('id', '!=', $ignore))
            ->where('starts_at', '<', $t)
            ->where('ends_at', '>', $f)
            ->get(['professional_id', 'starts_at', 'ends_at'])
            ->concat(
                TimeOff::query()
                    ->whereIn('professional_id', $proIds)
                    ->where('starts_at', '<', $t)
                    ->where('ends_at', '>', $f)
                    ->get(['professional_id', 'starts_at', 'ends_at'])
            );
        foreach ($rows as $r) {
            $out[$r->professional_id][] = [self::local($r->starts_at), self::local($r->ends_at)];
        }

        return $out;
    }

    private static function overlaps(array $ranges, CarbonImmutable $start, CarbonImmutable $end): bool
    {
        foreach ($ranges as [$s, $e]) {
            if ($start->lt($e) && $end->gt($s)) {
                return true;
            }
        }

        return false;
    }
}
