<?php

namespace App\Http\Controllers\Api\Barangay;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\DistributionEvent;
use Illuminate\Http\Request;

/**
 * Barangay Admin: reads LGU announcements for their barangay and announces
 * to their own residents, either relaying an LGU announcement or writing their own.
 */
class AnnouncementController extends Controller
{
    public function index(Request $request)
    {
        $barangayId = $this->barangayId($request);

        $relayed = Announcement::where('barangay_id', $barangayId)
            ->whereNotNull('source_announcement_id')
            ->pluck('source_announcement_id')->flip();

        $fromLgu = Announcement::forBarangay($barangayId)
            ->with('author:id,name')
            ->latest('published_at')->latest('id')->take(20)->get()
            ->map(function ($a) use ($relayed) {
                $a->relayed = $relayed->has($a->id);

                return $a;
            });

        $mine = Announcement::where('barangay_id', $barangayId)
            ->with('author:id,name')
            ->latest('published_at')->latest('id')->take(30)->get();

        return response()->json(['from_lgu' => $fromLgu, 'mine' => $mine]);
    }

    public function store(Request $request)
    {
        $barangayId = $this->barangayId($request);
        $data = $this->validated($request, $barangayId);

        $announcement = Announcement::create($data + [
            'user_id' => $request->user()->id,
            'barangay_id' => $barangayId,
            'category' => 'Barangay Advisory',
            'published_at' => now(),
        ]);

        // TODO (mobile): push / SMS to this barangay's residents

        return response()->json($announcement, 201);
    }

    public function update(Request $request, Announcement $announcement)
    {
        $barangayId = $this->own($request, $announcement);
        $announcement->update(collect($this->validated($request, $barangayId))->only(['title', 'description'])->all());

        return $announcement;
    }

    public function destroy(Request $request, Announcement $announcement)
    {
        $this->own($request, $announcement);
        $announcement->delete();

        return response()->noContent();
    }

    private function validated(Request $request, int $barangayId): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'description' => ['required', 'string', 'max:2000'],
            'source_announcement_id' => ['nullable', 'integer'],
            'distribution_event_id' => ['nullable', 'integer', 'exists:distribution_events,id'],
        ]);

        // Can only relay an LGU announcement that was sent to this barangay
        if (! empty($data['source_announcement_id'])) {
            abort_unless(Announcement::forBarangay($barangayId)->whereKey($data['source_announcement_id'])->exists(),
                422, 'That LGU announcement was not sent to your barangay.');
        }
        // Can only link an event that includes this barangay
        if (! empty($data['distribution_event_id'])) {
            abort_unless(DistributionEvent::find($data['distribution_event_id'])?->forBarangay($barangayId),
                422, 'That event does not include your barangay.');
        }

        return $data;
    }

    private function own(Request $request, Announcement $announcement): int
    {
        $barangayId = $this->barangayId($request);
        abort_unless($announcement->barangay_id === $barangayId, 404);

        return $barangayId;
    }

    private function barangayId(Request $request): int
    {
        abort_unless($request->user()->barangay_id, 403, 'Your account is not assigned to a barangay.');

        return (int) $request->user()->barangay_id;
    }
}
