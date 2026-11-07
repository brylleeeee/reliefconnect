<?php

namespace App\Http\Controllers\Api\Distribution;

use App\Http\Controllers\Controller;
use App\Models\SupportReport;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Staff app: report field problems (e.g. short on goods) to the barangay and follow them until resolved. */
class SupportReportController extends Controller
{
    /** The staff member's own reports, newest first. */
    public function index(Request $request)
    {
        return SupportReport::with('event:id,name')
            ->where('reported_by', $request->user()->id)
            ->latest()->take(50)->get()
            ->map(fn ($r) => $r->toMobile());
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->barangay_id, 403, 'Your account is not assigned to a barangay.');

        $data = $request->validate([
            'category' => ['required', Rule::in(SupportReport::STAFF_CATEGORIES)],
            'message' => ['required', 'string', 'max:1000'],
            'distribution_event_id' => ['nullable', 'integer', 'exists:distribution_events,id'],
        ]);

        $report = SupportReport::create($data + [
            'barangay_id' => $request->user()->barangay_id,
            'reported_by' => $request->user()->id,
            'reporter_role' => 'distribution_personnel',
            'status' => 'open',
        ]);

        return response()->json($report->load('event:id,name')->toMobile(), 201);
    }
}