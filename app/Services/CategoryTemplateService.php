<?php

namespace App\Services;

use App\Models\TransactionCategory;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Template kategori transaksi ("Pakai Template").
 *
 * Satu sumber kebenaran untuk tombol Pakai Template di halaman Kategori Transaksi
 * DAN untuk TransactionCategorySeeder (perusahaan baru langsung mendapat template).
 * Aturannya (docs/module/transaction-categories.md › Pakai Template):
 *
 * - Nama dibandingkan setelah dinormalisasi: trim, spasi berurutan jadi satu, dan
 *   tanpa membedakan huruf besar/kecil. Nama yang hanya mirip tidak dianggap sama.
 * - Induk template "sudah ada" bila ada kategori INDUK bertipe sama dengan nama yang
 *   sama: induk itu dipakai ulang dan sub barunya ditempel ke sana. Penjaga: induk itu
 *   bukan kategori sistem dan tidak dipakai langsung oleh transaksi bank, item
 *   permintaan dana, atau reimbursement. Kalau dipakai langsung, seluruh grup dilewati:
 *   kategori yang punya anak menjadi judul grup yang tidak bisa dipilih di pemilih
 *   kategori, padahal data lama masih menunjuk padanya.
 * - Sub template "sudah ada" bila ada kategori SUB bertipe sama dengan nama yang sama
 *   di induk mana pun: dilewati, agar pemilih kategori tidak berisi nama kembar.
 * - Baris yang sudah ada tidak pernah diubah (label, tipe, grup L/R, induk, system_key).
 */
class CategoryTemplateService
{
    public const STATUS_NEW = 'new';

    public const STATUS_EXISTING = 'existing';

    public const STATUS_SKIPPED = 'skipped';

    /**
     * Isi template, berurutan mengikuti bagan akun (4, 7 → 5, 6, 8, 9) tanpa kode akun.
     * `pl_group` berlaku untuk induk DAN subnya, sehingga tidak ada yang berstatus
     * "belum diklasifikasi". "(Tanpa Invoice)": pendapatan dan HPP penjualan lewat
     * invoice sudah dihitung otomatis oleh Laba Rugi, jangan dicatat lagi di sini.
     *
     * @var list<array{type: 'income'|'expense', label: string, pl_group: string, children: list<string>}>
     */
    public const TEMPLATE = [
        [
            'type' => 'income',
            'label' => 'Pendapatan Usaha (Tanpa Invoice)',
            'pl_group' => 'revenue',
            'children' => ['Pendapatan Jasa', 'Penjualan Barang', 'Komisi & Fee'],
        ],
        [
            'type' => 'income',
            'label' => 'Pendapatan Lain-lain',
            'pl_group' => 'other_income',
            'children' => ['Bunga & Jasa Giro Bank', 'Pengembalian Dana (Refund)', 'Pendapatan Sewa', 'Pendapatan Lainnya'],
        ],
        [
            'type' => 'expense',
            'label' => 'Harga Pokok Penjualan (Tanpa Invoice)',
            'pl_group' => 'cogs',
            'children' => ['Pembelian Barang Dagang', 'Bahan Baku', 'Jasa Vendor & Subkon', 'Ongkos Kirim Pembelian'],
        ],
        [
            'type' => 'expense',
            'label' => 'Beban Karyawan',
            'pl_group' => 'opex',
            'children' => [
                'Gaji Karyawan', 'Tunjangan & Lembur', 'THR & Bonus', 'BPJS Kesehatan',
                'BPJS Ketenagakerjaan', 'PPh 21 Karyawan', 'Honor Tenaga Lepas', 'Pelatihan Karyawan',
            ],
        ],
        [
            'type' => 'expense',
            'label' => 'Beban Kantor',
            'pl_group' => 'opex',
            'children' => ['Sewa Kantor', 'Listrik', 'Air', 'Internet & Telepon', 'Kebersihan & Keamanan', 'Konsumsi Kantor & Rapat'],
        ],
        [
            'type' => 'expense',
            'label' => 'Beban Administrasi & Umum',
            'pl_group' => 'opex',
            'children' => [
                'ATK & Perlengkapan Kantor', 'Cetak & Fotokopi', 'Kurir & Pengiriman', 'Bea Meterai',
                'Perizinan & Legalitas', 'Jasa Profesional (Notaris, Konsultan)', 'Langganan Software & Aplikasi', 'Asuransi',
            ],
        ],
        [
            'type' => 'expense',
            'label' => 'Beban Perjalanan & Transportasi',
            'pl_group' => 'opex',
            'children' => ['Transportasi Lokal', 'BBM, Tol & Parkir', 'Tiket Perjalanan Dinas', 'Hotel & Akomodasi', 'Uang Harian Dinas'],
        ],
        [
            'type' => 'expense',
            'label' => 'Beban Pemasaran',
            'pl_group' => 'opex',
            'children' => ['Iklan & Promosi', 'Materi Promosi & Cetak', 'Jamuan Klien', 'Komisi Penjualan'],
        ],
        [
            'type' => 'expense',
            'label' => 'Beban Pemeliharaan',
            'pl_group' => 'opex',
            'children' => ['Perbaikan Gedung & Kantor', 'Servis Kendaraan', 'Perawatan Peralatan & Komputer'],
        ],
        [
            'type' => 'expense',
            'label' => 'Beban Pajak & Retribusi',
            'pl_group' => 'opex',
            'children' => ['PBB & Pajak Daerah', 'Pajak Kendaraan', 'Setoran PPh 23 & 4(2)'],
        ],
        [
            'type' => 'expense',
            'label' => 'Beban Lain-lain',
            'pl_group' => 'other_expense',
            'children' => ['Biaya Administrasi Bank', 'Pajak Jasa Giro', 'Denda & Sanksi', 'Sumbangan & Donasi'],
        ],
        [
            'type' => 'expense',
            'label' => 'Pajak Penghasilan Badan',
            'pl_group' => 'tax',
            'children' => ['PPh 25 (Angsuran Bulanan)', 'PPh 29 (Kurang Bayar Tahunan)', 'PPh Final UMKM 0,5%'],
        ],
    ];

