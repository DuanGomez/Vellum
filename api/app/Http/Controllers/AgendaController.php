<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\Business;
use App\Models\Client;
use App\Services\Availability;
use App\Services\WhatsApp;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Agenda del negocio: ver, crear, mover y cambiar el estado de las citas. */
class AgendaController extends Controller
{
    private function business(Request $r): Business
    {
        return $r->user()->business;
    }

    /** ?date=2026-11-04&days=1|7 → profesionales con horario y citas de esos días */
    public function index(Request $r)
    {
        $b = $this->business($r);
        $from = Availability::local($r->input('date', Availability::now()->format('Y-m-d')))->startOfDay();
        $days = min(31, max(1, $r->integer('days', 1)));
        $to = $from->addDays($days);

        $appointments = $b->appointments()
            ->with('client', 'service', 'professional')
            ->where('starts_at', '>=', $from->format('Y-m-d H:i:s'))
            ->where('starts_at', '<', $to->format('Y-m-d H:i:s'))
            ->orderBy('starts_at')
            ->get();

        $offs = \App\Models\TimeOff::whereIn('professional_id', $b->professionals()->pluck('id'))
            ->where('starts_at', '<', $to->format('Y-m-d H:i:s'))
            ->where('ends_at', '>', $from->format('Y-m-d H:i:s'))
            ->get();

        return [
            'from' => $from->format('Y-m-d'),
            'days' => $days,
            'professionals' => $b->professionals()->where('active', true)->with('schedules', 'services')->get()
                ->map(fn ($p) => Present::professional($p) + [
                    'schedules' => $p->schedules->map(fn ($s) => ['weekday' => $s->weekday, 'start' => $s->start, 'end' => $s->end])->values(),
                ]),
            'appointments' => $appointments->map(fn ($a) => Present::appointment($a)),
            'time_offs' => $offs->map(fn ($t) => [
                'id' => $t->id,
                'professional_id' => $t->professional_id,
                'starts_at' => $t->starts_at->format('Y-m-d H:i'),
                'ends_at' => $t->ends_at->format('Y-m-d H:i'),
                'reason' => $t->reason,
            ]),
            'summary' => [
                'total' => $appointments->where('status', '!=', 'cancelada')->count(),
                'attended' => $appointments->where('status', 'atendida')->count(),
                'expected' => $appointments->whereIn('status', ['confirmada', 'atendida'])->sum('price'),
            ],
        ];
    }

    /** Horas libres desde el panel (mismas reglas, pero sin anticipación mínima). */
    public function slots(Request $r)
    {
        $b = $this->business($r);
        $service = $b->services()->findOrFail($r->integer('service'));
        $b->min_notice = 0;

        return Availability::slots($b, $service, $r->input('date'), $r->integer('professional') ?: null, $r->integer('ignore') ?: null);
    }

    public function store(Request $r)
    {
        $b = $this->business($r);
        $data = $r->validate([
            'service_id' => ['required', Rule::exists('services', 'id')->where('business_id', $b->id)],
            'professional_id' => ['required', Rule::exists('professionals', 'id')->where('business_id', $b->id)],
            'date' => 'required|date_format:Y-m-d',
            'time' => 'required|date_format:H:i',
            'client_id' => ['nullable', Rule::exists('clients', 'id')->where('business_id', $b->id)],
            'name' => 'required_without:client_id|nullable|string|max:80',
            'phone' => 'required_without:client_id|nullable|string|max:20',
            'notes' => 'nullable|string|max:300',
            'force' => 'boolean',
        ]);
        $service = $b->services()->findOrFail($data['service_id']);
        $pro = $b->professionals()->findOrFail($data['professional_id']);
        $start = Availability::local($data['date'].' '.$data['time']);
        $end = $start->addMinutes($service->duration);

        if (! Availability::isFree($pro, $start, $end)) {
            return response()->json(['message' => "{$pro->name} ya tiene una cita o un bloqueo en ese horario."], 409);
        }
        if (! ($data['force'] ?? false) && ! Availability::withinSchedule($pro, $start, $end)) {
            return response()->json(['message' => 'Está fuera del horario de '.$pro->name.'.', 'can_force' => true], 409);
        }

        $client = isset($data['client_id'])
            ? Client::find($data['client_id'])
            : Client::firstOrCreate(
                ['business_id' => $b->id, 'phone' => WhatsApp::digits($data['phone'])],
                ['name' => $data['name']]
            );

        $a = Appointment::create([
            'business_id' => $b->id,
            'professional_id' => $pro->id,
            'service_id' => $service->id,
            'client_id' => $client->id,
            'starts_at' => $start->format('Y-m-d H:i:s'),
            'ends_at' => $end->format('Y-m-d H:i:s'),
            'price' => $service->price,
            'notes' => $data['notes'] ?? null,
            'source' => 'panel',
        ]);

        return response()->json(Present::appointment($a), 201);
    }

    public function update(Request $r, int $id)
    {
        $b = $this->business($r);
        $a = $b->appointments()->findOrFail($id);
        $data = $r->validate([
            'status' => ['sometimes', Rule::in(Appointment::STATUSES)],
            'notes' => 'sometimes|nullable|string|max:300',
            'price' => 'sometimes|integer|min:0',
            'date' => 'sometimes|date_format:Y-m-d',
            'time' => 'required_with:date|date_format:H:i',
            'professional_id' => ['sometimes', Rule::exists('professionals', 'id')->where('business_id', $b->id)],
            'force' => 'boolean',
        ]);

        // Mover de hora o de profesional
        if (isset($data['date']) || isset($data['professional_id'])) {
            $pro = $b->professionals()->findOrFail($data['professional_id'] ?? $a->professional_id);
            $start = isset($data['date']) ? Availability::local($data['date'].' '.$data['time']) : Availability::local($a->starts_at);
            $end = $start->addMinutes($a->service->duration);
            if (! Availability::isFree($pro, $start, $end, $a->id)) {
                return response()->json(['message' => "{$pro->name} ya está ocupado en ese horario."], 409);
            }
            if (! ($data['force'] ?? false) && ! Availability::withinSchedule($pro, $start, $end)) {
                return response()->json(['message' => 'Está fuera del horario de '.$pro->name.'.', 'can_force' => true], 409);
            }
            $a->fill([
                'professional_id' => $pro->id,
                'starts_at' => $start->format('Y-m-d H:i:s'),
                'ends_at' => $end->format('Y-m-d H:i:s'),
                'reminder_sent_at' => null,
            ]);
        }
        $a->fill(collect($data)->only(['status', 'notes', 'price'])->all())->save();

        return Present::appointment($a->fresh());
    }

    public function destroy(Request $r, int $id)
    {
        $this->business($r)->appointments()->findOrFail($id)->delete();

        return response()->noContent();
    }
}
