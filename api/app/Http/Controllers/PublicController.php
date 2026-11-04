<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\Business;
use App\Models\Client;
use App\Models\Service;
use App\Services\Availability;
use App\Services\DemoData;
use App\Services\WhatsApp;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Página de reservas: lo que ve el cliente final, sin iniciar sesión. */
class PublicController extends Controller
{
    private function business(string $slug): Business
    {
        return Business::where('slug', $slug)->firstOrFail();
    }

    public function show(string $slug)
    {
        $b = $this->business($slug);
        if ($b->is_demo) {
            DemoData::freshen();
            $b = $this->business($slug);
        }

        return [
            'business' => Present::business($b),
            'services' => $b->services()->where('active', true)
                ->whereHas('professionals', fn ($q) => $q->where('active', true))
                ->with(['professionals' => fn ($q) => $q->where('active', true)])
                ->get()->map(fn ($s) => Present::service($s)),
            'professionals' => $b->professionals()->where('active', true)->with('services')->get()
                ->map(fn ($p) => Present::professional($p)),
        ];
    }

    /** ?service=1&from=2026-11-04&days=14&professional=2 → qué días tienen cupo */
    public function days(Request $r, string $slug)
    {
        $b = $this->business($slug);
        $service = $b->services()->findOrFail($r->integer('service'));
        $days = min(42, max(1, $r->integer('days', 14)));

        return Availability::openDays($b, $service, $r->input('from', Availability::now()->format('Y-m-d')), $days, $r->integer('professional') ?: null);
    }

    /** ?service=1&date=2026-11-05&professional=2 → horas libres */
    public function slots(Request $r, string $slug)
    {
        $b = $this->business($slug);
        $service = $b->services()->findOrFail($r->integer('service'));

        return Availability::slots($b, $service, $r->input('date'), $r->integer('professional') ?: null);
    }

    public function book(Request $r, string $slug)
    {
        $b = $this->business($slug);
        $data = $r->validate([
            'service_id' => 'required|integer',
            'professional_id' => 'nullable|integer',
            'date' => 'required|date_format:Y-m-d',
            'time' => 'required|date_format:H:i',
            'name' => 'required|string|min:2|max:80',
            'phone' => 'required|string|min:7|max:20',
            'email' => 'nullable|email|max:120',
            'notes' => 'nullable|string|max:300',
        ]);
        $service = $b->services()->where('active', true)->findOrFail($data['service_id']);

        // Se vuelve a calcular en el servidor: nadie puede tomar una hora ocupada
        $slot = collect(Availability::slots($b, $service, $data['date'], $data['professional_id'] ?? null))
            ->firstWhere('time', $data['time']);
        if (! $slot) {
            return response()->json(['message' => 'Esa hora acaba de ocuparse. Elige otra, por favor.'], 409);
        }
        $professionalId = $data['professional_id'] ?? $this->leastBusy($slot['professionals'], $data['date']);

        $appointment = DB::transaction(function () use ($b, $service, $data, $professionalId) {
            $client = Client::firstOrNew(['business_id' => $b->id, 'phone' => WhatsApp::digits($data['phone'])]);
            $client->fill(['name' => $data['name']] + array_filter(['email' => $data['email'] ?? null]))->save();
            $start = Availability::local($data['date'].' '.$data['time']);

            return Appointment::create([
                'business_id' => $b->id,
                'professional_id' => $professionalId,
                'service_id' => $service->id,
                'client_id' => $client->id,
                'starts_at' => $start->format('Y-m-d H:i:s'),
                'ends_at' => $start->addMinutes($service->duration)->format('Y-m-d H:i:s'),
                'price' => $service->price,
                'notes' => $data['notes'] ?? null,
                'source' => 'online',
            ]);
        });

        return response()->json([
            'appointment' => Present::appointment($appointment, false),
            'whatsapp_link' => $b->phone ? WhatsApp::link($b->phone, WhatsApp::confirmationText($appointment)) : null,
        ], 201);
    }

    /** "Cualquiera disponible": se le asigna a quien tenga menos citas ese día. */
    private function leastBusy(array $ids, string $date): int
    {
        $counts = Appointment::whereIn('professional_id', $ids)
            ->where('status', '!=', 'cancelada')
            ->whereDate('starts_at', $date)
            ->selectRaw('professional_id, count(*) as n')
            ->groupBy('professional_id')
            ->pluck('n', 'professional_id');

        return collect($ids)->sortBy(fn ($id) => $counts[$id] ?? 0)->first();
    }

    public function appointment(string $code)
    {
        $a = Appointment::where('code', strtoupper($code))->firstOrFail();

        return Present::appointment($a, false);
    }

    public function cancel(string $code)
    {
        $a = Appointment::where('code', strtoupper($code))->firstOrFail();
        if ($a->status !== 'confirmada') {
            return response()->json(['message' => 'Esta cita ya no se puede cancelar.'], 422);
        }
        if (Availability::local($a->starts_at)->lt(Availability::now())) {
            return response()->json(['message' => 'La cita ya pasó.'], 422);
        }
        $a->update(['status' => 'cancelada']);

        return Present::appointment($a->fresh(), false);
    }
}
