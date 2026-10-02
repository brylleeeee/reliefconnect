<?php

namespace Database\Seeders;

use App\Models\Announcement;
use App\Models\Barangay;
use App\Models\Distribution;
use App\Models\DistributionEvent;
use App\Models\Household;
use App\Models\ReliefItem;
use App\Models\User;
use App\Services\DistributionEventService;
use App\Services\HouseholdService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    private array $first = ['Juan', 'Maria', 'Jose', 'Ana', 'Pedro', 'Rosa', 'Carlos', 'Liza', 'Mario', 'Elena',
        'Ramon', 'Teresa', 'Andres', 'Luz', 'Emilio', 'Corazon', 'Danilo', 'Marites', 'Rogelio', 'Imelda'];
    private array $last = ['Dela Cruz', 'Santos', 'Reyes', 'Bautista', 'Garcia', 'Mendoza', 'Aquino', 'Ramos',
        'Castillo', 'Flores', 'Villanueva', 'Soriano', 'Tamayo', 'Fernandez', 'Pascual', 'Gonzales'];

    public function run(): void
    {
        // Sample barangays: complete with the official list from the LGU
        $barangays = collect(['Batancaoa', 'Poblacion', 'Bayaoas', 'Angatel'])
            ->map(fn ($name) => Barangay::create(['name' => $name]));

        // LGU (municipal) admin: not tied to one barangay
        $admin = User::create([
            'name' => 'Hon. R. Santos',
            'email' => 'admin@urbiztondo.test',
            'password' => 'password',
            'role' => User::ROLE_MUNICIPAL_ADMIN,
            'position' => 'Disaster Operations Chief',
        ]);

        // One Barangay Admin per barangay, e.g. batancaoa@urbiztondo.test
        foreach ($barangays as $b) {
            User::create([
                'name' => "Brgy. {$b->name} Secretary",
                'email' => Str::slug($b->name).'@urbiztondo.test',
                'password' => 'password',
                'role' => User::ROLE_BARANGAY_ADMIN,
                'position' => 'Barangay Secretary',
                'barangay_id' => $b->id,
            ]);
        }

        $distributor = User::create([
            'name' => 'Distribution Staff 1',
            'email' => 'staff@urbiztondo.test',
            'password' => 'password',
            'role' => User::ROLE_DISTRIBUTION,
        ]);

        $items = collect([
            ['PH Red Cross Family Food Pack', 'Rice, Canned Goods, Coffee', 'Packs', 1200, 4500, 200],
            ['Barangay Sanitary Care Kit', 'Soap, Toothbrush, Sanitizer', 'Kits', 450, 1120, 100],
            ['Emergency Drinking Water Carboy', '5 Gallons', 'Carboys', 340, 890, 80],
            ['Infant Care Nutrition Bag', 'Formula Milk, Baby Wipes', 'Bags', 120, 340, 40],
            ['LGU Heavy Blanket & Emergency Shelter Tarp Set', null, 'Sets', 600, 200, 100],
        ])->map(fn ($i) => ReliefItem::create([
            'name' => $i[0], 'contents' => $i[1], 'unit' => $i[2],
            'quantity_in_stock' => $i[3], 'distributed_to_date' => $i[4], 'reorder_level' => $i[5],
        ]));

        // Households with members; the scorer computes counts and priority automatically
        $service = app(HouseholdService::class);
        $sizes = ['Batancaoa' => 26, 'Poblacion' => 34, 'Bayaoas' => 18, 'Angatel' => 14];

        foreach ($barangays as $b) {
            for ($n = 0; $n < $sizes[$b->name]; $n++) {
                $pending = rand(1, 100) <= 18;
                $household = new Household([
                    'barangay_id' => $b->id,
                    'status' => 'pending',
                    'registration_type' => rand(1, 100) <= 30 ? 'walk_in' : 'online',
                ]);
                $service->save($household, [
                    'purok' => 'Purok '.rand(1, 6),
                    'address' => 'Sitio '.['Centro', 'Riverside', 'Maligaya', 'Bagong Silang', 'Looban'][rand(0, 4)],
                    'contact_number' => '09'.rand(100000000, 999999999),
                    'is_solo_parent' => rand(1, 100) <= 10,
                    'members' => $this->randomMembers(),
                ], checkDuplicates: false);

                if (! $pending) {
                    $service->approve($household, $admin);
                    $household->forceFill(['approved_at' => now()->subDays(rand(5, 90))])->save();
                }
            }
        }

        // Distributions spread across the last 30 days
        Household::where('status', 'approved')->inRandomOrder()->take(55)->get()
            ->each(fn ($h) => Distribution::create([
                'household_id' => $h->id,
                'relief_item_id' => $items->take(3)->random()->id,
                'distributed_by' => $distributor->id,
                'quantity' => 1,
                'verification_method' => rand(1, 100) <= 80 ? 'qr' : 'reference_number',
                'synced_from_offline' => rand(1, 100) <= 15,
                'distributed_at' => now()->subDays(rand(0, 29))->setTime(rand(8, 16), rand(0, 59)),
            ]));

        $this->seedEvents($barangays, $items, $admin, $distributor);

        foreach ([
            ['Nutritional Relief Pack Distribution', 'Priority collection for senior citizens and pregnant women. Please bring your approved digital Relief QR code.', now()->setTime(8, 0)],
            ['Class Suspensions & Flood Advisory', 'Due to southwest monsoon rains, classes in all levels are suspended. Emergency rescue boat standby at Purok 4.', now()->subDay()],
            ['First Quarter Community Assembly', 'Discussion of localized barangay health programs, livelihood support initiatives, and distribution feedback.', now()->subWeeks(3)],
        ] as [$title, $desc, $date]) {
            Announcement::create([
                'user_id' => $admin->id, 'title' => $title,
                'description' => $desc, 'published_at' => $date,
            ]);
        }
    }

    /**
     * Sample events so the Distribution Events and barangay Distributions pages have data
     * before the mobile scanner exists. Each barangay is at a different stage, and claims
     * go through the same service the scanner will use, so stock updates realistically.
     */
    private function seedEvents($barangays, $items, User $admin, User $distributor): void
    {
        $service = app(DistributionEventService::class);
        $approved = fn ($b) => Household::where('barangay_id', $b->id)->where('status', 'approved')->get();

        $food = DistributionEvent::create([
            'name' => 'Typhoon Relief: Family Food Packs',
            'relief_item_id' => $items[0]->id,
            'quantity_per_household' => 1,
            'distribute_by' => now()->addDays(5)->toDateString(),
            'notes' => 'Bring your ReliefConnect QR code or reference number. Priority lane for seniors, PWDs and pregnant women.',
            'created_by' => $admin->id,
        ]);

        // name => [status, share of households that claimed]
        $stages = [
            'Bayaoas' => ['closed', 90],    // finished yesterday
            'Batancaoa' => ['ongoing', 55], // distributing now
            'Poblacion' => ['ongoing', 30], // distributing now
            'Angatel' => ['scheduled', 0],  // tomorrow
        ];

        foreach ($barangays as $b) {
            [$stage, $share] = $stages[$b->name];
            $bd = $food->barangayDistributions()->create([
                'barangay_id' => $b->id,
                'quota' => $approved($b)->count(),
                'scheduled_at' => match ($stage) {
                    'closed' => now()->subDay()->setTime(8, 0),
                    'scheduled' => now()->addDay()->setTime(9, 0),
                    default => now()->setTime(8, 0),
                },
                'venue' => "Barangay {$b->name} Hall",
                'status' => 'scheduled',
            ]);

            if ($stage === 'scheduled') {
                continue;
            }

            $bd->update(['status' => 'ongoing', 'started_at' => $bd->scheduled_at]);
            $approved($b)->shuffle()->take((int) round($approved($b)->count() * $share / 100))
                ->each(function ($h) use ($service, $food, $distributor, $bd) {
                    $claim = $service->claim($food, $h->reference_number, $distributor, [
                        'verification_method' => rand(1, 100) <= 80 ? 'qr' : 'reference_number',
                    ]);
                    $claim->update(['distributed_at' => $bd->scheduled_at->copy()->addMinutes(rand(0, 180))]);
                });

            if ($stage === 'closed') {
                $bd->update(['status' => 'closed', 'closed_at' => $bd->scheduled_at->copy()->addHours(4)]);
            }
        }

        // The LGU's notice to the barangays, and the barangays that relayed it to residents
        $notice = Announcement::create([
            'user_id' => $admin->id,
            'distribution_event_id' => $food->id,
            'category' => 'Distribution',
            'title' => "New relief distribution: {$food->name}",
            'description' => "1 Pack of {$items[0]->name} per household. Check Distributions for your barangay's quota and set your distribution day on or before ".$food->distribute_by->format('M j, Y').'.',
            'published_at' => now()->subDays(2),
        ]);
        $notice->targetBarangays()->sync($barangays->pluck('id'));

        foreach ($food->barangayDistributions()->with('barangay')->get() as $bd) {
            if ($bd->barangay->name === 'Angatel') {
                continue; // not relayed yet, so the LGU can see a barangay that still needs to
            }
            Announcement::create([
                'user_id' => User::where('barangay_id', $bd->barangay_id)->value('id'),
                'barangay_id' => $bd->barangay_id,
                'source_announcement_id' => $notice->id,
                'distribution_event_id' => $food->id,
                'category' => 'Barangay Advisory',
                'title' => "Food pack distribution in Barangay {$bd->barangay->name}",
                'description' => 'Distribution on '.$bd->scheduled_at->format('M j, Y g:i A')." at {$bd->venue}. One food pack per household. Bring your ReliefConnect QR code or reference number.",
                'published_at' => now()->subDays(2)->addHours(3),
            ]);
        }

        // Just created by the LGU: no barangay has scheduled yet
        $kits = DistributionEvent::create([
            'name' => 'Sanitary Kit Distribution',
            'relief_item_id' => $items[1]->id,
            'quantity_per_household' => 1,
            'distribute_by' => now()->addDays(14)->toDateString(),
            'created_by' => $admin->id,
        ]);
        foreach ($barangays as $b) {
            $kits->barangayDistributions()->create(['barangay_id' => $b->id, 'quota' => $approved($b)->count()]);
        }
    }

    private function randomMembers(): array
    {
        $surname = $this->last[array_rand($this->last)];
        $person = fn (string $rel, int $minAge, int $maxAge, ?string $sex = null) => [
            'full_name' => $this->first[array_rand($this->first)].' '.$surname,
            'relationship' => $rel,
            'birthdate' => now()->subYears(rand($minAge, $maxAge))->subDays(rand(0, 364))->toDateString(),
            'sex' => $sex ?? (rand(0, 1) ? 'M' : 'F'),
            'is_pwd' => rand(1, 100) <= 7,
            'is_pregnant' => false,
        ];

        $members = [$person('Head', 25, 78)];
        if (rand(1, 100) <= 75) {
            $spouse = $person('Spouse', 22, 70, $members[0]['sex'] === 'M' ? 'F' : 'M');
            $spouse['is_pregnant'] = $spouse['sex'] === 'F' && rand(1, 100) <= 10;
            $members[] = $spouse;
        }
        for ($i = rand(0, 4); $i > 0; $i--) $members[] = $person('Child', 2, 20);
        if (rand(1, 100) <= 25) $members[] = $person('Child', 0, 1);
        if (rand(1, 100) <= 25) $members[] = $person('Parent', 62, 88);

        return $members;
    }
}
