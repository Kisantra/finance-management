<?php

namespace App\Http\Requests;

use App\Models\Client;
use App\Models\Invoice;
use App\Services\CompanyInvoiceTemplate;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Klien nonaktif hanya disaring saat menyusun opsi Combobox. Aturan
            // yang cuma ada di frontend bukan aturan — panggilan langsung ke
            // endpoint ini tetap menerbitkan invoice atas nama klien nonaktif.
            'client_id' => ['required', Rule::exists('clients', 'id')->where('status', Client::STATUS_ACTIVE)],
            'issue_date' => ['required', 'date'],
            'due_date' => ['required', 'date', 'after_or_equal:issue_date'],
            'subject' => ['nullable', 'string', 'max:255'],
            // Debit Note hanya untuk perusahaan yang punya template Debit Note.
            'document_type' => ['nullable', Rule::in(self::documentTypes())],
            'document_code' => self::documentCodeRules(),
            'items' => ['required', 'array', 'min:1'],
            'items.*.client_id' => ['nullable', Rule::exists('clients', 'id')->where('status', Client::STATUS_ACTIVE)],
            'items.*.service_name' => ['required', 'string', 'max:255'],
            'items.*.description' => ['nullable', 'string', 'max:2000'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'items.*.unit' => ['nullable', 'string', 'max:20'],
            'items.*.unit_price' => ['required', 'integer', 'min:0'],
            'items.*.cogs_amount' => ['nullable', 'integer', 'min:0'],
            'items.*.is_tax_deposit' => ['boolean'],
            'discount_type' => ['nullable', 'in:fixed,percentage'],
            // `numeric` dulu menerima 12.5 lalu controller dan cast model
            // memotongnya menjadi 12 — dua kali, diam-diam, dan pengguna hanya
            // melihat diskon yang lebih kecil dari yang ia ketik. `integer`
            // membuat penolakan itu terlihat.
            'discount_value' => ['nullable', 'integer', 'min:0'],
            'discount_reason' => ['nullable', 'string', 'max:255'],
            'apply_ppn' => ['nullable', 'boolean'],
            'faktur' => ['nullable', 'string', 'max:50'],
            // Potongan PPh 23 oleh klien: tarif wajib bila dipotong.
            'apply_pph' => ['nullable', 'boolean'],
            'pph_rate' => ['nullable', 'required_if_accepted:apply_pph', 'numeric', 'min:0.01', 'max:100'],
            // Nomor dari dialog "Simpan & terbitkan". Dipakai hanya saat publish oleh pemegang
            // `edit invoices` (lihat InvoiceController::store); kosong = nomor otomatis.
            'invoice_number' => ['nullable', 'string', 'max:100', Rule::unique('invoices', 'invoice_number')->ignore($this->route('invoice'))],
        ];
    }

    /** @return list<string> */
    public static function documentTypes(): array
    {
        return CompanyInvoiceTemplate::supportsDebitNote() ? Invoice::TYPES : [Invoice::TYPE_INVOICE];
    }

    /**
     * Kode jenis ikut ke nomor ({KODE}), jadi hanya huruf, angka, dan tanda hubung.
     *
     * @return list<string>
     */
    public static function documentCodeRules(): array
    {
        return ['nullable', 'string', 'max:20', 'regex:/^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$/'];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'document_type.in' => __('Jenis dokumen tidak tersedia untuk perusahaan ini.'),
            'document_code.regex' => __('Kode jenis hanya boleh huruf, angka, dan tanda hubung, mis. FINAL atau PNBP.'),
            'document_code.max' => __('Kode jenis maksimal 20 karakter.'),
            'client_id.required' => __('Klien wajib dipilih.'),
            'client_id.exists' => __('Klien tidak ditemukan.'),
            'issue_date.required' => __('Tanggal invoice wajib diisi.'),
            'due_date.required' => __('Jatuh tempo wajib diisi.'),
            'due_date.after_or_equal' => __('Jatuh tempo tidak boleh sebelum tanggal invoice.'),
            'items.required' => __('Tambahkan minimal satu item.'),
            'items.min' => __('Tambahkan minimal satu item.'),
            'subject.max' => __('Perihal maksimal 255 karakter.'),
            'items.*.service_name.required' => __('Nama layanan baris :position wajib diisi.'),
            'items.*.description.max' => __('Keterangan baris :position maksimal 2000 karakter.'),
            'items.*.quantity.required' => __('Qty baris :position wajib diisi.'),
            'items.*.quantity.min' => __('Qty baris :position harus lebih dari 0.'),
            'items.*.unit_price.required' => __('Harga satuan baris :position wajib diisi.'),
            'items.*.unit_price.min' => __('Harga satuan baris :position tidak boleh negatif.'),
            'discount_value.min' => __('Diskon tidak boleh negatif.'),
            'faktur.max' => __('Nomor faktur pajak maksimal 50 karakter.'),
            'pph_rate.required_if_accepted' => __('Tarif PPh 23 wajib diisi.'),
            'pph_rate.numeric' => __('Tarif PPh 23 harus berupa angka.'),
            'pph_rate.min' => __('Tarif PPh 23 harus lebih dari 0%.'),
            'pph_rate.max' => __('Tarif PPh 23 maksimal 100%.'),
            'invoice_number.unique' => __('Nomor ini sudah dipakai invoice lain.'),
            'invoice_number.max' => __('Nomor invoice maksimal 100 karakter.'),
            'discount_value.integer' => __('Nilai diskon harus bilangan bulat. Diskon persen pecahan (mis. 12,5%) belum didukung — gunakan diskon nominal bila perlu.'),
        ];
    }

    /**
     * Pesan khusus supaya penolakan diskon pecahan tidak terbaca sebagai galat teknis.
     *
     * @return array<string, string>
     */
    /**
     * Batas atas diskon bergantung pada tipe dan subtotal, jadi tidak bisa
     * dituliskan sebagai aturan statis.
     *
     * Sebelumnya diskon 150% atau nominal Rp 5.000.000 atas subtotal Rp 1.000.000
     * diterima apa adanya: total akhir memang dijaga `max(0, ...)`, tetapi
     * `discount_amount` yang mustahil tetap tersimpan dan ikut tercetak di PDF
     * serta rekap.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($validator) {
            $tipe = $this->input('discount_type');
            $nilai = (int) $this->input('discount_value', 0);

            if ($nilai <= 0) {
                return;
            }

            if ($tipe === 'percentage' && $nilai > 100) {
                $validator->errors()->add('discount_value', __('Diskon persen tidak boleh melebihi 100%.'));

                return;
            }

            if ($tipe === 'fixed') {
                $subtotal = collect($this->input('items', []))
                    ->sum(fn ($item) => (float) ($item['quantity'] ?? 0) * (int) ($item['unit_price'] ?? 0));

                if ($nilai > $subtotal) {
                    $validator->errors()->add('discount_value',
                        __('Diskon nominal tidak boleh melebihi subtotal (Rp :subtotal).', ['subtotal' => number_format($subtotal, 0, ',', '.')]));
                }
            }
        });
    }
}
