<?php

namespace App\Http\Controllers;

use App\Models\Business;
use App\Models\User;
use App\Services\Presets;
use App\Services\DemoData;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    private function session(User $user): array
    {
        $user->loadMissing('business');

        return [
            'token' => $user->createToken('panel')->plainTextToken,
            'user' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'role' => $user->role],
            'business' => Present::business($user->business, true),
        ];
    }

    public function login(Request $r)
    {
        $data = $r->validate(['email' => 'required|email', 'password' => 'required']);
        $user = User::where('email', strtolower($data['email']))->first();
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => 'Correo o contraseña incorrectos.']);
        }

        return $this->session($user);
    }

    /** Crea un negocio nuevo con su dueño, un profesional y servicios de ejemplo. */
    public function register(Request $r)
    {
        $data = $r->validate([
            'business' => 'required|string|min:2|max:80',
            'kind' => ['required', Rule::in(Presets::KINDS)],
            'name' => 'required|string|min:2|max:80',
            'email' => 'required|email|max:120|unique:users,email',
            'password' => 'required|string|min:6|max:100',
            'phone' => 'nullable|string|max:20',
            'city' => 'nullable|string|max:60',
        ]);

        $user = DB::transaction(function () use ($data) {
            $base = Str::slug($data['business']) ?: 'negocio';
            $slug = $base;
            for ($i = 2; Business::where('slug', $slug)->exists(); $i++) {
                $slug = "$base-$i";
            }
            $business = Business::create([
                'slug' => $slug,
                'name' => $data['business'],
                'kind' => $data['kind'],
                'tagline' => Presets::tagline($data['kind']),
                'phone' => $data['phone'] ?? null,
                'city' => $data['city'] ?? null,
                'color' => Presets::color($data['kind']),
            ]);
            $pro = $business->professionals()->create(['name' => $data['name'], 'title' => 'Dueño', 'color' => $business->color]);
            $pro->schedules()->createMany(Presets::schedule());
            foreach (Presets::services($data['kind']) as $i => [$name, $cat, $min, $price, $desc]) {
                $s = $business->services()->create(['name' => $name, 'category' => $cat, 'duration' => $min, 'price' => $price, 'description' => $desc, 'position' => $i]);
                $pro->services()->attach($s->id);
            }

            return User::create([
                'name' => $data['name'],
                'email' => strtolower($data['email']),
                'password' => $data['password'],
                'business_id' => $business->id,
                'role' => 'owner',
            ]);
        });

        return response()->json($this->session($user), 201);
    }

    /** Entrar a un negocio de demostración sin crear cuenta. */
    public function demo(Request $r)
    {
        DemoData::freshenLater();
        $kind = $r->validate(['kind' => ['required', Rule::in(['barberia', 'estetica', 'odontologia'])]])['kind'];
        $business = Business::where('is_demo', true)->where('kind', $kind)->firstOrFail();
        $user = User::where('business_id', $business->id)->where('role', 'owner')->firstOrFail();
        // No se acumulan sesiones de demo para siempre
        $user->tokens()->where('created_at', '<', now()->subDay())->delete();

        return $this->session($user);
    }

    public function me(Request $r)
    {
        $user = $r->user()->load('business');

        return [
            'user' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'role' => $user->role],
            'business' => Present::business($user->business, true),
        ];
    }

    public function logout(Request $r)
    {
        $r->user()->currentAccessToken()?->delete();

        return response()->noContent();
    }
}
