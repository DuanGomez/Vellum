<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Appointment extends Model
{
    public const STATUSES = ['confirmada', 'atendida', 'no_asistio', 'cancelada'];

    protected $guarded = ['id'];

    protected $casts = [
        'starts_at' => 'datetime:Y-m-d H:i',
        'ends_at' => 'datetime:Y-m-d H:i',
        'reminder_sent_at' => 'datetime',
        'price' => 'integer',
    ];

    protected static function booted(): void
    {
        static::creating(function (Appointment $a) {
            $a->code ??= strtoupper(Str::random(8));
            $a->status ??= 'confirmada';
            $a->source ??= 'online';
        });
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    public function professional(): BelongsTo
    {
        return $this->belongsTo(Professional::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
