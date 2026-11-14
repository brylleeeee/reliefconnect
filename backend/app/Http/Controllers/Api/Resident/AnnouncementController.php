<?php

namespace App\Http\Controllers\Api\Resident;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\Distribution;
use App\Models\Household;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Resident app (mobile): residents only see announcements from their own barangay.
 * LGU announcements reach them when their barangay relays them.
 */
class AnnouncementController extends Controller
{
    public function index(Request $request)
    {
        $household = Household::where('user_id', $request->user()->id)->first();
        abort_unless($household, 404, 'Register your household first to receive announcements.');

        // The app asks for up to 100 and pages them on the phone; older app builds still get 20
        $perPage = min(100, max(1, (int) $request->query('per_page', 20)));

        $page = Announcement::where('barangay_id', $household->barangay_id)
            ->with(['barangay:id,name', 'distributionEvent.item'])
            ->latest('published_at')->latest('id')
            ->paginate($perPage);

        // Announcements about a distribution: add the real details (when, where, what this household gets),
        // so the app can show them as clear facts instead of only the free-text message
        $claims = Distribution::where('household_id', $household->id)
            ->whereIn('distribution_event_id', $page->getCollection()->pluck('distribution_event_id')->filter()->unique())
            ->pluck('distributed_at', 'distribution_event_id');

        $page->getCollection()->transform(function (Announcement $a) use ($household, $claims) {
            $a->setAttribute('distribution', $this->distributionFacts($a, $household, $claims));
            $a->unsetRelation('distributionEvent');

            return $a;
        });

        return $page;
    }

    private function distributionFacts(Announcement $a, Household $household, $claims): ?array
    {
        $event = $a->distributionEvent;
        if (! $event || ! $event->item) {
            return null;
        }

        $local = $event->forBarangay($household->barangay_id);
        $qty = $event->quantityFor($household);
        $claimedAt = $claims[$event->id] ?? null;

        return [
            'event' => $event->name,
            'item' => $event->item->name,
            'contents' => $event->item->contents,
            'is_cash' => $event->item->isCash(),
            'you_get' => $qty > 0 ? $event->item->describeQuantity($qty) : null, // null: not eligible
            'who_can_claim' => $event->eligibility_label,
            // unscheduled | scheduled | ongoing | closed (closed also when the whole event is closed)
            'status' => $event->status === 'closed' ? 'closed' : ($local?->status ?? 'unscheduled'),
            'scheduled_at' => $local?->scheduled_at?->toIso8601String(),
            'venue' => $local?->venue,
            'claim_by' => $event->distribute_by?->toDateString(),
            'notes' => $event->notes,
            'claimed_at' => $claimedAt ? Carbon::parse($claimedAt)->toIso8601String() : null,
        ];
    }
}
