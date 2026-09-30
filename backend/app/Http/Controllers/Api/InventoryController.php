<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Distribution;
use App\Models\ReliefItem;
use App\Models\StockMovement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryController extends Controller
{
    public function index()
    {
        $items = ReliefItem::orderBy('name')->get();

        return response()->json([
            'stats' => [
                'total_ready' => (int) $items->sum('quantity_in_stock'),
                'distributed_this_week' => (int) Distribution::where('distributed_at', '>=', now()->startOfWeek())
                    ->sum('quantity'),
                'critical_alerts' => $items->where('is_low_stock', true)->count(),
            ],
            'items' => $items,
        ]);
    }

    /**
     * "+ Log Incoming Stock": add to an existing item, or create a new item.
     */
    public function logIncoming(Request $request)
    {
        $data = $request->validate([
            'relief_item_id' => ['nullable', 'exists:relief_items,id'],
            'name' => ['required_without:relief_item_id', 'nullable', 'string', 'max:150'],
            'contents' => ['nullable', 'string', 'max:255'],
            'unit' => ['required_without:relief_item_id', 'nullable', 'string', 'max:30'],
            'reorder_level' => ['nullable', 'integer', 'min:0'],
            'expiry_date' => ['nullable', 'date'],
            'quantity' => ['required', 'integer', 'min:1'],
            'source' => ['nullable', 'string', 'max:150'],
        ]);

        $item = DB::transaction(function () use ($data, $request) {
            $item = isset($data['relief_item_id'])
                ? ReliefItem::lockForUpdate()->findOrFail($data['relief_item_id'])
                : ReliefItem::create([
                    'name' => $data['name'],
                    'contents' => $data['contents'] ?? null,
                    'unit' => $data['unit'],
                    'reorder_level' => $data['reorder_level'] ?? 50,
                    'expiry_date' => $data['expiry_date'] ?? null,
                ]);

            $item->increment('quantity_in_stock', $data['quantity']);

            StockMovement::create([
                'relief_item_id' => $item->id,
                'user_id' => $request->user()->id,
                'type' => 'incoming',
                'quantity' => $data['quantity'],
                'source' => $data['source'] ?? null,
            ]);

            return $item->fresh();
        });

        return response()->json($item, 201);
    }

    /**
     * "Adjust Stock": signed correction (e.g. damaged goods = -10) with a required reason.
     */
    public function adjust(Request $request, ReliefItem $reliefItem)
    {
        $data = $request->validate([
            'quantity' => ['required', 'integer', 'not_in:0'],
            'remarks' => ['required', 'string', 'max:255'],
            'reorder_level' => ['nullable', 'integer', 'min:0'],
        ]);

        $item = DB::transaction(function () use ($data, $request, $reliefItem) {
            $item = ReliefItem::lockForUpdate()->findOrFail($reliefItem->id);

            $newQty = $item->quantity_in_stock + $data['quantity'];
            if ($newQty < 0) {
                throw ValidationException::withMessages([
                    'quantity' => "Only {$item->quantity_in_stock} {$item->unit} are in stock.",
                ]);
            }

            $item->quantity_in_stock = $newQty;
            if (isset($data['reorder_level'])) {
                $item->reorder_level = $data['reorder_level'];
            }
            $item->save();

            StockMovement::create([
                'relief_item_id' => $item->id,
                'user_id' => $request->user()->id,
                'type' => 'adjustment',
                'quantity' => $data['quantity'],
                'remarks' => $data['remarks'],
            ]);

            return $item;
        });

        return response()->json($item);
    }
}
