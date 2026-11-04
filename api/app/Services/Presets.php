<?php

namespace App\Services;

/** Servicios y textos de arranque para cada tipo de negocio. */
class Presets
{
    public const KINDS = ['barberia', 'estetica', 'odontologia', 'otro'];

    /** [nombre, categoría, minutos, precio, descripción] */
    public static function services(string $kind): array
    {
        return match ($kind) {
            'barberia' => [
                ['Corte clásico', 'Cortes', 40, 30000, 'Tijera y máquina, lavado y peinado.'],
                ['Corte + barba', 'Combos', 60, 45000, 'Corte completo y perfilado de barba con toalla caliente.'],
                ['Arreglo de barba', 'Barba', 30, 22000, 'Perfilado, rebajado e hidratación.'],
                ['Afeitado tradicional', 'Barba', 40, 28000, 'Navaja, toalla caliente y bálsamo.'],
                ['Corte infantil', 'Cortes', 30, 22000, 'Para menores de 12 años.'],
                ['Cejas', 'Detalles', 15, 10000, 'Diseño y limpieza de cejas.'],
            ],
            'estetica' => [
                ['Limpieza facial profunda', 'Facial', 75, 120000, 'Extracción, exfoliación, mascarilla e hidratación.'],
                ['Manicure semipermanente', 'Uñas', 60, 45000, 'Esmaltado que dura hasta tres semanas.'],
                ['Pedicure spa', 'Uñas', 60, 50000, 'Exfoliación, hidratación y esmaltado.'],
                ['Diseño de cejas con henna', 'Cejas y pestañas', 40, 40000, 'Diseño según tu rostro y pigmentación.'],
                ['Lifting de pestañas', 'Cejas y pestañas', 60, 90000, 'Curvatura natural por 6 a 8 semanas.'],
                ['Masaje relajante', 'Corporal', 60, 110000, 'Aceites esenciales, cuerpo completo.'],
            ],
            'odontologia' => [
                ['Valoración odontológica', 'General', 30, 50000, 'Revisión completa y plan de tratamiento.'],
                ['Limpieza y profilaxis', 'Higiene', 45, 120000, 'Remoción de placa y sarro, pulido.'],
                ['Resina dental', 'Restauración', 60, 180000, 'Restauración estética de una pieza.'],
                ['Blanqueamiento', 'Estética dental', 90, 650000, 'Blanqueamiento en consultorio.'],
                ['Control de ortodoncia', 'Ortodoncia', 30, 90000, 'Ajuste mensual de brackets.'],
                ['Urgencia odontológica', 'General', 45, 100000, 'Atención de dolor o fractura.'],
            ],
            default => [
                ['Consulta', 'General', 30, 50000, null],
                ['Sesión completa', 'General', 60, 90000, null],
            ],
        };
    }

    public static function tagline(string $kind): string
    {
        return match ($kind) {
            'barberia' => 'Cortes con oficio, sin filas',
            'estetica' => 'Tu momento de cuidado, a tu hora',
            'odontologia' => 'Sonrisas sanas, citas puntuales',
            default => 'Reserva tu cita en línea',
        };
    }

    public static function color(string $kind): string
    {
        return match ($kind) {
            'barberia' => '#B4532A',
            'estetica' => '#B0476E',
            'odontologia' => '#2C7A7B',
            default => '#5B4BB7',
        };
    }

    /** Horario por defecto: lunes a sábado, con pausa para almorzar. */
    public static function schedule(): array
    {
        $out = [];
        foreach ([1, 2, 3, 4, 5] as $d) {
            $out[] = ['weekday' => $d, 'start' => '09:00', 'end' => '12:30'];
            $out[] = ['weekday' => $d, 'start' => '14:00', 'end' => '19:00'];
        }
        $out[] = ['weekday' => 6, 'start' => '09:00', 'end' => '15:00'];

        return $out;
    }
}
