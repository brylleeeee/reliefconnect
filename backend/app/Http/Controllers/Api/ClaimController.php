<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Distribution;
use App\Models\DistributionEvent;
use App\Support\ClaimDetails;
use Illuminate\Http\Request;

/** LGU Admin: every claim of an event, and the full details of one claim. */
class ClaimController extends Controller
{
    public function index(Request $request, DistributionEvent $event)
    {
        $f = $request->validate([
            'barangay_id' => ['nullable', 'integer'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $event->loadMissing('item');

        $page = Distribution::with(['household:id,reference_number,household_head,barangay_id,purok', 'household.barangay:id,name', 'personnel:id,name'])
            ->where('distribution_event_id', $event->id)
            ->when($f['barangay_id'] ?? null, fn ($q, $id) => $q->whereHas('household', fn ($h) => $h->where('barangay_id', $id)))
            // Grouped so the OR can't escape the household match
            ->when($f['search'] ?? null, fn ($q, $s) => $q->whereHas('household', fn ($h) => $h->where(fn ($w) => $w
                ->where('household_head', 'like', "%$s%")->orWhere('reference_number', 'like', "%$s%"))))
            ->latest('distributed_at')->latest('id')
            ->paginate(15)->withQueryString();

        $page->getCollection()->transform(fn ($d) => [
            'id' => $d->id,
            'distributed_at' => $d->distributed_at,
            'reference_number' => $d->household->reference_number,
            'household_head' => $d->household->household_head,
            'barangay' => $d->household->barangay->name,
            'purok' => $d->household->purok,
            'quantity_label' => $event->item->describeQuantity($d->quantity),
            'verification_method' => $d->verification_method,
            'synced_from_offline' => $d->synced_from_offline,
            'released_by' => $d->personnel?->name,
        ]);

        return $page;
    }

    public function show(Distribution $distribution)
    {
        return response()->json(ClaimDetails::for($distribution));
    }
}
