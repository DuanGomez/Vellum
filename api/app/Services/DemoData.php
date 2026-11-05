<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\Business;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Negocios de demostración con un mes de historia y dos semanas de agenda.
 * Se pueden regenerar cuando sea (comando «php artisan vellum:demo»).
 */
class DemoData
{
    private const CLIENTS = [
        'Andrés Restrepo', 'Valentina Ospina', 'Santiago Gómez', 'Mariana Zapata', 'Juan Pablo Arango', 'Laura Cardona',
        'Sebastián Vélez', 'Isabella Muñoz', 'Mateo Henao', 'Daniela Giraldo', 'Camilo Echeverri', 'Sara Montoya',
        'Felipe Ríos', 'Manuela Correa', 'David Álvarez', 'Natalia Jaramillo', 'Tomás Londoño', 'Paula Mejía',
        'Esteban Duque', 'Juliana Castaño', 'Nicolás Posada', 'Antonia Betancur', 'Simón Agudelo', 'Gabriela Uribe',
        'Alejandro Toro', 'Luisa Fernanda Ramírez', 'Miguel Ángel Salazar', 'Carolina Hoyos', 'Samuel Quintero', 'Melissa Arias',
    ];

    public static function businesses(): array
    {
        return [
            [
                'slug' => 'navaja-y-oficio', 'name' => 'Navaja & Oficio', 'kind' => 'barberia',
                'tagline' => 'Barbería clásica en Laureles', 'phone' => '3001234567',
                'address' => 'Circular 4 # 70-12', 'city' => 'Medellín', 'color' => '#B4532A',
                'email' => 'demo-barberia@vellum.app',
                'team' => [['Julián Restrepo', 'Barbero fundador', '#B4532A'], ['Kevin Ramírez', 'Barbero', '#3F6C8E'], ['Brayan Ochoa', 'Barbero junior', '#6B8E3F']],
            ],
            [
                'slug' => 'estetica-alma', 'name' => 'Alma Estética', 'kind' => 'estetica',
                'tagline' => 'Cuidado facial, uñas y bienestar en El Poblado', 'phone' => '3007654321',
                'address' => 'Carrera 35 # 8A-40', 'city' => 'Medellín', 'color' => '#B0476E',
                'email' => 'demo-estetica@vellum.app',
                'team' => [['Catalina Mesa', 'Cosmetóloga', '#B0476E'], ['Yuliana Pérez', 'Manicurista', '#8E6BB0'], ['Sofía Arango', 'Esteticista', '#C98A3A']],
            ],
            [
                'slug' => 'sonrisa-clara', 'name' => 'Sonrisa Clara', 'kind' => 'odontologia',
                'tagline' => 'Odontología general y estética en Envigado', 'phone' => '3045556677',
                'address' => 'Calle 38 Sur # 43-21', 'city' => 'Envigado', 'color' => '#2C7A7B',
                'email' => 'demo-odontologia@vellum.app',
                'team' => [['Dra. Laura Villegas', 'Odontóloga general', '#2C7A7B'], ['Dr. Andrés Mejía', 'Ortodoncista', '#3D5A99']],
            ],
        ];
    }

    /** Si las demos tienen más de 20 horas, se regeneran alrededor de hoy. */
    public static function freshen(): void
    {
        $oldest = Business::where('is_demo', true)->min('created_at');
        $count = Business::where('is_demo', true)->count();
        if ($count >= count(self::businesses()) && $oldest && now()->diffInHours($oldest, true) < 20) {
            return;
        }
        Cache::lock('vellum-demo-reset', 120)->get(fn () => self::reset());
    }

    /**
     * Si las demos ya existen, se renuevan después de responder (nadie espera);
     * solo la primera vez, sin demos, se crean antes de seguir.
     */
    public static function freshenLater(): void
    {
        if (Business::where('is_demo', true)->count() < count(self::businesses())) {
            self::freshen();
            return;
        }
        app()->terminating(fn () => self::freshen());
    }

    public static function reset(): void
    {
        mt_srand(20261104);
        DB::transaction(function () {
            foreach (self::businesses() as $spec) {
                Business::where('slug', $spec['slug'])->delete(); // borra en cascada
                self::create($spec);
            }
        });
    }

