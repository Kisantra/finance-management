import { router } from '@inertiajs/react';
import { GUIDES } from '@video/registry';
import { Command } from 'cmdk';
import { BookOpen, ListChecks, Search } from 'lucide-react';
import * as React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { taskAnchor } from './parts';

/*
 * Palet pencarian panduan (tombol "/" atau Ctrl/⌘+K). Mencari modul dan tugas sekaligus; memilih tugas
 * membuka modulnya dengan lensa peran tugas itu dan melompat ke langkah-langkahnya.
 * Katalog tidak punya palet perintah; ini memakai Dialog + cmdk (pustaka yang sama dengan Combobox).
 */

/** Setiap kata yang diketik harus muncul utuh (bukan pencocokan huruf acak cmdk: "bayar" ≠ "layanan"). */
function matchWords(value: string, search: string, keywords?: string[]): number {
    const haystack = [value, ...(keywords ?? [])].join(' ').toLowerCase();
    return search
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .every((word) => haystack.includes(word))
        ? 1
        : 0;
}

const ITEM ='flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-ob-ink data-[selected=true]:bg-ob-hover';
const GROUP = '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-ob-ink-3';

export function GuideSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const go = (url: string) => {
        onOpenChange(false);
        router.visit(url);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                size="xl"
                hideClose
                className="top-[12vh] translate-y-0 overflow-hidden rounded-3xl border-ob-line bg-ob-card p-0 text-ob-ink dark:border-ob-line dark:bg-ob-card"
            >
                <DialogTitle className="sr-only">Cari panduan</DialogTitle>
                <DialogDescription className="sr-only">Ketik nama modul atau tugas, pilih dengan panah, lalu tekan Enter.</DialogDescription>
                <Command label="Cari panduan" filter={matchWords} className="flex max-h-[70vh] flex-col">
                    <div className="flex items-center gap-3 border-b border-ob-line px-5">
                        <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-ob-ink-3" />
                        <Command.Input
                            autoFocus
                            placeholder="Cari modul atau tugas, mis. “transfer” atau “bayar invoice”"
                            className="h-14 min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ob-ink shadow-none outline-none ring-0 placeholder:text-ob-ink-3 focus:border-0 focus:shadow-none focus:outline-none focus:ring-0"
                        />
                    </div>
                    <Command.List className="min-h-0 flex-1 overflow-y-auto p-2">
                        <Command.Empty className="px-4 py-12 text-center text-sm text-ob-ink-2">Tidak ada modul atau tugas yang cocok.</Command.Empty>
                        <Command.Group heading="Modul" className={GROUP}>
                            {GUIDES.map((g) => (
                                <Command.Item key={g.slug} value={`modul ${g.slug}`} keywords={[g.title, g.group]} onSelect={() => go(`/panduan/${g.slug}`)} className={ITEM}>
                                    <BookOpen aria-hidden="true" className="h-4 w-4 shrink-0 text-ob-ink-3" />
                                    <span className="min-w-0 flex-1 truncate font-medium">{g.title}</span>
                                    <span className="shrink-0 text-xs text-ob-ink-3">{g.group}</span>
                                </Command.Item>
                            ))}
                        </Command.Group>
                        <Command.Group heading="Tugas" className={GROUP}>
                            {GUIDES.flatMap((g) =>
                                g.tasks.map((t) => (
                                    <Command.Item
                                        key={`${g.slug}-${t.title}`}
                                        value={`tugas ${g.slug} ${t.title}`}
                                        keywords={[t.title, g.title, t.role.label]}
                                        onSelect={() => go(`/panduan/${g.slug}?peran=${t.role.key}#${taskAnchor(t.title)}`)}
                                        className={ITEM}
                                    >
                                        <ListChecks aria-hidden="true" className="h-4 w-4 shrink-0 text-ob-ink-3" />
                                        <span className="min-w-0 flex-1 truncate">{t.title}</span>
                                        <span className="shrink-0 text-xs text-ob-ink-3">
                                            {g.title} · {t.role.label}
                                        </span>
                                    </Command.Item>
                                )),
                            )}
                        </Command.Group>
                    </Command.List>
                    <div className="flex items-center gap-4 border-t border-ob-line px-5 py-2.5 text-xs text-ob-ink-3">
                        <span>
                            <kbd className="font-sans font-semibold text-ob-ink-2">↑↓</kbd> pilih
                        </span>
                        <span>
                            <kbd className="font-sans font-semibold text-ob-ink-2">Enter</kbd> buka
                        </span>
                        <span>
                            <kbd className="font-sans font-semibold text-ob-ink-2">Esc</kbd> tutup
                        </span>
                    </div>
                </Command>
            </DialogContent>
        </Dialog>
    );
}
