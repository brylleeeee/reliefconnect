<?php

namespace Database\Seeders;

use App\Models\Announcement;
use App\Models\Barangay;
use App\Models\Distribution;
use App\Models\DistributionEvent;
use App\Models\Household;
use App\Models\ReliefItem;
use App\Models\SosAlert;
use App\Models\Source;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\DistributionEventService;
use App\Services\HouseholdService;
use App\Services\SosMessageAnalyzer;
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
        // The 21 barangays of Urbiztondo, Pangasinan
        $barangays = collect([
            'Angatel', 'Balangay', 'Batangcaoa', 'Baug', 'Bayaoas', 'Bituag', 'Camambugan',
            'Dalangiring', 'Duplac', 'Galarin', 'Gueteb', 'Malaca', 'Malayo', 'Malibong',
            'Pasibi East', 'Pasibi West', 'Pisuac', 'Poblacion', 'Real', 'Salavante', 'Sawat',
        ])->map(fn ($name) => Barangay::create(['name' => $name]));

        // Sample households, events and claims are only created for these four
        $sample = $barangays->whereIn('name', ['Batangcaoa', 'Poblacion', 'Bayaoas', 'Angatel'])->values();

        // LGU (municipal) admin: not tied to one barangay
        $admin = User::create([
            'name' => 'Hon. R. Santos',
            'email' => 'admin@urbiztondo.test',
            'password' => 'password',
            'role' => User::ROLE_MUNICIPAL_ADMIN,
            'position' => 'Disaster Operations Chief',
        ]);

        // One Barangay Admin per barangay, e.g. batangcaoa@urbiztondo.test, pasibi-east@urbiztondo.test
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
            'name' => 'Maria Santos',
            'email' => 'staff@urbiztondo.test',
            'username' => 'staff', // the mobile staff app logs in by username
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
        $sizes = ['Batangcaoa' => 26, 'Poblacion' => 34, 'Bayaoas' => 18, 'Angatel' => 14];

        foreach ($sample as $b) {
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

        // Demo resident for the mobile app: log in with 09171234567 / password
        $demoHousehold = Household::where('status', 'approved')
            ->where('barangay_id', $barangays->firstWhere('name', 'Batangcaoa')->id)
            ->first();
        $resident = User::create([
            'name' => $demoHousehold->household_head,
            'phone' => '09171234567',
            'password' => 'password',
            'role' => User::ROLE_RESIDENT,
        ]);
        $demoHousehold->forceFill(['user_id' => $resident->id, 'contact_number' => '09171234567'])->save();

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

        $this->seedEvents($sample, $items, $admin, $distributor);
        $this->seedDonationsAndCash($sample, $items, $admin, $distributor);
        $this->seedSeniorEvent($sample, $admin, $distributor);
        $this->seedSos($sample);

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
     * An event only for households with a senior citizen, given per senior:
     * a household with two seniors receives two kits.
     */
    /**
     * Sample SOS during a flood, with messages, scored by the built-in rules (no AI key needed),
     * so SOS Prioritization and Aid Prioritization show a realistic priority order.
     */
    private function seedSos($barangays): void
    {
        $analyzer = app(SosMessageAnalyzer::class);
        $messages = [
            'Bayaoas' => [
                ['Naipit kami sa bubong, tumataas ang tubig. Tulong po!', 40],
                ['Baha na kami hanggang dibdib, may sanggol at lola', 55],
                ['Binaha ang bahay, walang pagkain at tubig', 90],
                ['May sakit ang anak ko, lagnat. Baha sa labas', 120],
            ],
            'Batangcaoa' => [
                ['Baha na po dito, kailangan ng relief goods', 70],
                ['walang makain, ubos na ang bigas', 150],
                [null, 200],
            ],
            'Poblacion' => [
                ['Need relief goods', 30],
                ['Nasira ang bubong dahil sa bagyo', 100],
            ],
            'Angatel' => [
                ['Kailangan namin ng tubig at pagkain', 240],
            ],
        ];

        foreach ($messages as $name => $list) {
            $b = $barangays->firstWhere('name', $name);
            if (! $b) {
                continue;
            }
            // Prefer households still waiting for relief (fewest claims), as SOS senders would be
            $households = Household::where('barangay_id', $b->id)->where('status', 'approved')
                ->withCount('distributions')->orderBy('distributions_count')->inRandomOrder()
                ->take(count($list))->get();

            foreach ($list as $i => [$message, $minutesAgo]) {
                $h = $households[$i] ?? null;
                if (! $h) {
                    break;
                }
                $userId = $h->user_id ?? User::create([
                    'name' => $h->household_head, 'password' => 'password', 'role' => User::ROLE_RESIDENT,
                    'username' => $h->reference_number, 'barangay_id' => $h->barangay_id,
                ])->id;
                $h->forceFill(['user_id' => $userId])->save();

                $sos = SosAlert::create([
                    'user_id' => $userId, 'household_id' => $h->id, 'barangay_id' => $h->barangay_id,
                    'people_count' => max($h->members_count, 1), 'message' => $message,
                ]);
                $sos->forceFill(['created_at' => now()->subMinutes($minutesAgo)])->save();
                $analyzer->scoreAlert($sos);
            }
        }
    }

    private function seedSeniorEvent($barangays, User $admin, User $distributor): void
    {
        $kits = ReliefItem::create([
            'name' => 'Senior Citizen Care Kit', 'contents' => 'Vitamins, Adult Diapers, Reading Glasses',
            'unit' => 'Kits', 'quantity_in_stock' => 200, 'reorder_level' => 30,
        ]);
        StockMovement::create([
            'relief_item_id' => $kits->id, 'user_id' => $admin->id, 'type' => 'incoming', 'quantity' => 200,
            'source_id' => Source::where('name', 'DSWD Field Office I')->value('id'),
        ])->forceFill(['created_at' => now()->subDays(3)])->save();

        $event = DistributionEvent::create([
            'name' => 'Senior Citizen Care Kits',
            'relief_item_id' => $kits->id,
            'quantity_per_household' => 1,
            'eligibility' => 'senior',
            'distribute_by' => now()->addDays(10)->toDateString(),
            'notes' => 'One kit for each senior citizen in the household. Bring a senior citizen ID if available.',
            'created_by' => $admin->id,
        ]);

        $service = app(DistributionEventService::class);
        foreach ($barangays as $b) {
            $eligible = DistributionEvent::applyEligibility(
                Household::where('barangay_id', $b->id)->where('status', 'approved'), 'senior'
            )->get();
            if ($eligible->isEmpty()) {
                continue;
            }
            $bd = $event->barangayDistributions()->create(['barangay_id' => $b->id, 'quota' => $eligible->count()]);

            if ($b->name === 'Poblacion') { // distributing now
                $bd->update(['status' => 'ongoing', 'scheduled_at' => now()->setTime(8, 30),
                    'venue' => 'Poblacion Senior Citizens Center', 'started_at' => now()->setTime(8, 30)]);
                $eligible->sortByDesc('seniors_count')->take(6)->each(function ($h) use ($service, $event, $distributor) {
                    $claim = $service->claim($event, $h->reference_number, $distributor, ['verification_method' => 'qr']);
                    $claim->update(['distributed_at' => now()->setTime(rand(8, 10), rand(31, 59))]);
                });
            }
        }
    }

    /**
     * Sources (donations, LGU funds, government allocations) with a history for the goods
     * above, plus a cash fund and a cash event, so the Sources tab, the Cash Aid tab and the
     * cash and sources reports have data.
     */
    private function seedDonationsAndCash($barangays, $items, User $admin, User $distributor): void
    {
        $sources = collect([
            'DSWD Field Office I' => 'government_allocation',
            'Provincial Government of Pangasinan' => 'government_allocation',
            'Office of Civil Defense - Region I' => 'government_allocation',
            'Urbiztondo Municipal Treasury' => 'lgu_fund',
            'Philippine Red Cross - Pangasinan Chapter' => 'donation',
            'Sto. Nino Parish Church' => 'donation',
        ])->map(fn ($type, $name) => Source::create(['name' => $name, 'type' => $type]));

        // Goods received (stock levels were set above; these explain where it came from)
        foreach ([
            [0, 'Philippine Red Cross - Pangasinan Chapter', 800, 20], [0, 'DSWD Field Office I', 400, 9],
            [1, 'Provincial Government of Pangasinan', 450, 14], [2, 'Sto. Nino Parish Church', 340, 6],
            [3, 'DSWD Field Office I', 120, 11], [4, 'Office of Civil Defense - Region I', 600, 25],
        ] as [$i, $source, $qty, $daysAgo]) {
            StockMovement::create([
                'relief_item_id' => $items[$i]->id, 'user_id' => $admin->id,
                'source_id' => $sources[$source]->id,
                'type' => 'incoming', 'quantity' => $qty,
            ])->forceFill(['created_at' => now()->subDays($daysAgo)])->save();
        }

        // Cash fund, in whole pesos, received from two sources
        $fund = ReliefItem::create([
            'type' => 'cash', 'name' => 'Emergency Cash Assistance Fund',
            'contents' => 'Locally funded cash aid', 'unit' => 'PHP', 'reorder_level' => 20000,
        ]);
        foreach ([['Urbiztondo Municipal Treasury', 200000, 12], ['Provincial Government of Pangasinan', 100000, 5]] as [$source, $amount, $daysAgo]) {
            $fund->increment('quantity_in_stock', $amount);
            StockMovement::create([
                'relief_item_id' => $fund->id, 'user_id' => $admin->id,
                'source_id' => $sources[$source]->id,
                'type' => 'incoming', 'quantity' => $amount,
            ])->forceFill(['created_at' => now()->subDays($daysAgo)])->save();
        }

        // Cash event: P1,000 per household for two barangays; Bayaoas is releasing now
        $event = DistributionEvent::create([
            'name' => 'Flood Emergency Cash Assistance',
            'relief_item_id' => $fund->id,
            'quantity_per_household' => 1000,
            'distribute_by' => now()->addDays(7)->toDateString(),
            'notes' => 'Bring your ReliefConnect QR code or reference number and one valid ID.',
            'created_by' => $admin->id,
        ]);
        $service = app(DistributionEventService::class);
        foreach (['Bayaoas' => 'ongoing', 'Angatel' => 'unscheduled'] as $name => $stage) {
            $b = $barangays->firstWhere('name', $name);
            $households = Household::where('barangay_id', $b->id)->where('status', 'approved')->get();
            $bd = $event->barangayDistributions()->create(['barangay_id' => $b->id, 'quota' => min(10, $households->count())]);
            if ($stage === 'ongoing') {
                $bd->update(['status' => 'ongoing', 'scheduled_at' => now()->setTime(9, 0),
                    'venue' => "Barangay {$name} Hall", 'started_at' => now()->setTime(9, 0)]);
                $households->sortByDesc('priority_score')->take(6)->each(function ($h) use ($service, $event, $distributor) {
                    $claim = $service->claim($event, $h->reference_number, $distributor, ['verification_method' => 'qr']);
                    $claim->update(['distributed_at' => now()->setTime(9, rand(5, 55))]);
                });
            }
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
            'Bayaoas' => ['closed', 90],     // finished yesterday
            'Batangcaoa' => ['ongoing', 55], // started yesterday, still distributing today (Day 1 and Day 2)
            'Poblacion' => ['ongoing', 30], // distributing now
            'Angatel' => ['scheduled', 0],  // tomorrow
        ];

        foreach ($barangays as $b) {
            [$stage, $share] = $stages[$b->name];
            $bd = $food->barangayDistributions()->create([
                'barangay_id' => $b->id,
                'quota' => $approved($b)->count(),
                'scheduled_at' => match (true) {
                    $stage === 'closed', $b->name === 'Batangcaoa' => now()->subDay()->setTime(8, 0),
                    $stage === 'scheduled' => now()->addDay()->setTime(9, 0),
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
                ->each(function ($h, $i) use ($service, $food, $distributor, $bd, $b) {
                    $claim = $service->claim($food, $h->reference_number, $distributor, [
                        'verification_method' => rand(1, 100) <= 80 ? 'qr' : 'reference_number',
                    ]);
                    // Batangcaoa: about half claimed on Day 1, the rest on Day 2
                    $day = $b->name === 'Batangcaoa' && $i % 2 ? 1 : 0;
                    $claim->update(['distributed_at' => $bd->scheduled_at->copy()->addDays($day)->addMinutes(rand(0, 180))]);
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
