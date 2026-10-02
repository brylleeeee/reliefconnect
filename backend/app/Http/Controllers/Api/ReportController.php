<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Distribution;
use App\Models\Household;
use App\Models\ReliefItem;
use App\Models\StockMovement;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ReportController extends Controller
{
    public function generate(Request $request, string $type)
    {
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
            'format' => ['required', 'in:csv,pdf'],
        ]);

        $from = Carbon::parse($data['from'])->startOfDay();
        $to = Carbon::parse($data['to'])->endOfDay();

        [$title, $headers, $rows] = match ($type) {
            'beneficiary' => $this->beneficiary($from, $to),
            'inventory' => $this->inventory($from, $to),
            'distribution' => $this->distribution($from, $to),
        };

        $filename = sprintf('%s-report_%s_to_%s', $type, $from->toDateString(), $to->toDateString());

        if ($data['format'] === 'csv') {
            return response()->streamDownload(function () use ($headers, $rows) {
                $out = fopen('php://output', 'w');
                fwrite($out, "\xEF\xBB\xBF"); // UTF-8 BOM so Excel shows ñ correctly
                fputcsv($out, $headers);
                foreach ($rows as $row) {
                    fputcsv($out, $row);
                }
                fclose($out);
            }, "$filename.csv", ['Content-Type' => 'text/csv; charset=UTF-8']);
        }

        return Pdf::loadView('reports.pdf', [
            'title' => $title,
            'headers' => $headers,
            'rows' => $rows,
            'from' => $from,
            'to' => $to,
            'generatedBy' => $request->user()->name,
        ])->setPaper('a4', 'landscape')->download("$filename.pdf");
    }

    private function beneficiary(Carbon $from, Carbon $to): array
    {
        $rows = Household::with('barangay')
            ->where('status', 'approved')
            ->whereBetween('approved_at', [$from, $to])
            ->orderBy('barangay_id')->orderBy('purok')
            ->get()
            ->map(fn ($h) => [
                $h->reference_number, $h->household_head, $h->barangay->name, $h->purok,
                $h->members_count, $h->seniors_count, $h->pwd_count, $h->infants_count,
                $h->pregnant_count, $h->approved_at?->format('Y-m-d'),
            ])->all();

        return ['Beneficiary Report', [
            'Reference No.', 'Household Head', 'Barangay', 'Purok', 'Members',
            'Seniors', 'PWDs', 'Infants', 'Pregnant', 'Approved On',
        ], $rows];
    }

    private function inventory(Carbon $from, Carbon $to): array
    {
        $incoming = StockMovement::where('type', 'incoming')
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('relief_item_id, SUM(quantity) as total')
            ->groupBy('relief_item_id')
            ->pluck('total', 'relief_item_id');

        $rows = ReliefItem::orderBy('name')->get()->map(fn ($i) => [
            $i->name, $i->unit, (int) ($incoming[$i->id] ?? 0), $i->quantity_in_stock,
            $i->distributed_to_date, $i->reorder_level,
            $i->is_low_stock ? 'LOW STOCK' : 'OK',
            $i->expiry_date?->format('Y-m-d') ?? '',
        ])->all();

        return ['Inventory Report', [
            'Item', 'Unit', 'Received in Period', 'In Stock', 'Distributed to Date',
            'Reorder Level', 'Stock Status', 'Expiry Date',
        ], $rows];
    }

    private function distribution(Carbon $from, Carbon $to): array
    {
        $rows = Distribution::with(['household.barangay', 'item', 'personnel'])
            ->whereBetween('distributed_at', [$from, $to])
            ->orderBy('distributed_at')
            ->get()
            ->map(fn ($d) => [
                $d->distributed_at->format('Y-m-d H:i'), $d->household->reference_number,
                $d->household->household_head, $d->household->barangay->name,
                $d->item->name, $d->quantity,
                $d->verification_method === 'qr' ? 'QR Scan' : 'Reference No.',
                $d->personnel->name, $d->synced_from_offline ? 'Yes' : 'No',
            ])->all();

        return ['Distribution Report', [
            'Date & Time', 'Reference No.', 'Household Head', 'Barangay', 'Item',
            'Qty', 'Verified By', 'Released By', 'Offline Sync',
        ], $rows];
    }
}
