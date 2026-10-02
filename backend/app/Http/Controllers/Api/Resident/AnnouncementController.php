<?php

namespace App\Http\Controllers\Api\Resident;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\Household;
use Illuminate\Http\Request;

/**
 * Resident app (mobile): residents only see announcements from their own barangay.
 * LGU announcements reach them when their barangay relays them.
 */
class AnnouncementController extends Controller
{
    public function index(Request $request)
    {
        $barangayId = Household::where('user_id', $request->user()->id)->value('barangay_id');
        abort_unless($barangayId, 404, 'Register your household first to receive announcements.');

        return Announcement::where('barangay_id', $barangayId)
            ->with('barangay:id,name')
            ->latest('published_at')->latest('id')
            ->paginate(20);
    }
}
