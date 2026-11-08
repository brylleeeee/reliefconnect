<?php

namespace App\Http\Controllers\Api\Barangay;

use App\Http\Controllers\Controller;
use App\Models\SupportReport;
use App\Notifications\ResidentAlert;
use App\Notifications\StaffAlert;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Barangay Admin: complaints from residents and field problems from staff.
 * Only reports from the admin's own barangay are visible.
 */
class SupportReportController extends Controller
{
    public function index(Request $request)
    {
        $f = $request->validate([
            'status' => ['nullable', 'in:open,resolved,all'],
            'from' => ['nullable', 'in:resident,distribution_personnel'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);
        $status = $f['status'] ?? 'open';

        $page = $this->scoped($request)
            ->with([
                'reporter:id,name,phone',
                'household:id,household_head,purok,reference_number',
                'event:id,name',
                'resolver:id,name',
            ])
            ->when($status !== 'all', fn ($q) => $q->where('status', $status))
            ->when($f['from'] ?? null, fn ($q, $v) => $q->where('reporter_role', $v))
            ->when($f['search'] ?? null, fn ($q, $s) => $q->where(fn ($w) => $w
                ->where('message', 'like', "%$s%")
                ->orWhere('category', 'like', "%$s%")
                ->orWhereHas('reporter', fn ($u) => $u->where('name', 'like', "%$s%"))))
            // Open reports: oldest first (first come, first served); resolved ones: newest first
            ->when($status === 'open', fn ($q) => $q->oldest(), fn ($q) => $q->latest())
            ->paginate(15)->withQueryString();

        $page->getCollection()->transform(fn ($r) => [
            'id' => $r->id,
            'from' => $r->reporter_role === 'resident' ? 'Resident' : 'Distribution staff',
            'reporter' => $r->reporter,
            'household' => $r->household,
            'event' => $r->event?->name,
            'category' => $r->category,
            'message' => $r->message,
            'status' => $r->status,
            'resolution_note' => $r->resolution_note,
            'resolver' => $r->resolver?->name,
            'submitted_at' => $r->created_at,
            'resolved_at' => $r->resolved_at,
        ]);

        return response()->json([
            'open_count' => $this->scoped($request)->where('status', 'open')->count(),
            'reports' => $page,
        ]);
    }

    public function resolve(Request $request, SupportReport $supportReport)
    {
        $this->authorizeReport($request, $supportReport);
        if ($supportReport->status === 'resolved') {
            throw ValidationException::withMessages(['status' => 'This report is already resolved.']);
        }

        $data = $request->validate(['note' => ['nullable', 'string', 'max:255']]);

        $supportReport->update([
            'status' => 'resolved',
            'resolution_note' => $data['note'] ?? null,
            'resolved_by' => $request->user()->id,
            'resolved_at' => now(),
        ]);

        $this->notifyReporter($supportReport);

        return response()->json(['message' => 'Report marked as resolved.']);
    }

    // ---------------------------------------------------------------

    /** Bell notification to whoever sent the report. A failure is logged and never undoes the resolve. */
    private function notifyReporter(SupportReport $r): void
    {
        try {
            $reporter = $r->reporter;
            if (! $reporter) {
                return;
            }
            $body = "Your report ({$r->category}) was resolved by your barangay."
                .($r->resolution_note ? " Note: {$r->resolution_note}" : '');

            $reporter->notify($r->reporter_role === 'resident'
                ? new ResidentAlert('report_resolved', 'Your report was resolved', $body, '/report-problem')
                : new StaffAlert('report_resolved', 'Your report was resolved', $body, '/assistant'));
        } catch (\Throwable $e) {
            Log::warning('Report resolved notification failed: '.$e->getMessage());
        }
    }

    private function scoped(Request $request)
    {
        abort_unless($request->user()->barangay_id, 403, 'Your account is not assigned to a barangay.');

        return SupportReport::where('barangay_id', $request->user()->barangay_id);
    }

    private function authorizeReport(Request $request, SupportReport $r): void
    {
        abort_unless((int) $r->barangay_id === (int) $request->user()->barangay_id, 404);
    }
}