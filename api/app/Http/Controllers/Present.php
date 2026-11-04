<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\Business;
use App\Models\Professional;
use App\Models\Service;
use App\Services\Availability;
use App\Services\WhatsApp;

/** Cómo se ve cada cosa en las respuestas JSON. */
class Present
{
    public static function business(Business $b, bool $private = false): array
    {
        $out = [
            'id' => $b->id,
            'slug' => $b->slug,
            'name' => $b->name,
            'kind' => $b->kind,
            'tagline' => $b->tagline,
            'phone' => $b->phone,
            'address' => $b->address,
            'city' => $b->city,
            'color' => $b->color,
            'slot_step' => $b->slot_step,
            'min_notice' => $b->min_notice,
            'max_days' => $b->max_days,
            'is_demo' => $b->is_demo,
        ];
        if ($private) {
            $out += [
                'reminder_hours' => $b->reminder_hours,
                'reminder_template' => $b->reminderTemplate(),
                'whatsapp_auto' => WhatsApp::autoEnabled(),
            ];
        }

        return $out;
    }

    public static function service(Service $s): array
    {
        return [
            'id' => $s->id,
            'name' => $s->name,
            'category' => $s->category,
            'description' => $s->description,
            'duration' => $s->duration,
            'price' => $s->price,
            'active' => $s->active,
            'professionals' => $s->relationLoaded('professionals') ? $s->professionals->pluck('id') : null,
        ];
    }

    public static function professional(Professional $p, bool $full = false): array
    {
        $out = [
            'id' => $p->id,
            'name' => $p->name,
            'title' => $p->title,
            'color' => $p->color,
            'photo_url' => $p->photo_url,
            'active' => $p->active,
            'services' => $p->relationLoaded('services') ? $p->services->pluck('id') : null,
        ];
        if ($full) {
            $out['schedules'] = $p->schedules->map(fn ($s) => ['weekday' => $s->weekday, 'start' => $s->start, 'end' => $s->end])->values();
            $out['time_offs'] = $p->timeOffs()
                ->where('ends_at', '>=', Availability::now()->startOfDay()->format('Y-m-d H:i:s'))
                ->orderBy('starts_at')
                ->get()
                ->map(fn ($t) => ['id' => $t->id, 'starts_at' => $t->starts_at->format('Y-m-d H:i'), 'ends_at' => $t->ends_at->format('Y-m-d H:i'), 'reason' => $t->reason]);
        }

        return $out;
    }

    public static function appointment(Appointment $a, bool $private = true): array
    {
        $a->loadMissing('client', 'service', 'professional', 'business');
        $out = [
            'id' => $a->id,
            'code' => $a->code,
            'starts_at' => $a->starts_at->format('Y-m-d H:i'),
            'ends_at' => $a->ends_at->format('Y-m-d H:i'),
            'status' => $a->status,
            'price' => $a->price,
            'service' => ['id' => $a->service->id, 'name' => $a->service->name, 'duration' => $a->service->duration],
            'professional' => ['id' => $a->professional->id, 'name' => $a->professional->name, 'color' => $a->professional->color],
            'client' => ['id' => $a->client->id, 'name' => $a->client->name],
        ];
        if ($private) {
            $out['client'] += ['phone' => $a->client->phone, 'email' => $a->client->email];
            $out += [
                'notes' => $a->notes,
                'source' => $a->source,
                'reminder_sent_at' => $a->reminder_sent_at?->toIso8601String(),
                'reminder_link' => WhatsApp::link($a->client->phone, WhatsApp::reminderText($a)),
            ];
        } else {
            $out['business'] = self::business($a->business);
        }

        return $out;
    }
}
