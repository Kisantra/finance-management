<?php

namespace Tests\Feature;

use App\Models\BankTransaction;
use App\Models\Payment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Lampiran disimpan di disk "public"; hook deleting model dulu memakai disk default sehingga
 * file tertinggal setiap kali data dihapus (QA reimbursement 8 Okt 2026, BUG-01 + model saudara).
 */
class AttachmentCleanupTest extends TestCase
{
    use RefreshDatabase;

    public function test_deleting_a_bank_transaction_removes_its_attachment(): void
    {
        Storage::fake('public');
        $path = UploadedFile::fake()->image('bukti.jpg')->store('transaction-attachments', 'public');
        $transaction = BankTransaction::factory()->create(['attachment_path' => $path]);

        $transaction->delete();

        Storage::disk('public')->assertMissing($path);
    }

    public function test_deleting_an_invoice_payment_removes_its_attachment(): void
    {
        Storage::fake('public');
        $path = UploadedFile::fake()->image('bukti.jpg')->store('payments', 'public');
        $payment = Payment::factory()->create(['attachment_path' => $path]);

        $payment->delete();

        Storage::disk('public')->assertMissing($path);
    }
}
