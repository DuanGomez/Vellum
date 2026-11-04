<?php

namespace Database\Seeders;

use App\Services\DemoData;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        DemoData::reset();
    }
}
