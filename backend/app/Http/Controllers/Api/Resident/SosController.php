<?php

namespace App\Http\Controllers\Api\Resident;

use App\Http\Controllers\Controller;
use App\Models\Household;
use App\Models\SosAlert;
use App\Services\SosMessageAnalyzer;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Resident (mobile app): press SOS = "we need relief goods". The resident can also describe the situation
 * ("baha na kami", "may sakit ang anak ko"); the message is scored right away (built-in rules, or Gemini if
 * a key is set) and adds points to the household's barangay in SOS and Aid Prioritization.
 */
class SosController extends Controller
{
    /** The resident's active SOS, or null. */
    public function show(Request $request)
    {
        return response()->json(['sos' => $this->active($request)]);
    }

    public function store(Request $request, SosMessageAnalyzer $analyzer)
    {
        $data = $request->validate([
            'message' => ['nullable', 'string', 'max:500'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);
        $message = trim((string) ($data['message'] ?? ''));

        // One active SOS per resident, so pressing the button again can't inflate the barangay's count.
        // A new message is added to it instead, and the SOS is scored again with the full story.
        if ($existing = $this->active($request)) {
            if ($message !== '') {
                $existing->message = mb_substr(trim($existing->message."\n".$message), 0, 1000);
                $existing->save();
                $analyzer->scoreAlert($existing);
            }

            return response()->json(['sos' => $existing->fresh(), 'already_active' => true]);
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
            'message' => $message !== '' ? $message : null,
            'latitude' => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
        ]);
        $analyzer->scoreAlert($sos); // works without an AI key (built-in rules)

        app(\App\Services\ResidentNotifier::class)->sosReceived($sos); // bell: "SOS received, #2 in line"

        return response()->json(['sos' => $sos->fresh()], 201);
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
