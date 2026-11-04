<?php

namespace App\Http\Controllers;

use App\Models\Business;
use App\Services\Presets;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Configuración del negocio: datos, servicios, equipo, horarios y ausencias. */
class SetupController extends Controller
{
    private function business(Request $r): Business
    {
        return $r->user()->business;
    }

    // --- Negocio ---------------------------------------------------------

    public function updateBusiness(Request $r)
    {
        $b = $this->business($r);
        $data = $r->validate([
            'name' => 'sometimes|string|min:2|max:80',
            'kind' => ['sometimes', Rule::in(Presets::KINDS)],
            'tagline' => 'sometimes|nullable|string|max:120',
            'phone' => 'sometimes|nullable|string|max:20',
            'address' => 'sometimes|nullable|string|max:160',
            'city' => 'sometimes|nullable|string|max:60',
            'color' => ['sometimes', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'slot_step' => 'sometimes|integer|in:5,10,15,20,30,60',
            'min_notice' => 'sometimes|integer|min:0|max:2880',
            'max_days' => 'sometimes|integer|min:1|max:180',
            'reminder_hours' => 'sometimes|integer|min:1|max:72',
            'reminder_template' => 'sometimes|nullable|string|max:600',
        ]);
        $b->update($data);

        return Present::business($b->fresh(), true);
    }

    // --- Servicios -------------------------------------------------------

    public function services(Request $r)
    {
        return $this->business($r)->services()->with('professionals')->get()->map(fn ($s) => Present::service($s));
    }

    private function serviceRules(): array
    {
        return [
            'name' => 'required|string|min:2|max:80',
            'category' => 'nullable|string|max:40',
            'description' => 'nullable|string|max:300',
            'duration' => 'required|integer|min:5|max:600',
            'price' => 'required|integer|min:0|max:100000000',
            'active' => 'boolean',
            'professionals' => 'array',
            'professionals.*' => 'integer',
        ];
    }

    public function storeService(Request $r)
    {
        $b = $this->business($r);
        $data = $r->validate($this->serviceRules());
        $s = $b->services()->create(collect($data)->except('professionals')->all() + ['position' => $b->services()->count()]);
        $s->professionals()->sync($b->professionals()->whereIn('id', $data['professionals'] ?? [])->pluck('id'));

        return response()->json(Present::service($s->load('professionals')), 201);
    }

    public function updateService(Request $r, int $id)
    {
        $b = $this->business($r);
        $s = $b->services()->findOrFail($id);
        $data = $r->validate($this->serviceRules());
        $s->update(collect($data)->except('professionals')->all());
        if (array_key_exists('professionals', $data)) {
            $s->professionals()->sync($b->professionals()->whereIn('id', $data['professionals'])->pluck('id'));
        }

        return Present::service($s->load('professionals'));
    }

    public function destroyService(Request $r, int $id)
    {
        $s = $this->business($r)->services()->findOrFail($id);
        // Si ya tiene citas no se borra: se desactiva para no perder el historial
        if (\App\Models\Appointment::where('service_id', $s->id)->exists()) {
            $s->update(['active' => false]);
        } else {
            $s->delete();
        }

        return response()->noContent();
    }

    // --- Equipo ----------------------------------------------------------

    public function professionals(Request $r)
    {
        return $this->business($r)->professionals()->with('services', 'schedules')->get()
            ->map(fn ($p) => Present::professional($p, true));
    }

    private function professionalRules(): array
    {
        return [
            'name' => 'required|string|min:2|max:80',
            'title' => 'nullable|string|max:60',
            'color' => ['required', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'photo_url' => 'nullable|url|max:300',
            'active' => 'boolean',
            'services' => 'array',
            'services.*' => 'integer',
            'schedules' => 'array',
            'schedules.*.weekday' => 'required|integer|min:1|max:7',
            'schedules.*.start' => 'required|date_format:H:i',
            'schedules.*.end' => 'required|date_format:H:i|after:schedules.*.start',
        ];
    }

    private function saveProfessional(Business $b, $pro, array $data)
    {
        $pro->fill(collect($data)->only(['name', 'title', 'color', 'photo_url', 'active'])->all())->save();
        if (array_key_exists('services', $data)) {
            $pro->services()->sync($b->services()->whereIn('id', $data['services'])->pluck('id'));
        }
        if (array_key_exists('schedules', $data)) {
            $pro->schedules()->delete();
            $pro->schedules()->createMany($data['schedules']);
        }

        return Present::professional($pro->fresh(['services', 'schedules']), true);
    }

    public function storeProfessional(Request $r)
    {
        $b = $this->business($r);
        $data = $r->validate($this->professionalRules());
        $pro = $b->professionals()->make(['position' => $b->professionals()->count()]);
        $data['schedules'] ??= Presets::schedule();

        return response()->json($this->saveProfessional($b, $pro, $data), 201);
    }

    public function updateProfessional(Request $r, int $id)
    {
        $b = $this->business($r);

        return $this->saveProfessional($b, $b->professionals()->findOrFail($id), $r->validate($this->professionalRules()));
    }

    public function destroyProfessional(Request $r, int $id)
    {
        $pro = $this->business($r)->professionals()->findOrFail($id);
        if ($pro->appointments()->exists()) {
            $pro->update(['active' => false]);
        } else {
            $pro->delete();
        }

        return response()->noContent();
    }

    // --- Ausencias -------------------------------------------------------

    public function storeTimeOff(Request $r)
    {
        $b = $this->business($r);
        $data = $r->validate([
            'professional_id' => ['required', Rule::exists('professionals', 'id')->where('business_id', $b->id)],
            'starts_at' => 'required|date_format:Y-m-d H:i',
            'ends_at' => 'required|date_format:Y-m-d H:i|after:starts_at',
            'reason' => 'nullable|string|max:80',
        ]);
        $t = \App\Models\TimeOff::create($data);

        return response()->json(['id' => $t->id] + $data, 201);
    }

    public function destroyTimeOff(Request $r, int $id)
    {
        $b = $this->business($r);
        \App\Models\TimeOff::whereIn('professional_id', $b->professionals()->pluck('id'))->findOrFail($id)->delete();

        return response()->noContent();
    }
}
