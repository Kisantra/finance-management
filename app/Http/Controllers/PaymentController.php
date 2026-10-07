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
            return response()->json(['message' => 'Invoice tidak dapat menerima pembayaran.'], 422);
        }

        if ($error = $this->exceedsRemaining($invoice, (int) $validated['amount'])) {
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
            'amount' => $validated['amount'],
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

        if ($error = $this->exceedsRemaining($payment->invoice, (int) $validated['amount'], $payment->amount)) {
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
            'amount' => $validated['amount'],
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

        return response()->json(['message' => 'Pembayaran berhasil dihapus.']);
    }

    /**
     * Pembayaran tidak boleh melebihi sisa tagihan; kelebihan dicatat sebagai transaksi bank terpisah.
     * $replacing = nominal pembayaran lama yang sedang diedit (ikut dihitung sebagai sisa).
     */
    private function exceedsRemaining(Invoice $invoice, int $amount, int $replacing = 0): ?JsonResponse
    {
        $remaining = $invoice->amount_remaining + $replacing;
        if ($amount <= $remaining) {
            return null;
        }

        $message = 'Melebihi sisa tagihan Rp '.number_format($remaining, 0, ',', '.').'. Catat kelebihan sebagai transaksi terpisah.';

        return response()->json(['message' => $message, 'errors' => ['amount' => [$message]]], 422);
    }

    private function formatPayment(Payment $payment): array
    {
        return [
            'id' => $payment->id,
            'amount' => $payment->amount,
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
