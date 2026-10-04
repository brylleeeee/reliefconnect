<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Distribution;
use App\Models\DistributionEvent;
use App\Models\Household;
use App\Models\ReliefItem;
use App\Models\StockMovement;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Reports page. Every report is built once as { title, summary, headers, rows }, then:
 *   json -> preview table on the page, and the Excel (.xlsx) file built in the browser
 *   csv  -> spreadsheet download
 *   pdf  -> printable report
 */
class ReportController extends Controller
{
    public const TYPES = ['beneficiary', 'inventory', 'distribution', 'cash', 'sources'];

    public function generate(Request $request, string $type)
    {
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
            'format' => ['required', 'in:json,csv,pdf'],
            'event_id' => ['nullable', 'integer', 'exists:distribution_events,id'],
        ]);

        $from = Carbon::parse($data['from'])->startOfDay();
        $to = Carbon::parse($data['to'])->endOfDay();
        $eventId = $data['event_id'] ?? null;

        $report = match ($type) {
            'beneficiary' => $this->beneficiary($from, $to),
            'inventory' => $this->inventory($from, $to),
            'distribution' => $this->distribution($from, $to, $eventId),
            'cash' => $this->cash($from, $to, $eventId),
            'sources' => $this->sources($from, $to),
        };

        $filename = sprintf('%s-report_%s_to_%s', $type, $from->toDateString(), $to->toDateString());

        if ($data['format'] === 'json') {
            return response()->json($report + [
                'filename' => $filename,
                'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
                'generated_by' => $request->user()->name,
                'generated_at' => now(),
            ]);
        }

        if ($data['format'] === 'csv') {
            return response()->streamDownload(function () use ($report) {
                $out = fopen('php://output', 'w');
                fwrite($out, "\xEF\xBB\xBF"); // UTF-8 BOM so Excel shows ñ and ₱ correctly
                fputcsv($out, $report['headers']);
                foreach ($report['rows'] as $row) {
                    fputcsv($out, $row);
                }
                fclose($out);
            }, "$filename.csv", ['Content-Type' => 'text/csv; charset=UTF-8']);
        }

        return Pdf::loadView('reports.pdf', $report + [
            'from' => $from,
            'to' => $to,
            'generatedBy' => $request->user()->name,
        ])->setPaper('a4', 'landscape')->download("$filename.pdf");
    }

    private function beneficiary(Carbon $from, Carbon $to): array
    {
        $households = Household::with('barangay')
            ->where('status', 'approved')
            ->whereBetween('approved_at', [$from, $to])
            ->orderBy('barangay_id')->orderBy('purok')
            ->get();

        return [
            'title' => 'Beneficiary Report',
            'summary' => [
                'Households approved' => number_format($households->count()),
                'Members' => number_format($households->sum('members_count')),
                'High priority' => number_format($households->where('priority_level', 'high')->count()),
                'Seniors / PWDs' => number_format($households->sum('seniors_count')).' / '.number_format($households->sum('pwd_count')),
            ],
            'headers' => ['Reference No.', 'Household Head', 'Barangay', 'Purok', 'Members',
                'Seniors', 'PWDs', 'Infants', 'Pregnant', 'Priority', 'Approved On'],
            'rows' => $households->map(fn ($h) => [
                $h->reference_number, $h->household_head, $h->barangay->name, $h->purok,
                $h->members_count, $h->seniors_count, $h->pwd_count, $h->infants_count,
                $h->pregnant_count, ucfirst($h->priority_level), $h->approved_at?->format('Y-m-d'),
            ])->all(),
        ];
    }

    /** Relief goods only. Cash funds have their own report. */
    private function inventory(Carbon $from, Carbon $to): array
    {
        $items = ReliefItem::goods()->orderBy('name')->get();
        $ids = $items->pluck('id');

        $incoming = StockMovement::where('type', 'incoming')->whereIn('relief_item_id', $ids)
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('relief_item_id, SUM(quantity) as total')->groupBy('relief_item_id')
            ->pluck('total', 'relief_item_id');
        // Releases come from the claim records, the same source every other page uses
        $released = Distribution::whereIn('relief_item_id', $ids)
            ->whereBetween('distributed_at', [$from, $to])
            ->selectRaw('relief_item_id, SUM(quantity) as total')->groupBy('relief_item_id')
            ->pluck('total', 'relief_item_id');

        return [
            'title' => 'Inventory Report (Relief Goods)',
            'summary' => [
                'Item types' => $items->count(),
                'Low stock items' => $items->where('is_low_stock', true)->count(),
                'Received in period' => number_format($incoming->sum()).' units',
                'Released in period' => number_format($released->sum()).' units',
            ],
            'headers' => ['Item', 'Unit', 'Received in Period', 'Released in Period', 'Reserved for Events',
                'In Stock', 'Available', 'Distributed to Date', 'Reorder Level', 'Status', 'Expiry Date'],
            'rows' => $items->map(function ($i) use ($incoming, $released) {
                $reserved = DistributionEvent::reservedUnits($i->id);

                return [
                    $i->name, $i->unit, (int) ($incoming[$i->id] ?? 0), (int) ($released[$i->id] ?? 0),
                    $reserved, $i->quantity_in_stock, max($i->quantity_in_stock - $reserved, 0),
                    $i->distributed_to_date, $i->reorder_level,
                    $i->is_low_stock ? 'LOW STOCK' : 'OK', $i->expiry_date?->format('Y-m-d') ?? '',
                ];
            })->all(),
        ];
    }

    /** Claims of relief goods (cash claims are in the cash report). */
    private function distribution(Carbon $from, Carbon $to, ?int $eventId): array
    {
        $claims = Distribution::with(['household.barangay', 'item', 'personnel', 'event'])
            ->whereHas('item', fn ($q) => $q->where('type', 'goods'))
            ->whereBetween('distributed_at', [$from, $to])
            ->when($eventId, fn ($q) => $q->where('distribution_event_id', $eventId))
            ->orderBy('distributed_at')
            ->get();

        return [
            'title' => 'Distribution Report (Relief Goods)',
            'summary' => [
                'Claims' => number_format($claims->count()),
                'Households served' => number_format($claims->pluck('household_id')->unique()->count()),
                'Verified by QR' => number_format($claims->where('verification_method', 'qr')->count()),
                'Recorded offline' => number_format($claims->where('synced_from_offline', true)->count()),
            ],
            'headers' => ['Date & Time', 'Event', 'Reference No.', 'Household Head', 'Barangay', 'Item',
                'Qty', 'Verified By', 'Released By', 'Offline Sync'],
            'rows' => $claims->map(fn ($d) => [
                $d->distributed_at->format('Y-m-d H:i'), $d->event?->name ?? '', $d->household->reference_number,
                $d->household->household_head, $d->household->barangay->name,
                $d->item->name, $d->quantity,
                $d->verification_method === 'qr' ? 'QR Scan' : 'Reference No.',
                $d->personnel->name, $d->synced_from_offline ? 'Yes' : 'No',
            ])->all(),
        ];
    }

    /**
     * Cash aid: where the money is (each fund's balance and what open events have reserved),
     * how much came in, and every peso released to a household.
     */
    private function cash(Carbon $from, Carbon $to, ?int $eventId): array
    {
        $funds = ReliefItem::cash()->orderBy('name')->get();
        $received = StockMovement::where('type', 'incoming')->whereIn('relief_item_id', $funds->pluck('id'))
            ->whereBetween('created_at', [$from, $to])->sum('quantity');

        $releases = Distribution::with(['household.barangay', 'item', 'personnel', 'event'])
            ->whereIn('relief_item_id', $funds->pluck('id'))
            ->whereBetween('distributed_at', [$from, $to])
            ->when($eventId, fn ($q) => $q->where('distribution_event_id', $eventId))
            ->orderBy('distributed_at')
            ->get();

        $reserved = $funds->sum(fn ($f) => DistributionEvent::reservedUnits($f->id));
        $peso = fn ($n) => '₱'.number_format($n);

        return [
            'title' => 'Cash Aid Report',
            'summary' => [
                'Fund balance (now)' => $peso($funds->sum('quantity_in_stock')),
                'Reserved for open events' => $peso($reserved),
                'Received in period' => $peso($received),
                'Released in period' => $peso($releases->sum('quantity')).' to '.number_format($releases->pluck('household_id')->unique()->count()).' households',
            ],
            'headers' => ['Date & Time', 'Fund', 'Event', 'Reference No.', 'Household Head', 'Barangay',
                'Amount (PHP)', 'Verified By', 'Released By'],
            'rows' => $releases->map(fn ($d) => [
                $d->distributed_at->format('Y-m-d H:i'), $d->item->name, $d->event?->name ?? '',
                $d->household->reference_number, $d->household->household_head, $d->household->barangay->name,
                $d->quantity, $d->verification_method === 'qr' ? 'QR Scan' : 'Reference No.', $d->personnel->name,
            ])->all(),
        ];
    }

    /**
     * Where relief came from, and when: each delivery of goods or cash by source,
     * split into donations, LGU funds and government allocations.
     */
    private function sources(Carbon $from, Carbon $to): array
    {
        $rows = StockMovement::with(['source', 'item', 'user'])
            ->where('type', 'incoming')
            ->whereBetween('created_at', [$from, $to])
            ->orderBy('created_at')
            ->get();

        // "Donations: 3 (P50,000 cash)" style summary per source type
        $byType = fn (string $type) => $rows->filter(fn ($m) => $m->source?->type === $type);
        $describe = function ($moves) {
            $cash = $moves->filter(fn ($m) => $m->item->isCash())->sum('quantity');
            $goods = $moves->reject(fn ($m) => $m->item->isCash())->sum('quantity');

            return number_format($goods).' units'.($cash ? ' + ₱'.number_format($cash) : '');
        };

        return [
            'title' => 'Sources of Relief Report',
            'summary' => [
                'Donations' => $describe($byType('donation')),
                'LGU funds' => $describe($byType('lgu_fund')),
                'Government allocations' => $describe($byType('government_allocation')),
                'Received' => ($n = $rows->count()).($n === 1 ? ' delivery' : ' deliveries').' from '
                    .($m = $rows->pluck('source_id')->filter()->unique()->count()).($m === 1 ? ' source' : ' sources'),
            ],
            'headers' => ['Date', 'Source', 'Source Type', 'Kind', 'Item / Fund', 'Quantity / Amount', 'Unit', 'Logged By', 'Remarks'],
            'rows' => $rows->map(fn ($m) => [
                $m->created_at->format('Y-m-d'), $m->source?->name ?? 'Not recorded', $m->source?->type_label ?? '',
                $m->item->isCash() ? 'Cash' : 'Goods', $m->item->name, $m->quantity,
                $m->item->isCash() ? 'PHP' : $m->item->unit, $m->user?->name ?? '', $m->remarks ?? '',
            ])->all(),
        ];
    }
}
