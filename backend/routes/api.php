<?php

use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\AnnouncementController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\Barangay\HouseholdController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\PrioritizationController;
use App\Http\Controllers\Api\ReportController;
use Illuminate\Support\Facades\Route;

// Public
Route::post('/login', [AuthController::class, 'login']);

// Any logged-in user
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
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

        // Prioritization infographics per barangay
        Route::get('/prioritization', [PrioritizationController::class, 'index']);

        // Analytics dashboard
        Route::get('/analytics', [AnalyticsController::class, 'overview']);

        // Reports (kept in the API; not shown in the sidebar for now)
        Route::get('/reports/{type}', [ReportController::class, 'generate'])
            ->whereIn('type', ['beneficiary', 'inventory', 'distribution']);
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
    });
