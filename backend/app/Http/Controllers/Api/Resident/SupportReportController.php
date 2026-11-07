<?php

namespace App\Http\Controllers\Api\Resident;

use App\Http\Controllers\Controller;
use App\Models\Household;
use App\Models\SupportReport;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Resident app: report a problem to the barangay (e.g. incomplete aid) and follow it until resolved. */
class SupportReportController extends Controller
{
    /** The resident's own reports, newest first. */
    public function index(Request $request)
    {
        return SupportReport::with('event:id,name')
            ->where('reported_by', $request->user()->id)
            ->latest()->take(50)->get()
            ->map(fn ($r) => $r->toMobile());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'category' => ['required', Rule::in(SupportReport::RESIDENT_CATEGORIES)],
            'message' => ['required', 'string', 'max:1000'],
            'distribution_event_id' => ['nullable', 'integer', 'exists:distribution_events,id'],
        ]);

        $household = Household::where('user_id', $request->user()->id)->first();
        if (! $household) {
            throw ValidationException::withMessages([
                'household' => 'Register your household first so your barangay knows where the report comes from.',
            ]);
        }

        $report = SupportReport::create($data + [
            'barangay_id' => $household->barangay_id,
            'household_id' => $household->id,
            'reported_by' => $request->user()->id,
            'reporter_role' => 'resident',
            'status' => 'open',
        ]);

        return response()->json($report->load('event:id,name')->toMobile(), 201);
    }
}