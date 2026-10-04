<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Reminds eligible households that have not claimed yet, once per barangay distribution,
// after it has been running for 2 hours. Runs every 30 minutes (needs `php artisan schedule:work`
// on the server). For a demo, run it by hand: php artisan relief:remind-unclaimed --now
Artisan::command('relief:remind-unclaimed {--now : Do not wait 2 hours after the start}', function () {
    $notifier = app(\App\Services\ResidentNotifier::class);
    $started = $this->option('now') ? now() : now()->subHours(2);

    $total = \App\Models\BarangayDistribution::where('status', 'ongoing')
        ->where('started_at', '<=', $started)
        ->whereHas('event', fn ($q) => $q->where('status', 'open'))
        ->get()
        ->sum(fn ($bd) => $notifier->remindUnclaimed($bd));

    $this->info("Reminded {$total} household(s) that have not claimed yet.");
})->purpose('Remind eligible households that have not claimed during an ongoing distribution');

Schedule::command('relief:remind-unclaimed')->everyThirtyMinutes();
