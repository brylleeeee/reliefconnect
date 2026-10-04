<?php

namespace Database\Seeders;

use App\Models\Barangay;
use App\Models\SosAlert;
use Illuminate\Database\Seeder;

/** Demo data for the SOS dashboard:  php artisan db:seed --class=SosDemoSeeder */
class SosDemoSeeder extends Seeder
{
    public function run(): void
    {
        SosAlert::whereNull('user_id')->delete(); // re-runnable

        // barangay => how many households pressed SOS
        $plan = ['Poblacion' => 14, 'Batangcaoa' => 9, 'Bayaoas' => 6, 'Angatel' => 3, 'Real' => 2];

        foreach ($plan as $name => $count) {
            $barangay = Barangay::where('name', $name)->first();
            if (! $barangay) continue;

            for ($i = 0; $i < $count; $i++) {
                SosAlert::create([
                    'barangay_id' => $barangay->id,
                    'people_count' => random_int(2, 8),
                    'status' => 'pending',
                    'created_at' => now()->subMinutes(random_int(5, 60 * 20)),
                ]);
            }
        }
    }
}
