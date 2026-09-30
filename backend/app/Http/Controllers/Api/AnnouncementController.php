<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\Request;

class AnnouncementController extends Controller
{
    public function index()
    {
        return Announcement::with('author:id,name')
            ->latest('published_at')
            ->paginate(10);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        $announcement = Announcement::create($data + [
            'user_id' => $request->user()->id,
            'published_at' => now(),
        ]);

        // TODO (Sprint 4): push to resident app + send via SMS gateway

        return response()->json($announcement, 201);
    }

    public function update(Request $request, Announcement $announcement)
    {
        $announcement->update($this->validated($request));

        return $announcement;
    }

    public function destroy(Announcement $announcement)
    {
        $announcement->delete();

        return response()->noContent();
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'description' => ['required', 'string', 'max:2000'],
            'category' => ['nullable', 'string', 'max:50'],
        ]);
    }
}
