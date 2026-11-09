import { BookText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { JournalLine } from '@/lib/journal';
import { cn } from '@/lib/utils';

/*
 * Kotak "Jurnal" (Cara A): debit/kredit yang diturunkan dari rekening + kategori (+ titipan pajak & PPN
 * untuk pembayaran invoice). Hanya tampilan — tidak disimpan, bukan buku besar; keterangan di bawah
 * judul mengatakannya. Baris tersimpan datang dari server (JournalService), pratinjau dari
 * @/lib/journal. Lihat docs/module/cash-flow.md › Jurnal.
 *
 * Gaya Obsidian: kartu-dalam `rounded-2xl bg-ob-inner`, tabel semantik (caption, th scope), akun kredit
 * menjorok ke dalam sesuai kebiasaan jurnal, nominal rata kanan tabular tanpa "Rp" (ada di kepala kolom).
 */

export const JOURNAL_CAPTION = 'Jurnal otomatis dari rekening & kategori · belum buku besar';

const angka = new Intl.NumberFormat('id-ID');

interface JournalBoxProps {
    /** Baris jurnal; kosong/null = tampilkan `placeholder`. */
    lines: JournalLine[] | null | undefined;
    /** `preview` = dihitung dari isian formulir (berpenanda "Pratinjau"); `saved` = dari server. */
    mode?: 'saved' | 'preview';
    /** Teks pengganti tabel selama jurnal belum bisa dibentuk (mis. kategori belum dipilih). */
    placeholder?: string;
    /** Keterangan di bawah judul; bawaan menyebut asal jurnal & bahwa ini belum buku besar. */
    caption?: string;
    className?: string;
}

export function JournalBox({ lines, mode = 'saved', placeholder = 'Jurnal tampil setelah kategori dipilih.', caption = JOURNAL_CAPTION, className }: JournalBoxProps) {
    const rows = lines ?? [];
    const known = rows.length > 0 && rows.every((l) => l.amount !== null);
    const total = (side: JournalLine['side']) => rows.filter((l) => l.side === side).reduce((sum, l) => sum + (l.amount ?? 0), 0);

    return (
        <section aria-label="Jurnal" className={cn('rounded-2xl border border-ob-line bg-ob-inner px-4 py-3 text-ob-ink', className)}>
            <div className="flex items-start gap-2">
                <BookText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ob-ink-3" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h4 className="text-[13px] font-semibold text-ob-ink">Jurnal</h4>
                        {mode === 'preview' && (
                            <Badge variant="outline" size="sm">
                                Pratinjau
                            </Badge>
                        )}
                    </div>
                    <p className="mt-0.5 text-xs leading-snug text-ob-ink-3">{caption}</p>
                </div>
            </div>

            {rows.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-ob-line-strong px-3 py-2.5 text-xs text-ob-ink-2">{placeholder}</p>
            ) : (
                <div className="relative mt-2">
                    <table className="w-full border-collapse text-[13px]">
                        <caption className="sr-only">
                            Jurnal: akun yang didebit dan dikredit, dalam rupiah{mode === 'preview' ? ' (pratinjau dari isian formulir)' : ''}
                        </caption>
                        <thead>
                            <tr className="border-b border-ob-line text-left text-xs font-medium text-ob-ink-3">
                                <th scope="col" className="py-1.5 pr-2 font-medium">
                                    Akun
                                </th>
                                <th scope="col" className="w-px py-1.5 pl-3 text-right font-medium whitespace-nowrap">
                                    Debit (Rp)
                                </th>
                                <th scope="col" className="w-px py-1.5 pl-3 text-right font-medium whitespace-nowrap">
                                    Kredit (Rp)
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((line, i) => (
                                <tr key={`${line.side}-${i}`} className="border-b border-ob-line-soft align-top last:border-0">
                                    <th scope="row" className={cn('py-1.5 pr-2 text-left font-normal break-words text-ob-ink', line.side === 'credit' && 'pl-5')}>
                                        {line.account}
                                    </th>
                                    <Amount value={line.side === 'debit' ? line.amount : undefined} />
                                    <Amount value={line.side === 'credit' ? line.amount : undefined} />
                                </tr>
                            ))}
                        </tbody>
                        {known && (
                            <tfoot>
                                <tr className="border-t border-ob-line text-ob-ink">
                                    <th scope="row" className="py-1.5 pr-2 text-left text-xs font-semibold text-ob-ink-2">
                                        Jumlah
                                    </th>
                                    <td className="py-1.5 pl-3 text-right font-semibold whitespace-nowrap tabular-nums">{angka.format(total('debit'))}</td>
                                    <td className="py-1.5 pl-3 text-right font-semibold whitespace-nowrap tabular-nums">{angka.format(total('credit'))}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )}
        </section>
    );
}

/** Sel nominal: undefined = sisi lain (kosong), null = belum diketahui ("—"). */
function Amount({ value }: { value: number | null | undefined }) {
    if (value === undefined) return <td className="py-1.5 pl-3" />;
    return (
        <td className={cn('py-1.5 pl-3 text-right whitespace-nowrap tabular-nums', value === null ? 'text-ob-ink-3' : 'text-ob-ink')}>
            {value === null ? '—' : angka.format(value)}
        </td>
    );
}
