<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimeOff extends Model
{
    protected $guarded = ['id'];

    protected $casts = ['starts_at' => 'datetime:Y-m-d H:i', 'ends_at' => 'datetime:Y-m-d H:i'];

    public function professional(): BelongsTo
    {
        return $this->belongsTo(Professional::class);
    }
}
