{{--
    Debit Note PT Samboja Laju Utama (SLU): menagih kembali biaya yang SLU bayar lebih dulu atas nama
    klien (talangan, mis. PNBP). Desainnya sama dengan invoice SLU — kop, tabel, kotak alamat &
    rekening, tanda tangan — hanya judulnya DEBIT NOTE. Item Debit Note selalu talangan (tanpa PPN),
    jadi baris total hanya GRAND TOTAL (atau tagihan uang muka/pelunasan).
    Adanya berkas ini membuat SLU bisa memilih jenis dokumen Debit Note di editor
    (CompanyInvoiceTemplate::supportsDebitNote()).
--}}
@include('pdf.perusahaan.samboja-laju-utama.invoice', [
    'judul' => 'D E B I T &nbsp; N O T E',
    'lebarJudul' => '8.4cm',
    'namaDokumen' => 'Debit Note',
])
