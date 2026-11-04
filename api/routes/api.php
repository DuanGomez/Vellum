<?php

use App\Http\Controllers\AgendaController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ClientsController;
use App\Http\Controllers\PublicController;
use App\Http\Controllers\SetupController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => ['app' => 'Vellum API', 'ok' => true]);

// Página de reservas (pública)
Route::prefix('public')->middleware('throttle:120,1')->group(function () {
    Route::get('b/{slug}', [PublicController::class, 'show']);
    Route::get('b/{slug}/days', [PublicController::class, 'days']);
    Route::get('b/{slug}/slots', [PublicController::class, 'slots']);
    Route::post('b/{slug}/book', [PublicController::class, 'book'])->middleware('throttle:15,1');
    Route::get('appointments/{code}', [PublicController::class, 'appointment']);
    Route::post('appointments/{code}/cancel', [PublicController::class, 'cancel'])->middleware('throttle:10,1');
});

// Sesión
Route::prefix('auth')->middleware('throttle:20,1')->group(function () {
    Route::post('login', [AuthController::class, 'login']);
    Route::post('register', [AuthController::class, 'register']);
    Route::post('demo', [AuthController::class, 'demo']);
});

// Tarea programada de recordatorios
Route::post('cron/reminders', [ClientsController::class, 'cron']);
Route::post('cron/demo', [ClientsController::class, 'cronDemo']);

// Panel del negocio
Route::middleware('auth:sanctum')->group(function () {
    Route::get('me', [AuthController::class, 'me']);
    Route::post('auth/logout', [AuthController::class, 'logout']);

    Route::get('agenda', [AgendaController::class, 'index']);
    Route::get('agenda/slots', [AgendaController::class, 'slots']);
    Route::post('appointments', [AgendaController::class, 'store']);
    Route::patch('appointments/{id}', [AgendaController::class, 'update']);
    Route::delete('appointments/{id}', [AgendaController::class, 'destroy']);

    Route::patch('business', [SetupController::class, 'updateBusiness']);
    Route::get('services', [SetupController::class, 'services']);
    Route::post('services', [SetupController::class, 'storeService']);
    Route::put('services/{id}', [SetupController::class, 'updateService']);
    Route::delete('services/{id}', [SetupController::class, 'destroyService']);
    Route::get('professionals', [SetupController::class, 'professionals']);
    Route::post('professionals', [SetupController::class, 'storeProfessional']);
    Route::put('professionals/{id}', [SetupController::class, 'updateProfessional']);
    Route::delete('professionals/{id}', [SetupController::class, 'destroyProfessional']);
    Route::post('time-offs', [SetupController::class, 'storeTimeOff']);
    Route::delete('time-offs/{id}', [SetupController::class, 'destroyTimeOff']);

    Route::get('clients', [ClientsController::class, 'index']);
    Route::get('clients/{id}', [ClientsController::class, 'show']);
    Route::patch('clients/{id}', [ClientsController::class, 'update']);
    Route::get('reminders', [ClientsController::class, 'reminders']);
    Route::post('reminders/{id}/sent', [ClientsController::class, 'markReminded']);
    Route::get('stats', [ClientsController::class, 'stats']);
});