    /**
     * Rencana penerapan template terhadap kategori yang ada sekarang (pratinjau).
     * Tidak mengubah apa pun.
     *
     * @return array{
     *     groups: list<array{
     *         type: string,
     *         label: string,
     *         pl_group: string,
     *         status: string,
     *         reason: string|null,
     *         category_id: int|null,
     *         existing_label: string|null,
     *         children: list<array{
     *             label: string,
     *             status: string,
     *             reason: string|null,
     *             existing_parent_id: int|null,
     *             existing_parent_label: string|null,
     *             existing_pl_group: string|null,
     *         }>,
     *     }>,
     *     summary: array{new: int, existing: int, skipped: int},
     * }
     */
    public function plan(): array
    {
        // Tabel kategori kecil (puluhan baris): muat sekali, bandingkan di PHP. Hitungan
        // pemakaian hanya dipakai penjaga induk, tetapi mengambilnya di sini menghemat
        // satu query per grup.
        $categories = TransactionCategory::query()
            ->withCount(['transactions', 'fundRequestItems', 'reimbursements'])
            ->orderBy('id')
            ->get();

        $labelById = $categories->pluck('label', 'id');
        $parentsByKey = $categories->whereNull('parent_id')
            ->groupBy(fn (TransactionCategory $category): string => self::key($category->type, $category->label));
        $subsByKey = $categories->whereNotNull('parent_id')
            ->groupBy(fn (TransactionCategory $category): string => self::key($category->type, $category->label));

        $groups = [];

        foreach (self::TEMPLATE as $template) {
            $group = $this->planParent($template, $parentsByKey->get(self::key($template['type'], $template['label']), collect()));

            foreach ($template['children'] as $childLabel) {
                $match = $subsByKey->get(self::key($template['type'], $childLabel))?->first();

                $group['children'][] = match (true) {
                    $match !== null => [
                        'label' => $childLabel,
                        'status' => self::STATUS_EXISTING,
                        'reason' => null,
                        'existing_parent_id' => $match->parent_id,
                        'existing_parent_label' => $labelById->get($match->parent_id),
                        'existing_pl_group' => $match->pl_group,
                    ],
                    $group['status'] === self::STATUS_SKIPPED => [
                        'label' => $childLabel,
                        'status' => self::STATUS_SKIPPED,
                        'reason' => 'Grup induknya dilewati.',
                        'existing_parent_id' => null,
                        'existing_parent_label' => null,
                        'existing_pl_group' => null,
                    ],
                    default => [
                        'label' => $childLabel,
                        'status' => self::STATUS_NEW,
                        'reason' => null,
                        'existing_parent_id' => null,
                        'existing_parent_label' => null,
                        'existing_pl_group' => null,
                    ],
                };
            }

            // Induk baru tanpa satu pun sub baru hanya akan menjadi judul grup kosong:
            // tidak tampil di pemilih kategori mana pun, tetapi tetap harus dihapus manual.
            $adaSubBaru = collect($group['children'])->contains('status', self::STATUS_NEW);

            if ($group['status'] === self::STATUS_NEW && ! $adaSubBaru) {
                $group['status'] = self::STATUS_SKIPPED;
                $group['reason'] = 'Semua sub-kategorinya sudah ada di grup lain.';
            }

            $groups[] = $group;
        }

        $counts = collect($groups)
            ->flatMap(fn (array $group): array => [$group['status'], ...array_column($group['children'], 'status')])
            ->countBy();

        return [
            'groups' => $groups,
            'summary' => [
                'new' => $counts->get(self::STATUS_NEW, 0),
                'existing' => $counts->get(self::STATUS_EXISTING, 0),
                'skipped' => $counts->get(self::STATUS_SKIPPED, 0),
            ],
        ];
    }

