<?php

namespace App\Http\Controllers\Api\Resident;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

/** Resident app: the bell icon. In-app notifications, newest first. */
class NotificationController extends Controller
{
    private const LIMIT = 50;

    public function index(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'unread' => $user->unreadNotifications()->count(),
            'notifications' => $user->notifications()->latest()->take(self::LIMIT)->get()->map(fn ($n) => [
                'id' => $n->id,
                'kind' => $n->data['kind'] ?? 'announcement',
                'title' => $n->data['title'] ?? '',
                'body' => $n->data['body'] ?? '',
                'link' => $n->data['link'] ?? '/home',
                'read' => $n->read_at !== null,
                'created_at' => $n->created_at,
            ]),
        ]);
    }

    /** Badge only: cheap enough to call whenever a screen opens. */
    public function unread(Request $request)
    {
        return response()->json(['unread' => $request->user()->unreadNotifications()->count()]);
    }

    /** Marks the given notifications as read, or all of them when no ids are sent. */
    public function read(Request $request)
    {
        $data = $request->validate(['ids' => ['nullable', 'array', 'max:100'], 'ids.*' => ['string']]);

        $request->user()->unreadNotifications()
            ->when(! empty($data['ids']), fn ($q) => $q->whereIn('id', $data['ids']))
            ->update(['read_at' => now()]);

        return response()->json(['unread' => $request->user()->unreadNotifications()->count()]);
    }
}
