<?php

namespace App\Http\Requests;

use App\Models\BankTransaction;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Http\FormRequest;

class BulkDestroyBankTransactionRequest extends FormRequest
{
    /** Alasan penolakan yang terbaca bila seleksi memuat transaksi yang dikelola modul. */
    private ?string $pesanKunci = null;

    public function authorize(): bool
    {
        $user = $this->user();
        if (! $user) {
            return false;
        }

        $ids = $this->input('ids');
        if (! is_array($ids) || empty($ids)) {
            return true; // defer to validation (422)
        }

        $transactions = BankTransaction::with('category')->whereIn('id', $ids)->get();

        // Pokok utang/piutang dikelola modul Utang/Piutang: satu saja di seleksi, seluruhnya ditolak.
        if ($transactions->contains(fn (BankTransaction $t): bool => $t->moduleLockMessage() !== null)) {
            $this->pesanKunci = __('Seleksi berisi pokok utang/piutang yang dicatat otomatis oleh modul Utang/Piutang. Transaksi itu tidak bisa dihapus dari sini; kelola lewat menu Utang atau Piutang.');

            return false;
        }

        // Require the matching delete permission for every feature present in the selection.
        $features = $transactions->map->permissionFeature()->unique();

        foreach ($features as $feature) {
            if (! $user->can("delete {$feature}")) {
                return false;
            }
        }

        return true;
    }

    protected function failedAuthorization(): void
    {
        throw new AuthorizationException($this->pesanKunci ?? __('Tindakan ini tidak diizinkan.'));
    }

    public function rules(): array
    {
        return [
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:bank_transactions,id'],
        ];
    }
}
