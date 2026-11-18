<?php

namespace App\Services;

use App\Models\Invoice;
use Illuminate\Support\Facades\View;

/**
 * Template invoice milik satu perusahaan.
 *
 * Desainnya statis di kode: satu folder per perusahaan, `resources/views/pdf/perusahaan/{slug}/`,
 * berisi `invoice.blade.php` dan gambar yang dipakainya (logo, tanda tangan, stempel). Yang berubah
 * per invoice hanya datanya; mengganti desain = mengubah file di folder itu lalu deploy.
 *
 * Perusahaan yang punya folder ini HANYA memakai template ini: template bawaan milik perusahaan
 * lain tidak ditawarkan dan ditolak rute. Perusahaan tanpa folder tetap memakai template bawaan.
 *
 * `debit-note.blade.php` di folder yang sama membuat perusahaan itu bisa menerbitkan Debit Note
 * (jenis dokumen di editor); dokumen berjenis Debit Note dicetak dengan template itu.
 */
class CompanyInvoiceTemplate
{
    /** Nilai `template` (query/payload) untuk "template milik perusahaan aktif". */
    public const KEY = 'perusahaan';

    /** Template bawaan untuk perusahaan yang belum punya template sendiri. */
    public const FALLBACK = 'kisantra-invoice';

    /** Nama view Blade template perusahaan aktif, atau null bila perusahaan ini belum punya. */
    public static function view(): ?string
    {
        return self::viewNamed('invoice');
    }

    /** Nama view Debit Note perusahaan aktif, atau null bila perusahaan ini tidak menerbitkan Debit Note. */
    public static function debitNoteView(): ?string
    {
        return self::view() !== null ? self::viewNamed('debit-note') : null;
    }

    /** Perusahaan aktif bisa menerbitkan Debit Note (editor menawarkan jenis dokumen). */
    public static function supportsDebitNote(): bool
    {
        return self::debitNoteView() !== null;
    }

    public static function exists(): bool
    {
        return self::view() !== null;
    }

    /** Template yang dipakai bila permintaan tidak menyebut template. */
    public static function defaultTemplate(): string
    {
        return self::exists() ? self::KEY : self::FALLBACK;
    }

    /**
     * Nilai `template` Blade yang sah untuk perusahaan aktif. Template builder (`builder:{id}`)
     * diperiksa terpisah oleh rute.
     *
     * @return list<string>
     */
    public static function allowed(): array
    {
        return self::exists() ? [self::KEY] : InvoicePrintService::BLADE_TEMPLATES;
    }

    /**
     * Opsi template perusahaan untuk dialog cetak & editor (label = nama perusahaan).
     *
     * @return array{value: string, label: string}|null
     */
    public static function option(): ?array
    {
        return self::exists() ? ['value' => self::KEY, 'label' => (string) tenant('name')] : null;
    }

    /**
     * Nama view Blade untuk nilai `template` yang sudah lolos allowed(). Template perusahaan memakai
     * view Debit Note untuk dokumen berjenis Debit Note.
     */
    public static function viewFor(string $template, ?Invoice $invoice = null): string
    {
        if ($template !== self::KEY) {
            return 'pdf.'.$template;
        }

        return ($invoice?->isDebitNote() ? self::debitNoteView() : null) ?? (string) self::view();
    }

    /**
     * Gambar dari folder template perusahaan aktif sebagai data URI (DomPDF tidak membaca berkas
     * lokal lewat URL). Berkas tidak ada = string kosong, sama seperti aset profil perusahaan.
     */
    public static function asset(string $file): string
    {
        $path = basename($file) === $file ? self::path($file) : '';

        if ($path === '') {
            return '';
        }

        return 'data:'.mime_content_type($path).';base64,'.base64_encode((string) file_get_contents($path));
    }

    /**
     * Path absolut berkas di folder template perusahaan aktif (mis. `fonts/Carlito-Bold.ttf` untuk
     * `@font-face`; folder itu di dalam chroot DomPDF). Tidak ada / keluar folder = string kosong.
     */
    public static function path(string $relative): string
    {
        $slug = self::slug();

        if ($slug === null || preg_match('#^[A-Za-z0-9_-]+(/[A-Za-z0-9_.-]+)*\.[A-Za-z0-9]+$#', $relative) !== 1 || str_contains($relative, '..')) {
            return '';
        }

        $path = resource_path("views/pdf/perusahaan/{$slug}/{$relative}");

        return is_file($path) ? $path : '';
    }

    private static function viewNamed(string $file): ?string
    {
        $slug = self::slug();

        if ($slug === null) {
            return null;
        }

        $view = "pdf.perusahaan.{$slug}.{$file}";

        return View::exists($view) ? $view : null;
    }

    /** Slug perusahaan aktif; ikut menjadi path view & berkas, jadi hanya karakter slug yang sah. */
    private static function slug(): ?string
    {
        $slug = tenant()?->getTenantKey();

        return is_string($slug) && preg_match('/^[a-z0-9-]+$/', $slug) === 1 ? $slug : null;
    }
}
