<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\Barangay;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * LGU Admin: announcements to barangays. Each barangay then relays
 * to its own residents, and the LGU sees which barangays have done so.
 */
class AnnouncementController extends Controller
{
    public function index()
    {
        $totalBarangays = Barangay::count();

        $page = Announcement::fromLgu()
            ->with(['author:id,name', 'targetBarangays:id,name', 'relays:id,source_announcement_id,barangay_id'])
            ->latest('published_at')->latest('id')
            ->paginate(10);

        $page->getCollection()->transform(function ($a) use ($totalBarangays) {
            $a->target_count = $a->targetBarangays->count() ?: $totalBarangays;
            $a->relayed_count = $a->relays->pluck('barangay_id')->unique()->count();
            $a->unsetRelation('relays');

            return $a;
        });

        return $page;
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        $announcement = DB::transaction(function () use ($data, $request) {
            $a = Announcement::create(collect($data)->except('barangay_ids')->all() + [
                'user_id' => $request->user()->id,
                'published_at' => now(),
            ]);
            $a->targetBarangays()->sync($data['barangay_ids'] ?? []);

            return $a;
        });

        return response()->json($announcement->load('targetBarangays:id,name'), 201);
    }

    public function update(Request $request, Announcement $announcement)
    {
        abort_unless($announcement->barangay_id === null, 404);
        $data = $this->validated($request);

        $announcement->update(collect($data)->except('barangay_ids')->all());
        $announcement->targetBarangays()->sync($data['barangay_ids'] ?? []);

        return $announcement->load('targetBarangays:id,name');
    }

    public function destroy(Announcement $announcement)
    {
        abort_unless($announcement->barangay_id === null, 404);
        $announcement->delete();

        return response()->noContent();
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'description' => ['required', 'string', 'max:2000'],
            'category' => ['nullable', 'string', 'max:50'],
            'barangay_ids' => ['nullable', 'array'],          // empty = all barangays
            'barangay_ids.*' => ['integer', 'distinct', 'exists:barangays,id'],
        ]);
    }
}
