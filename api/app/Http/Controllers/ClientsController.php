<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\Business;
use App\Services\Availability;
use App\Services\WhatsApp;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

/** Clientes, recordatorios por WhatsApp y reportes. */
class ClientsController extends Controller
{
    private function business(Request $r): Business
    {
        return $r->user()->business;
    }

    public function index(Request $r)
    {
        $b = $this->business($r);
        $q = trim((string) $r->input('q'));
        $digits = preg_replace('/\D+/', '', $q);

        return $b->clients()
            ->when($q !== '', fn ($w) => $w->where(function ($x) use ($q, $digits) {
                $x->whereLike('name', "%$q%"); // sin distinguir mayúsculas, también en PostgreSQL
                if (strlen($digits) >= 3) {
                    $x->orWhere('phone', 'like', "%$digits%");
                }
            }))
            ->withCount(['appointments as visits' => fn ($w) => $w->where('status', 'atendida')])
            ->withCount(['appointments as no_shows' => fn ($w) => $w->where('status', 'no_asistio')])
            ->withMax('appointments as last_visit', 'starts_at')
            ->orderByRaw('last_visit is null, last_visit desc') // los que nunca vinieron, al final
            ->limit($q !== '' ? 20 : 200)
            ->get()
            ->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'phone' => $c->phone,
                'email' => $c->email,
                'notes' => $c->notes,
                'visits' => $c->visits,
                'no_shows' => $c->no_shows,
                'last_visit' => $c->last_visit ? substr((string) $c->last_visit, 0, 16) : null,
                'whatsapp' => WhatsApp::link($c->phone, 'Hola '.explode(' ', $c->name)[0].', te escribimos de '.$r->user()->business->name.'.'),
            ]);
    }

    public function show(Request $r, int $id)
    {
        $c = $this->business($r)->clients()->findOrFail($id);

        return [
            'id' => $c->id,
            'name' => $c->name,
            'phone' => $c->phone,
            'email' => $c->email,
            'notes' => $c->notes,
            'appointments' => $c->appointments()->with('service', 'professional', 'client', 'business')
                ->orderByDesc('starts_at')->limit(50)->get()->map(fn ($a) => Present::appointment($a)),
        ];
    }

    public function update(Request $r, int $id)
    {
        $c = $this->business($r)->clients()->findOrFail($id);
        $c->update($r->validate([
            'name' => 'sometimes|string|min:2|max:80',
            'email' => 'sometimes|nullable|email|max:120',
            'notes' => 'sometimes|nullable|string|max:1000',
        ]));

        return ['ok' => true];
    }

    // --- Recordatorios ----------------------------------------------------

    /** ?date=2026-11-05 (por defecto, mañana) → citas por recordar */
    public function reminders(Request $r)
    {
        $b = $this->business($r);
        $date = $r->input('date', Availability::now()->addDay()->format('Y-m-d'));
        $items = $b->appointments()->with('client', 'service', 'professional', 'business')
            ->where('status', 'confirmada')
            ->whereDate('starts_at', $date)
            ->orderBy('starts_at')
            ->get();

        return [
            'date' => $date,
            'auto' => WhatsApp::autoEnabled(),
            'items' => $items->map(fn ($a) => Present::appointment($a) + ['message' => WhatsApp::reminderText($a)]),
        ];
    }

    public function markReminded(Request $r, int $id)
    {
        $a = $this->business($r)->appointments()->findOrFail($id);
        $a->update(['reminder_sent_at' => now()]);

        return Present::appointment($a->fresh());
    }

    /**
     * Tarea programada (GitHub Actions, cada hora): envía por la API oficial los
     * recordatorios que ya entraron en la ventana de cada negocio.
     */
    public function cron(Request $r)
    {
        $key = config('services.cron_key');
        abort_unless($key && hash_equals($key, (string) $r->header('X-Cron-Key')), 403);
        if (! WhatsApp::autoEnabled()) {
            return ['sent' => 0, 'auto' => false];
        }
        $now = Availability::now();
        $sent = 0;
        Appointment::with('business', 'client', 'service', 'professional')
            ->where('status', 'confirmada')
            ->whereNull('reminder_sent_at')
            ->where('starts_at', '>', $now->format('Y-m-d H:i:s'))
            ->where('starts_at', '<', $now->addHours(72)->format('Y-m-d H:i:s'))
            ->get()
            ->filter(fn ($a) => ! $a->business->is_demo
                && Availability::local($a->starts_at)->lte($now->addHours($a->business->reminder_hours)))
            ->each(function ($a) use (&$sent) {
                if (WhatsApp::sendReminder($a)) {
                    $a->update(['reminder_sent_at' => now()]);
                    $sent++;
                }
            });

        return ['sent' => $sent, 'auto' => true];
    }

    /** Tarea programada diaria: regenera las demos alrededor de la fecha de hoy. */
    public function cronDemo(Request $r)
    {
        $key = config('services.cron_key');
        abort_unless($key && hash_equals($key, (string) $r->header('X-Cron-Key')), 403);
        \App\Services\DemoData::reset();

        return ['ok' => true];
    }

    // --- Reportes ---------------------------------------------------------

    /** ?from=2026-10-01&to=2026-10-31 */
    public function stats(Request $r)
    {
        $b = $this->business($r);
        $now = Availability::now();
        $from = CarbonImmutable::parse($r->input('from', $now->startOfMonth()->format('Y-m-d')), Availability::TZ)->startOfDay();
        $to = CarbonImmutable::parse($r->input('to', $now->format('Y-m-d')), Availability::TZ)->endOfDay();

        $rows = $b->appointments()->with('service', 'professional')
            ->where('starts_at', '>=', $from->format('Y-m-d H:i:s'))
            ->where('starts_at', '<=', $to->format('Y-m-d H:i:s'))
            ->get();
        $valid = $rows->where('status', '!=', 'cancelada');
        $done = $rows->where('status', 'atendida');
        $past = $valid->filter(fn ($a) => Availability::local($a->starts_at)->lt($now));
        $noShow = $rows->where('status', 'no_asistio')->count();

        $byDay = [];
        for ($d = $from; $d->lte($to); $d = $d->addDay()) {
            $byDay[$d->format('Y-m-d')] = ['date' => $d->format('Y-m-d'), 'appointments' => 0, 'revenue' => 0];
        }
        foreach ($valid as $a) {
            $k = $a->starts_at->format('Y-m-d');
            if (isset($byDay[$k])) {
                $byDay[$k]['appointments']++;
                if ($a->status === 'atendida') {
                    $byDay[$k]['revenue'] += $a->price;
                }
            }
        }

        $group = fn ($key, $name) => $valid->groupBy($key)->map(fn ($g) => [
            'name' => $name($g->first()),
            'appointments' => $g->count(),
            'revenue' => $g->where('status', 'atendida')->sum('price'),
        ])->sortByDesc('appointments')->values();

        $hours = $valid->groupBy(fn ($a) => (int) $a->starts_at->format('G'))->map->count()->sortKeys();

        return [
            'from' => $from->format('Y-m-d'),
            'to' => $to->format('Y-m-d'),
            'appointments' => $valid->count(),
            'attended' => $done->count(),
            'revenue' => $done->sum('price'),
            'average_ticket' => $done->count() ? (int) round($done->avg('price')) : 0,
            'no_show_rate' => $past->count() ? round($noShow / $past->count() * 100, 1) : 0,
            'cancelled' => $rows->where('status', 'cancelada')->count(),
            'online_share' => $valid->count() ? round($valid->where('source', 'online')->count() / $valid->count() * 100) : 0,
            'new_clients' => $b->clients()->whereBetween('created_at', [$from->utc(), $to->utc()])->count(),
            'by_day' => array_values($byDay),
            'by_professional' => $group('professional_id', fn ($a) => $a->professional->name),
            'by_service' => $group('service_id', fn ($a) => $a->service->name),
            'by_hour' => $hours->map(fn ($n, $h) => ['hour' => $h, 'appointments' => $n])->values(),
        ];
    }
}
