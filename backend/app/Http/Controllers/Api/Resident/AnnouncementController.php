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

        // The app asks for up to 100 and pages them on the phone; older app builds still get 20
        $perPage = min(100, max(1, (int) $request->query('per_page', 20)));

        return Announcement::where('barangay_id', $barangayId)
            ->with('barangay:id,name')
            ->latest('published_at')->latest('id')
            ->paginate($perPage);
    }
}
