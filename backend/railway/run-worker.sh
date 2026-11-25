#!/bin/bash
# Railway "worker" service: runs the Laravel scheduler and the queue worker in one service.
# - schedule:work  -> relief:remind-unclaimed every 30 minutes (routes/console.php)
# - queue:work     -> SendExpoPush (push notifications) and ScoreSosAlert (SOS prioritization)
# Custom Start Command on Railway: sh ./railway/run-worker.sh

php artisan schedule:work &

exec php artisan queue:work --tries=3 --sleep=3
