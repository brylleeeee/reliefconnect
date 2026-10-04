<?php

use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\AnnouncementController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClaimController as AdminClaimController;
use App\Http\Controllers\Api\Barangay\AnnouncementController as BarangayAnnouncementController;
use App\Http\Controllers\Api\Barangay\DistributionController as BarangayDistributionController;
use App\Http\Controllers\Api\Barangay\HistoryController as BarangayHistoryController;
use App\Http\Controllers\Api\Barangay\HouseholdController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\Distribution\ClaimController;
use App\Http\Controllers\Api\Resident\AnnouncementController as ResidentAnnouncementController;
use App\Http\Controllers\Api\Resident\HouseholdController as ResidentHouseholdController;
use App\Models\Barangay;
use App\Http\Controllers\Api\DistributionEventController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\PrioritizationController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\Resident\SosController as ResidentSosController;
use App\Http\Controllers\Api\SosAnalyticsController;
use Illuminate\Support\Facades\Route;

// Public
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
Route::get('/barangays', fn () => Barangay::orderBy('name')->get(['id', 'name'])); // registration picker

// Any logged-in user
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/me/password', [AuthController::class, 'changePassword'])->middleware('throttle:10,1');
    Route::post('/logout', [AuthController::class, 'logout']);
});

// ---------------- LGU Admin (Municipal Personnel) ----------------
Route::middleware(['auth:sanctum', 'role:municipal_admin'])
    ->prefix('admin')
    ->group(function () {
        // Announcements
        Route::get('/dashboard/stats', [DashboardController::class, 'stats']);
        Route::apiResource('announcements', AnnouncementController::class)->except('show');

        // Stocks inventory
        Route::get('/inventory', [InventoryController::class, 'index']);
        Route::post('/inventory/incoming', [InventoryController::class, 'logIncoming']);
        Route::post('/inventory/{reliefItem}/adjust', [InventoryController::class, 'adjust']);
        Route::get('/inventory/{reliefItem}/movements', [InventoryController::class, 'movements']);
        Route::get('/sources', [InventoryController::class, 'sources']);
        Route::post('/sources', [InventoryController::class, 'storeSource']);
        Route::put('/sources/{source}', [InventoryController::class, 'updateSource']);

        // Prioritization infographics per barangay
        Route::get('/prioritization', [PrioritizationController::class, 'index']);

        // SOS prioritization: which barangay is asking for the most help, plus charts
        Route::get('/sos', [SosAnalyticsController::class, 'index']);
        Route::post('/sos/barangays/{barangay}/serve', [SosAnalyticsController::class, 'serve']);

        // Analytics dashboard
        Route::get('/analytics', [AnalyticsController::class, 'overview']);

        // Distribution events: LGU sets item and quotas, watches every barangay live, closes the event
        Route::get('/barangays', [DistributionEventController::class, 'barangays']);
        Route::get('/events/options', [DistributionEventController::class, 'options']);
        Route::get('/events', [DistributionEventController::class, 'index']);
        Route::post('/events', [DistributionEventController::class, 'store']);
        Route::get('/events/{event}', [DistributionEventController::class, 'show']);
        Route::get('/events/{event}/analytics', [DistributionEventController::class, 'analytics']);
        Route::get('/events/{event}/claims', [AdminClaimController::class, 'index']);
        Route::get('/claims/{distribution}', [AdminClaimController::class, 'show']);
        Route::post('/events/{event}/close', [DistributionEventController::class, 'close']);
        Route::delete('/events/{event}', [DistributionEventController::class, 'destroy']);

        // Reports: preview (json), CSV and PDF; Excel is built in the browser from the json
        Route::get('/reports/{type}', [ReportController::class, 'generate'])
            ->whereIn('type', ReportController::TYPES);
    });

// ---------------- Barangay Admin ----------------
Route::middleware(['auth:sanctum', 'role:barangay_admin'])
    ->prefix('barangay')
    ->group(function () {
        Route::get('/summary', [HouseholdController::class, 'summary']);
        Route::get('/households', [HouseholdController::class, 'index']);
        Route::post('/households', [HouseholdController::class, 'store']);            // walk-in
        Route::get('/households/{household}', [HouseholdController::class, 'show']);
        Route::put('/households/{household}', [HouseholdController::class, 'update']);
        Route::post('/households/{household}/approve', [HouseholdController::class, 'approve']);
        Route::post('/households/{household}/reject', [HouseholdController::class, 'reject']);
        Route::post('/households/{household}/reset-qr', [HouseholdController::class, 'resetQr']);
        Route::delete('/households/{household}', [HouseholdController::class, 'destroy']);
        Route::get('/households/{household}/claims', [HouseholdController::class, 'claims']);

        // Distribution history: event > day > households that claimed
        Route::get('/history', [BarangayHistoryController::class, 'index']);
        Route::get('/history/{event}/claims', [BarangayHistoryController::class, 'claims']);
        Route::get('/households/{household}/documents/{document}', [HouseholdController::class, 'document']);

        // Barangay distribution day: schedule, start, close, and who has/hasn't claimed
        Route::get('/distributions', [BarangayDistributionController::class, 'index']);
        Route::put('/distributions/{event}/schedule', [BarangayDistributionController::class, 'schedule']);
        Route::post('/distributions/{event}/start', [BarangayDistributionController::class, 'start']);
        Route::post('/distributions/{event}/close', [BarangayDistributionController::class, 'close']);
        Route::get('/distributions/{event}/households', [BarangayDistributionController::class, 'households']);
        Route::get('/distributions/{event}/households/{household}/claim', [BarangayDistributionController::class, 'householdClaim']);
        Route::get('/claims/{distribution}', [BarangayDistributionController::class, 'claim']);

        // Announcements: read the LGU's, announce to own residents
        Route::get('/announcements', [BarangayAnnouncementController::class, 'index']);
        Route::post('/announcements', [BarangayAnnouncementController::class, 'store']);
        Route::put('/announcements/{announcement}', [BarangayAnnouncementController::class, 'update']);
        Route::delete('/announcements/{announcement}', [BarangayAnnouncementController::class, 'destroy']);
    });

// ---------------- Distribution Personnel (mobile scanner) ----------------
Route::middleware(['auth:sanctum', 'role:distribution_personnel'])
    ->prefix('distribution')
    ->group(function () {
        Route::get('/events', [ClaimController::class, 'events']);
        Route::get('/events/{event}/check', [ClaimController::class, 'check']);
        Route::get('/events/{event}/offline-pack', [ClaimController::class, 'offlinePack']); // offline mode
        Route::post('/events/{event}/claims', [ClaimController::class, 'store']);
    });

// ---------------- Resident (mobile app) ----------------
Route::middleware(['auth:sanctum', 'role:resident'])
    ->prefix('resident')
    ->group(function () {
        Route::get('/announcements', [ResidentAnnouncementController::class, 'index']);
        Route::get('/household', [ResidentHouseholdController::class, 'show']);
        Route::get('/claims', [ResidentHouseholdController::class, 'claims']); // History tab
        Route::post('/household', [ResidentHouseholdController::class, 'store']); // multipart, with documents

        // SOS: one active alert per resident
        Route::get('/sos', [ResidentSosController::class, 'show']);
        Route::post('/sos', [ResidentSosController::class, 'store'])->middleware('throttle:6,1');
        Route::post('/sos/cancel', [ResidentSosController::class, 'cancel']);
    });
