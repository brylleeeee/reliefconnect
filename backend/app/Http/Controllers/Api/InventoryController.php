<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Distribution;
use App\Models\DistributionEvent;
use App\Models\Source;
use App\Models\ReliefItem;
use App\Models\StockMovement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * LGU Inventory: relief goods and cash aid, kept separate.
 * Cash funds are tracked in whole pesos with the same ledger as goods,
 * so every peso received, reserved for an event, and released is accounted for.
 */
class InventoryController extends Controller
{
    public function index(Request $request)
    {
        $type = $request->validate(['type' => ['nullable', 'in:goods,cash']])['type'] ?? 'goods';

        $items = ReliefItem::where('type', $type)->orderBy('name')->get()->map(function ($item) {
            // Promised to open distribution events but not yet claimed
            $item->reserved = DistributionEvent::reservedUnits($item->id);
            $item->available = max($item->quantity_in_stock - $item->reserved, 0);

            return $item;
        });

        $releasedThisWeek = (int) Distribution::where('distributed_at', '>=', now()->startOfWeek())
            ->whereHas('item', fn ($q) => $q->where('type', $type))
            ->sum('quantity');

        $stats = $type === 'cash'
            ? [
                'balance' => (int) $items->sum('quantity_in_stock'),
                'reserved' => (int) $items->sum('reserved'),
                'available' => (int) $items->sum('available'),
                'released_to_date' => (int) $items->sum('distributed_to_date'),
                'released_this_week' => $releasedThisWeek,
            ]
            : [
                'item_types' => $items->count(),
                'released_this_week' => $releasedThisWeek,
                'critical_alerts' => $items->where('is_low_stock', true)->count(),
            ];

        return response()->json([
            'type' => $type,
            'stats' => $stats,
            'items' => $items->values(),
            'units' => array_keys(config('relief.units')),
        ]);
    }

    /**
     * "+ Log Incoming Stock" / "+ Record Funds Received":
     * add to an existing item or fund, or create a new one.
     */
    public function logIncoming(Request $request)
    {
        $data = $request->validate([
            'relief_item_id' => ['nullable', 'exists:relief_items,id'],
            'type' => ['nullable', 'in:goods,cash'],
            'name' => ['required_without:relief_item_id', 'nullable', 'string', 'max:150'],
            'contents' => ['nullable', 'string', 'max:255'],
            'unit' => ['nullable', Rule::in(array_keys(config('relief.units')))],
            'reorder_level' => ['nullable', 'integer', 'min:0'],
            'expiry_date' => ['nullable', 'date'],
            'quantity' => ['required', 'integer', 'min:1', 'max:100000000'],
            'source_id' => ['nullable', 'exists:sources,id'],
            'remarks' => ['nullable', 'string', 'max:255'],
        ], [
            'unit.in' => 'Choose a unit from the list.',
            'quantity.min' => 'Enter a quantity or amount of at least 1.',
        ]);

        $type = $data['type'] ?? 'goods';
        if (empty($data['relief_item_id']) && $type === 'goods' && empty($data['unit'])) {
            throw ValidationException::withMessages(['unit' => 'Choose a unit from the list.']);
        }

        $item = DB::transaction(function () use ($data, $request, $type) {
            $item = isset($data['relief_item_id'])
                ? ReliefItem::lockForUpdate()->findOrFail($data['relief_item_id'])
                : ReliefItem::create([
                    'type' => $type,
                    'name' => $data['name'],
                    'contents' => $data['contents'] ?? null,
                    'unit' => $type === 'cash' ? config('relief.cash_unit') : $data['unit'],
                    'reorder_level' => $data['reorder_level'] ?? ($type === 'cash' ? 0 : 50),
                    'expiry_date' => $type === 'cash' ? null : ($data['expiry_date'] ?? null),
                ]);

            $item->increment('quantity_in_stock', $data['quantity']);

            StockMovement::create([
                'relief_item_id' => $item->id,
                'user_id' => $request->user()->id,
                'source_id' => $data['source_id'] ?? null,
                'type' => 'incoming',
                'quantity' => $data['quantity'],
                'remarks' => $data['remarks'] ?? null,
            ]);

            return $item->fresh();
        });

        return response()->json($item, 201);
    }

    /**
     * "Adjust": signed correction (e.g. damaged goods = -10) with a required reason.
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
                    'quantity' => $item->isCash()
                        ? 'Only ₱'.number_format($item->quantity_in_stock).' is in this fund.'
                        : "Only {$item->quantity_in_stock} {$item->unit} are in stock.",
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

    /** Every change to one item or fund: received (with its source), adjusted, released. */
    public function movements(ReliefItem $reliefItem)
    {
        return StockMovement::with(['user:id,name', 'source:id,name,type'])
            ->where('relief_item_id', $reliefItem->id)
            ->latest()->latest('id')
            ->paginate(15);
    }

    /** Source list for the drop-down and the Sources tab, with what each has given. */
    public function sources()
    {
        $given = StockMovement::where('stock_movements.type', 'incoming')->whereNotNull('stock_movements.source_id')
            ->join('relief_items', 'relief_items.id', '=', 'stock_movements.relief_item_id')
            ->selectRaw('stock_movements.source_id, relief_items.type, relief_items.unit, relief_items.name, SUM(stock_movements.quantity) as total, COUNT(*) as times, MAX(stock_movements.created_at) as last_at')
            ->groupBy('stock_movements.source_id', 'relief_items.type', 'relief_items.unit', 'relief_items.name')
            ->get()->groupBy('source_id');

        return response()->json([
            'types' => collect(Source::TYPES)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values(),
            'sources' => Source::orderBy('name')->get()->map(function ($src) use ($given) {
                $rows = $given[$src->id] ?? collect();

                return [
                    'id' => $src->id,
                    'name' => $src->name,
                    'type' => $src->type,
                    'type_label' => $src->type_label,
                    'times_received' => (int) $rows->sum('times'),
                    'last_received' => $rows->max('last_at'),
                    'cash_total' => (int) $rows->where('type', 'cash')->sum('total'),
                    'goods' => $rows->where('type', 'goods')->map(fn ($r) => [
                        'item' => $r->name, 'unit' => $r->unit, 'total' => (int) $r->total,
                    ])->values(),
                ];
            }),
        ]);
    }

    /** "+ Add new source" at the bottom of the drop-down: saved once, then it appears in the list. */
    public function storeSource(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'type' => ['required', Rule::in(array_keys(Source::TYPES))],
        ], ['type.required' => 'Choose whether this is a donation, an LGU fund, or a government allocation.']);
        $name = preg_replace('/\s+/', ' ', trim($data['name']));

        // Reuse an existing source typed with different capitalization instead of duplicating
        $source = Source::whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->first()
            ?? Source::create(['name' => $name, 'type' => $data['type']]);

        return response()->json($source->only(['id', 'name', 'type', 'type_label']), $source->wasRecentlyCreated ? 201 : 200);
    }

    /** Change a source's name or type (e.g. a record that was saved as the wrong type). */
    public function updateSource(Request $request, Source $source)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150', Rule::unique('sources', 'name')->ignore($source->id)],
            'type' => ['required', Rule::in(array_keys(Source::TYPES))],
        ]);
        $source->update(['name' => preg_replace('/\s+/', ' ', trim($data['name'])), 'type' => $data['type']]);

        return response()->json($source->only(['id', 'name', 'type', 'type_label']));
    }
}
