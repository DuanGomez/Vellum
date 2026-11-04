<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Schedule extends Model
{
    public $timestamps = false;

    protected $guarded = ['id'];

    protected $casts = ['weekday' => 'integer'];
}
