<?php

namespace App\Http\Requests;

/** Ubah nomor invoice yang sudah terbit: aturan sama dengan nomor saat diterbitkan (wajib, unik). */
class UpdateInvoiceNumberRequest extends SendInvoiceRequest {}
