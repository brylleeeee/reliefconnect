<?php

namespace App\Http\Controllers\Api\Resident;

use App\Http\Controllers\Controller;
use App\Models\Household;
use App\Models\SosAlert;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** Resident (mobile app): press SOS = "we need relief goods". Nothing else to fill in. */
class SosController extends Controller
{
    /** The resident's active SOS, or null. */
    public function show(Request $request)
    {
        return response()->json(['sos' => $this->active($request)]);
    }

    public function store(Request $request)
    {
        // One active SOS per resident, so pressing the button again can't inflate the barangay's score
        if ($existing = $this->active($request)) {
            return response()->json(['sos' => $existing, 'already_active' => true]);
        }

        // Barangay and household size come from the registered household, never from the request
        $household = Household::where('user_id', $request->user()->id)->latest('id')->first();
        if (! $household?->barangay_id) {
            throw ValidationException::withMessages([
                'sos' => 'Register your household first so we know which barangay to alert.',
            ]);
        }

        $sos = SosAlert::create([
            'user_id' => $request->user()->id,
            'household_id' => $household->id,
            'barangay_id' => $household->barangay_id,
            'people_count' => max($household->members_count, 1),
        ]);

        app(\App\Services\ResidentNotifier::class)->sosReceived($sos); // bell: "SOS received, #2 in line"

        return response()->json(['sos' => $sos], 201);
    }

    /** "I'm okay now": withdraws the SOS so it stops counting. */
    public function cancel(Request $request)
    {
        $this->active($request)?->update(['status' => 'cancelled']);

        return response()->json(['sos' => null]);
    }

    private function active(Request $request): ?SosAlert
    {
        return SosAlert::where('user_id', $request->user()->id)->where('status', 'pending')->latest('id')->first();
    }
}
