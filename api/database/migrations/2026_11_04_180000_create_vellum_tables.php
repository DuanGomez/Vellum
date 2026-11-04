<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Vellum: negocios con su equipo, servicios, horarios, clientes y citas.
 * Las horas se guardan en la hora local del negocio (America/Bogota).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('businesses', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('kind', 20); // barberia | estetica | odontologia | otro
            $table->string('tagline')->nullable();
            $table->string('phone', 30)->nullable(); // WhatsApp del negocio
            $table->string('address')->nullable();
            $table->string('city')->nullable();
            $table->string('color', 9)->default('#B4532A');
            $table->unsignedSmallInteger('slot_step')->default(15); // minutos entre horas ofrecidas
            $table->unsignedSmallInteger('min_notice')->default(60); // minutos de anticipación mínima
            $table->unsignedSmallInteger('max_days')->default(30); // días hacia adelante que se puede reservar
            $table->unsignedSmallInteger('reminder_hours')->default(24);
            $table->text('reminder_template')->nullable();
            $table->boolean('is_demo')->default(false);
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('business_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('role', 12)->default('owner');
        });

        Schema::create('professionals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('title')->nullable();
            $table->string('color', 9)->default('#B4532A');
            $table->string('photo_url')->nullable();
            $table->boolean('active')->default(true);
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('services', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('category')->nullable();
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('duration'); // minutos
            $table->unsignedInteger('price')->default(0); // pesos
            $table->boolean('active')->default(true);
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('professional_service', function (Blueprint $table) {
            $table->foreignId('professional_id')->constrained()->cascadeOnDelete();
            $table->foreignId('service_id')->constrained()->cascadeOnDelete();
            $table->primary(['professional_id', 'service_id']);
        });

        // Horario semanal: varios tramos por día (para el almuerzo, por ejemplo)
        Schema::create('schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('professional_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('weekday'); // 1 = lunes … 7 = domingo
            $table->string('start', 5); // HH:MM
            $table->string('end', 5);
        });

        // Ausencias: vacaciones, citas médicas, un bloqueo de una hora…
        Schema::create('time_offs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('professional_id')->constrained()->cascadeOnDelete();
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->string('reason')->nullable();
            $table->timestamps();
        });

        Schema::create('clients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('phone', 30);
            $table->string('email')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['business_id', 'phone']);
        });

        Schema::create('appointments', function (Blueprint $table) {
            $table->id();
            $table->string('code', 12)->unique(); // referencia pública
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('professional_id')->constrained()->cascadeOnDelete();
            $table->foreignId('service_id')->constrained()->cascadeOnDelete();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->string('status', 12)->default('confirmada'); // confirmada | atendida | no_asistio | cancelada
            $table->unsignedInteger('price')->default(0);
            $table->text('notes')->nullable();
            $table->string('source', 10)->default('online'); // online | panel
            $table->timestamp('reminder_sent_at')->nullable();
            $table->timestamps();
            $table->index(['business_id', 'starts_at']);
            $table->index(['professional_id', 'starts_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('appointments');
        Schema::dropIfExists('clients');
        Schema::dropIfExists('time_offs');
        Schema::dropIfExists('schedules');
        Schema::dropIfExists('professional_service');
        Schema::dropIfExists('services');
        Schema::dropIfExists('professionals');
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('business_id');
            $table->dropColumn('role');
        });
        Schema::dropIfExists('businesses');
    }
};
