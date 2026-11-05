<?php

namespace App\Providers;

use App\Services\QueueHeartbeat;
use Illuminate\Queue\Events\Looping;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // One per process, so the worker's heartbeat can throttle its own writes
        $this->app->singleton(QueueHeartbeat::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // The queue worker reports "I'm alive" every few seconds (even when idle), so the AI status card
        // can warn the LGU when nobody is running `php artisan queue:work`.
        Event::listen(Looping::class, fn () => app(QueueHeartbeat::class)->beat());
    }
}
