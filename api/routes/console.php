<?php

use App\Services\DemoData;
use Illuminate\Support\Facades\Artisan;

Artisan::command('vellum:demo', function () {
    DemoData::reset();
    $this->info('Negocios de demostración regenerados.');
})->purpose('Regenera los negocios de demostración con citas alrededor de hoy');

Artisan::command('vellum:boot', function () {
    DemoData::freshen();
    $this->info('Demos listas.');
})->purpose('Crea o renueva las demos si hace falta (se usa al arrancar el servidor)');