    /**
     * Terapkan template: rencana dihitung ulang di sini (bukan diterima dari klien),
     * lalu induk dibuat lebih dulu, baru subnya. Idempoten: menerapkan ulang membuat 0.
     *
     * @return array{created: int, existing: int, skipped: int}
     */
    public function apply(): array
    {
        // ponytail: tidak ada unique index (type, parent_id, label), jadi dua permintaan
        // yang benar-benar bersamaan (mis. dua tab diklik serentak) bisa sama-sama melihat
        // "belum ada" lalu membuat kategori kembar. Tombolnya nonaktif selama memproses dan
        // klik ulang sesudahnya membuat 0 kategori; kembaran yang terlanjur ada dirapikan
        // lewat Pindahkan & Hapus. Bila perlu dikunci: lockForUpdate() saat memuat kategori
        // di plan() selama berada di dalam transaksi ini.
        return DB::transaction(function (): array {
            $plan = $this->plan();
            $created = 0;

            foreach ($plan['groups'] as $group) {
                if ($group['status'] === self::STATUS_SKIPPED) {
                    continue;
                }

                $parentId = $group['category_id'];

                if ($group['status'] === self::STATUS_NEW) {
                    $parentId = TransactionCategory::create([
                        'type' => $group['type'],
                        'label' => $group['label'],
                        'pl_group' => $group['pl_group'],
                        'parent_id' => null,
                    ])->id;
                    $created++;
                }

                foreach ($group['children'] as $child) {
                    if ($child['status'] !== self::STATUS_NEW) {
                        continue;
                    }

                    TransactionCategory::create([
                        'type' => $group['type'],
                        'label' => $child['label'],
                        'pl_group' => $group['pl_group'],
                        'parent_id' => $parentId,
                    ]);
                    $created++;
                }
            }

            return [
                'created' => $created,
                'existing' => $plan['summary']['existing'],
                'skipped' => $plan['summary']['skipped'],
            ];
        });
    }

    /**
     * Bentuk pembanding nama: trim, spasi berurutan jadi satu, huruf kecil.
     */
    public static function normalize(string $label): string
    {
        return mb_strtolower(trim((string) preg_replace('/\s+/u', ' ', $label)));
    }

    /**
     * Status induk satu grup template beserta penjaganya.
     *
     * @param  array{type: string, label: string, pl_group: string, children: list<string>}  $template
     * @param  Collection<int, TransactionCategory>  $matches  induk bertipe sama dengan nama yang sama, urut id
     * @return array{type: string, label: string, pl_group: string, status: string, reason: string|null, category_id: int|null, existing_label: string|null, children: list<array<string, mixed>>}
     */
    private function planParent(array $template, Collection $matches): array
    {
        $group = [
            'type' => $template['type'],
            'label' => $template['label'],
            'pl_group' => $template['pl_group'],
            'status' => self::STATUS_NEW,
            'reason' => null,
            'category_id' => null,
            'existing_label' => null,
            'children' => [],
        ];

        if ($matches->isEmpty()) {
            return $group;
        }

        // Bila ada beberapa induk kembar, pakai yang lolos penjaga; alasan dilewati
        // diambil dari induk tertua bila tidak ada satu pun yang lolos.
        $chosen = $matches->first(fn (TransactionCategory $category): bool => $this->blockReason($category) === null)
            ?? $matches->first();

        $group['category_id'] = $chosen->id;
        $group['existing_label'] = $chosen->label;
        $group['reason'] = $this->blockReason($chosen);
        $group['status'] = $group['reason'] === null ? self::STATUS_EXISTING : self::STATUS_SKIPPED;

        return $group;
    }

    /**
     * Alasan sebuah induk yang cocok tidak boleh dipakai sebagai grup, atau null bila boleh.
     */
    private function blockReason(TransactionCategory $category): ?string
    {
        if ($category->isSystem()) {
            return "\"{$category->label}\" adalah kategori sistem modul Utang/Piutang, jadi tidak bisa dijadikan grup.";
        }

        $usage = array_values(array_filter([
            $category->transactions_count > 0 ? "{$category->transactions_count} transaksi" : null,
            $category->fund_request_items_count > 0 ? "{$category->fund_request_items_count} item permintaan dana" : null,
            $category->reimbursements_count > 0 ? "{$category->reimbursements_count} reimbursement" : null,
        ]));

        if ($usage === []) {
            return null;
        }

        $last = array_pop($usage);
        $usageText = $usage === [] ? $last : implode(', ', $usage).' dan '.$last;

        return "\"{$category->label}\" sudah dipakai langsung oleh {$usageText}. Sub-kategori akan "
            .'menjadikannya judul grup yang tidak bisa dipilih, padahal data lama itu memakainya.';
    }

    private static function key(string $type, string $label): string
    {
        return $type.'|'.self::normalize($label);
    }
}
