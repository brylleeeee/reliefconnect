<?php

namespace App\Http\Controllers\Api\Distribution;

use App\Http\Controllers\Controller;
use App\Models\BarangayDistribution;
use App\Models\DistributionEvent;
use App\Models\Household;
use App\Services\DistributionEventService;
use Illuminate\Http\Request;

/**
 * Distribution Personnel (mobile app). Ready for when the scanner is connected.
 */
class ClaimController extends Controller
{
    public function __construct(private DistributionEventService $service) {}

    /**
     * Barangay distributions running right now, i.e. where claims can be recorded.
     * Staff assigned to a barangay only see their own barangay's.
     */
    public function events(Request $request)
    {
        return BarangayDistribution::with(['event.item', 'barangay:id,name'])
            ->when($request->user()->barangay_id, fn ($q, $id) => $q->where('barangay_id', $id))
            ->where('status', 'ongoing')
            ->whereHas('event', fn ($q) => $q->where('status', 'open'))
            ->orderBy('started_at')
            ->get()
            ->map(fn ($bd) => [
                'event_id' => $bd->distribution_event_id,
                'name' => $bd->event->name,
                'barangay_id' => $bd->barangay_id,
                'barangay' => $bd->barangay->name,
                'quota' => $bd->quota,
                'claimed' => $bd->claimedCount(),
                'venue' => $bd->venue,
                'item' => $bd->event->item->name,
                'unit' => $bd->event->item->unit,
                'quantity_per_household' => $bd->event->quantity_per_household,
                // e.g. "Households with a senior citizen (60+)"; per_member = amount is per senior
                'eligibility' => $bd->event->eligibility_label,
                'per_member' => $bd->event->per_member,
                'notes' => $bd->event->notes,
            ]);
    }

    /** Offline mode: the household list a staff phone downloads while online. */
    public function offlinePack(Request $request, DistributionEvent $event)
    {
        $data = $request->validate(['barangay_id' => ['required', 'integer']]);

        $this->ensureOwnBarangay($request, (int) $data['barangay_id']);

        return $this->service->offlinePack($event, (int) $data['barangay_id']);
    }

    /**
     * Step 1 after scanning: show the household and whether it can claim.
     * Send "qr" (the scanned text, token checked) or "reference_number" (manual entry).
     */
    public function check(Request $request, DistributionEvent $event)
    {
        $data = $request->validate([
            'qr' => ['required_without:reference_number', 'nullable', 'string', 'max:120'],
            'reference_number' => ['required_without:qr', 'nullable', 'string', 'max:30'],
        ]);

        $reference = $this->reference($data);
        $this->ensureOwnHousehold($request, $reference);

        return $this->service->check($event, $reference);
    }

    /** Step 2: staff confirms the release. A QR claim re-checks the token. */
    public function store(Request $request, DistributionEvent $event)
    {
        $data = $request->validate([
            'qr' => ['required_without:reference_number', 'nullable', 'string', 'max:120'],
            'reference_number' => ['required_without:qr', 'nullable', 'string', 'max:30'],
            'synced_from_offline' => ['boolean'],
            'distributed_at' => ['nullable', 'date', 'before_or_equal:now'],
        ]);

        // The method follows what was sent, so a claim is only marked "QR" if a valid QR was scanned
        $data['verification_method'] = isset($data['qr']) ? 'qr' : 'reference_number';

        $reference = $this->reference($data);
        $this->ensureOwnHousehold($request, $reference);

        $claim = $this->service->claim($event, $reference, $request->user(), $data);

        return response()->json(['message' => 'Claim recorded.', 'claim' => $claim], 201);
    }

    /** Staff assigned to a barangay can only serve that barangay. */
    private function ensureOwnBarangay(Request $request, int $barangayId): void
    {
        $own = $request->user()->barangay_id;
        abort_if($own && (int) $own !== $barangayId, 403, 'You can only serve your own barangay\'s distribution.');
    }

    private function ensureOwnHousehold(Request $request, string $reference): void
    {
        $barangayId = Household::where('reference_number', strtoupper(trim($reference)))->value('barangay_id');
        if ($barangayId) {
            $own = $request->user()->barangay_id;
            abort_if($own && (int) $own !== (int) $barangayId, 403,
                'This household is from another barangay. Only that barangay\'s staff can release its aid.');
        }
    }

    private function reference(array $data): string
    {
        return isset($data['qr'])
            ? $this->service->referenceFromQr($data['qr'])
            : $data['reference_number'];
    }
}
