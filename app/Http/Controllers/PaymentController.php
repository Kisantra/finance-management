<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePaymentRequest;
use App\Http\Requests\UpdatePaymentRequest;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class PaymentController extends Controller
{
    public function store(StorePaymentRequest $request, Invoice $invoice): JsonResponse
    {
        $validated = $request->validated();

        if (in_array($invoice->status, ['draft', 'paid'])) {
            return response()->json(['message' => __('Invoice tidak dapat menerima pembayaran.')], 422);
        }

        $nominal = $this->nominal($invoice, $validated);

        if ($error = $this->exceedsRemaining($invoice, $nominal)) {
            return $error;
        }

        $attachmentPath = null;
        $attachmentName = null;

        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $attachmentPath = $file->store('payments', 'public');
            $attachmentName = $file->getClientOriginalName();
        }

        $payment = Payment::create([
            'invoice_id' => $invoice->id,
            ...$nominal,
            'payment_date' => $validated['payment_date'],
            'payment_method' => $validated['payment_method'],
            'bank_account_id' => $validated['bank_account_id'] ?? null,
            'reference_number' => $validated['reference_number'] ?? null,
            'attachment_path' => $attachmentPath,
            'attachment_name' => $attachmentName,
        ]);

        $invoice->updateStatus();

        return response()->json($this->formatPayment($payment->fresh(['bankAccount'])));
    }

    public function update(UpdatePaymentRequest $request, Payment $payment): JsonResponse
    {
        $validated = $request->validated();

        $nominal = $this->nominal($payment->invoice, $validated);

        if ($error = $this->exceedsRemaining($payment->invoice, $nominal, $payment)) {
            return $error;
        }

        $attachmentPath = $payment->attachment_path;
        $attachmentName = $payment->attachment_name;

        if ($request->boolean('remove_attachment') || $request->hasFile('attachment')) {
            if ($payment->attachment_path && Storage::disk('public')->exists($payment->attachment_path)) {
                Storage::disk('public')->delete($payment->attachment_path);
            }
            $attachmentPath = null;
            $attachmentName = null;
        }

        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $attachmentPath = $file->store('payments', 'public');
            $attachmentName = $file->getClientOriginalName();
        }

        $payment->update([
            ...$nominal,
            'payment_date' => $validated['payment_date'],
            'payment_method' => $validated['payment_method'],
            'bank_account_id' => $validated['bank_account_id'] ?? null,
            'reference_number' => $validated['reference_number'] ?? null,
            'attachment_path' => $attachmentPath,
            'attachment_name' => $attachmentName,
        ]);

        $payment->invoice->updateStatus();

        return response()->json($this->formatPayment($payment->fresh(['bankAccount'])));
    }

    public function destroy(Payment $payment): JsonResponse
    {
        $invoice = $payment->invoice;
        $payment->delete();
        $invoice->updateStatus();

        return response()->json(['message' => __('Pembayaran berhasil dihapus.')]);
    }

    /**
     * Nominal yang disimpan. Tagihan USD: USD diterima + kurs saat diterima, Rupiahnya = USD × kurs itu
     * (yang benar-benar masuk ke rekening Rupiah). Tagihan Rupiah: Rupiah apa adanya.
     *
     * @param  array<string, mixed>  $validated
     * @return array{amount: int, foreign_amount: ?float, exchange_rate: ?float}
     */
    private function nominal(Invoice $invoice, array $validated): array
    {
        if (! $invoice->isForeign()) {
            return ['amount' => (int) $validated['amount'], 'foreign_amount' => null, 'exchange_rate' => null];
        }

        $usd = round((float) $validated['foreign_amount'], 2);
        $kurs = round((float) $validated['exchange_rate'], 2);

        return ['amount' => (int) round($usd * $kurs), 'foreign_amount' => $usd, 'exchange_rate' => $kurs];
    }

    /**
     * Pembayaran tidak boleh melebihi sisa tagihan; kelebihan dicatat sebagai transaksi bank terpisah.
     * Tagihan USD dibandingkan dalam USD (Rupiahnya bergantung kurs). $replacing = pembayaran lama yang
     * sedang diedit (nominalnya ikut dihitung sebagai sisa).
     *
     * @param  array{amount: int, foreign_amount: ?float, exchange_rate: ?float}  $nominal
     */
    private function exceedsRemaining(Invoice $invoice, array $nominal, ?Payment $replacing = null): ?JsonResponse
    {
        if ($invoice->isForeign()) {
            $remaining = Invoice::cents($invoice->foreign_remaining) + Invoice::cents($replacing?->foreign_amount);
            if (Invoice::cents($nominal['foreign_amount']) <= $remaining) {
                return null;
            }

            $message = __('Melebihi sisa tagihan USD :sisa. Catat kelebihan sebagai transaksi terpisah.', ['sisa' => number_format($remaining / 100, 2, ',', '.')]);

            return response()->json(['message' => $message, 'errors' => ['foreign_amount' => [$message]]], 422);
        }

        $remaining = $invoice->amount_remaining + (int) $replacing?->amount;
        if ($nominal['amount'] <= $remaining) {
            return null;
        }

        $message = __('Melebihi sisa tagihan Rp :sisa. Catat kelebihan sebagai transaksi terpisah.', ['sisa' => number_format($remaining, 0, ',', '.')]);

        return response()->json(['message' => $message, 'errors' => ['amount' => [$message]]], 422);
    }

    private function formatPayment(Payment $payment): array
    {
        return [
            'id' => $payment->id,
            'amount' => $payment->amount,
            'foreign_amount' => $payment->foreign_amount !== null ? (float) $payment->foreign_amount : null,
            'exchange_rate' => $payment->exchange_rate !== null ? (float) $payment->exchange_rate : null,
            'payment_date' => $payment->payment_date?->format('Y-m-d'),
            'payment_method' => $payment->payment_method,
            'bank_account_id' => $payment->bank_account_id,
            'bank_account_name' => $payment->bankAccount
                ? $payment->bankAccount->account_name.' ('.$payment->bankAccount->bank_name.')'
                : null,
            'reference_number' => $payment->reference_number,
            'attachment_name' => $payment->attachment_name,
            'attachment_url' => $payment->attachment_url,
        ];
    }
}
