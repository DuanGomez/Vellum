<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Business extends Model
{
    protected $guarded = ['id'];

    protected $casts = ['is_demo' => 'boolean'];

    public const DEFAULT_REMINDER = 'Hola {cliente} 👋 Te recordamos tu cita de {servicio} en {negocio} el {fecha} a las {hora} con {profesional}. Si no puedes asistir, avísanos por aquí. ¡Te esperamos!';

    public function professionals(): HasMany
    {
        return $this->hasMany(Professional::class)->orderBy('position')->orderBy('id');
    }

    public function services(): HasMany
    {
        return $this->hasMany(Service::class)->orderBy('position')->orderBy('id');
    }

    public function clients(): HasMany
    {
        return $this->hasMany(Client::class);
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class);
    }

    public function reminderTemplate(): string
    {
        return $this->reminder_template ?: self::DEFAULT_REMINDER;
    }
}
