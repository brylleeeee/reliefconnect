<?php

namespace App\Http\Controllers\Api\Distribution;

use App\Http\Controllers\Controller;
use App\Models\BarangayDistribution;
use App\Models\DistributionEvent;
use App\Services\DistributionEventService;
use Illuminate\Http\Request;

/**
 * Distribution Personnel (mobile app). Ready for when the scanner is connected.
 */
class ClaimController extends Controller
{
    public function __construct(private DistributionEventService $service) {}

    /** Barangay distributions running right now, i.e. where claims can be recorded. */
    public function events()
    {
        return BarangayDistribution::with(['event.item', 'barangay:id,name'])
            ->where('status', 'ongoing')
            ->whereHas('event', fn ($q) => $q->where('status', 'open'))
            ->orderBy('started_at')
            ->get()
            ->map(fn ($bd) => [
                'event_id' => $bd->distribution_event_id,
                'name' => $bd->event->name,
                'barangay' => $bd->barangay->name,
                'venue' => $bd->venue,
                'item' => $bd->event->item->name,
                'unit' => $bd->event->item->unit,
                'quantity_per_household' => $bd->event->quantity_per_household,
                'notes' => $bd->event->notes,
            ]);
    }

    /** Step 1 after scanning: show the household and whether it can claim. */
    public function check(Request $request, DistributionEvent $event)
    {
        $data = $request->validate(['reference_number' => ['required', 'string', 'max:30']]);

        return $this->service->check($event, $data['reference_number']);
    }

    /** Step 2: staff confirms the release. */
    public function store(Request $request, DistributionEvent $event)
    {
        $data = $request->validate([
            'reference_number' => ['required', 'string', 'max:30'],
            'verification_method' => ['required', 'in:qr,reference_number'],
            'synced_from_offline' => ['boolean'],
            'distributed_at' => ['nullable', 'date', 'before_or_equal:now'],
        ]);

        $claim = $this->service->claim($event, $data['reference_number'], $request->user(), $data);

        return response()->json(['message' => 'Claim recorded.', 'claim' => $claim], 201);
    }
}