    private static function create(array $spec): void
    {
        $b = Business::create(collect($spec)->only(['slug', 'name', 'kind', 'tagline', 'phone', 'address', 'city', 'color'])->all() + [
            'is_demo' => true,
            'slot_step' => $spec['kind'] === 'odontologia' ? 15 : 20,
        ]);
        User::where('email', $spec['email'])->delete();
        User::create(['name' => $spec['team'][0][0], 'email' => $spec['email'], 'password' => 'demo-'.$spec['kind'], 'business_id' => $b->id, 'role' => 'owner']);

        $services = [];
        foreach (Presets::services($spec['kind']) as $i => [$name, $cat, $min, $price, $desc]) {
            $services[] = $b->services()->create(['name' => $name, 'category' => $cat, 'duration' => $min, 'price' => $price, 'description' => $desc, 'position' => $i]);
        }

        $pros = [];
        foreach ($spec['team'] as $i => [$name, $title, $color]) {
            $pro = $b->professionals()->create(['name' => $name, 'title' => $title, 'color' => $color, 'position' => $i]);
            $schedule = Presets::schedule();
            if ($i === 1) { // uno descansa el lunes y trabaja el domingo en la mañana
                $schedule = array_values(array_filter($schedule, fn ($s) => $s['weekday'] !== 1));
                $schedule[] = ['weekday' => 7, 'start' => '09:00', 'end' => '13:00'];
            }
            $pro->schedules()->createMany($schedule);
            // Cada quien hace casi todo; el junior no hace afeitado ni el ortodoncista blanqueamiento
            $ids = collect($services)->pluck('id');
            if ($i === 2 || ($spec['kind'] === 'odontologia' && $i === 1)) {
                $ids = $ids->reject(fn ($id, $k) => $k === 3);
            }
            $pro->services()->sync($ids);
            $pros[] = $pro->load('schedules', 'services');
        }

        $clients = collect(self::CLIENTS)->shuffle()->take(24)->values()->map(fn ($name, $k) => $b->clients()->create([
            'name' => $name,
            'phone' => '57300'.str_pad((string) (1000000 + $k * 7919 + $b->id * 131), 7, '0', STR_PAD_LEFT),
            'created_at' => now()->subDays(mt_rand(1, 60)),
        ]));

        // Un descanso de ejemplo: cita médica del segundo profesional pasado mañana
        $soon = Availability::now()->addDays(2)->setTime(10, 0);
        $pros[1]->timeOffs()->create(['starts_at' => $soon->format('Y-m-d H:i:s'), 'ends_at' => $soon->addHours(2)->format('Y-m-d H:i:s'), 'reason' => 'Cita médica']);

        $now = Availability::now();
        $rows = [];
        $stamp = now();
        for ($offset = -30; $offset <= 14; $offset++) {
            $day = $now->startOfDay()->addDays($offset);
            foreach ($pros as $pro) {
                foreach ($pro->schedules->where('weekday', $day->dayOfWeekIso) as $range) {
                    $t = $day->setTimeFromTimeString($range->start);
                    $end = $day->setTimeFromTimeString($range->end);
                    // Más lleno lo pasado y lo cercano; la semana siguiente con huecos
                    $fill = $offset < 0 ? 0.72 : ($offset <= 2 ? 0.6 : 0.35);
                    while ($t->lt($end)) {
                        $service = $pro->services->random();
                        $tEnd = $t->addMinutes($service->duration);
                        if ($tEnd->gt($end)) {
                            break;
                        }
                        if (mt_rand(0, 100) / 100 < $fill) {
                            $isPast = $tEnd->lt($now);
                            $roll = mt_rand(1, 100);
                            $status = $isPast ? ($roll <= 6 ? 'no_asistio' : ($roll <= 12 ? 'cancelada' : 'atendida')) : ($roll <= 5 ? 'cancelada' : 'confirmada');
                            $rows[] = [
                                'code' => strtoupper(Str::random(8)),
                                'business_id' => $b->id,
                                'professional_id' => $pro->id,
                                'service_id' => $service->id,
                                'client_id' => $clients->random()->id,
                                'starts_at' => $t->format('Y-m-d H:i:s'),
                                'ends_at' => $tEnd->format('Y-m-d H:i:s'),
                                'status' => $status,
                                'price' => $service->price,
                                'source' => mt_rand(1, 100) <= 64 ? 'online' : 'panel',
                                'reminder_sent_at' => $isPast ? $t->subDay()->utc()->format('Y-m-d H:i:s') : null,
                                'notes' => null,
                                'created_at' => $stamp,
                                'updated_at' => $stamp,
                            ];
                            $t = $tEnd;
                        } else {
                            $t = $t->addMinutes($b->slot_step * (mt_rand(1, 3)));
                        }
                        // Redondear a la cuadrícula del negocio
                        $m = (int) $t->format('i') % $b->slot_step;
                        if ($m) {
                            $t = $t->addMinutes($b->slot_step - $m);
                        }
                    }
                }
            }
        }
        foreach (array_chunk($rows, 300) as $chunk) {
            Appointment::insert($chunk);
        }
    }
}
