<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Household;

class DashboardController extends Controller
{
    public function stats()
    {
        return response()->json([
            'active_households' => Household::where('status', 'approved')->count(),
            'pending_qr_approvals' => Household::where('status', 'pending')->count(),
        ]);
    }
}
