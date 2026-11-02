<?php

namespace App\Http\Requests;

use App\Models\BankAccount;
use Carbon\Carbon;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Parameter grafik Arus Kas di dashboard: periode, rentang, dan filter rekening.
 *
 * Nilai yang tidak valid tidak menghasilkan 422 — halaman ringkasan harus selalu terbuka —
 * melainkan jatuh ke nilai bawaan (bulanan, semua rekening). Lihat docs/module/dashboard.md.
 *
 * @phpstan-type Chart array{period: 'weekly'|'monthly'|'yearly'|'range', from: Carbon|null, to: Carbon|null, account: int|null}
 */
class DashboardChartRequest extends FormRequest
{
    public const PERIODS = ['weekly', 'monthly', 'yearly', 'range'];

    /** Rentang bebas dibatasi dua tahun agar bucket tetap terbaca. */
    public const MAX_RANGE_DAYS = 731;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'chart_period' => ['nullable', 'string', 'in:'.implode(',', self::PERIODS)],
            'chart_from' => ['nullable', 'date_format:Y-m-d'],
            'chart_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:chart_from'],
            'chart_account' => ['nullable', 'integer', 'exists:bank_accounts,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'chart_period.in' => 'Periode grafik tidak dikenal.',
            'chart_to.after_or_equal' => 'Tanggal akhir harus pada atau setelah tanggal awal.',
            'chart_account.exists' => 'Rekening tidak ditemukan.',
        ];
    }

    /**
     * Sengaja tidak melempar: parameter grafik yang salah tidak boleh mematikan halaman.
     * chart() membaca nilai mentah dan menyaringnya sendiri.
     */
    protected function failedValidation(Validator $validator): void
    {
        // no-op: fallback ditangani di chart()
    }

    /**
     * Parameter yang sudah disaring dan diberi nilai bawaan.
     *
     * @return Chart
     */
    public function chart(): array
    {
        $period = $this->input('chart_period');
        if (! in_array($period, self::PERIODS, true)) {
            $period = 'monthly';
        }

        $from = $this->carbon($this->input('chart_from'));
        $to = $this->carbon($this->input('chart_to'));

        if ($period === 'range') {
            if (! $from || ! $to || $to->lt($from) || $from->diffInDays($to) > self::MAX_RANGE_DAYS) {
                $period = 'monthly';
                $from = $to = null;
            }
        } else {
            $from = $to = null;
        }

        $account = (int) $this->input('chart_account');
        if ($account <= 0 || ! BankAccount::whereKey($account)->exists()) {
            $account = null;
        }

        return ['period' => $period, 'from' => $from, 'to' => $to, 'account' => $account];
    }

    private function carbon(mixed $value): ?Carbon
    {
        if (! is_string($value) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return null;
        }

        try {
            return Carbon::createFromFormat('Y-m-d', $value)->startOfDay();
        } catch (\Throwable) {
            return null;
        }
    }
}
