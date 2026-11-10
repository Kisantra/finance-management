import { t, tk } from '@/i18n';

/* Pola F01/F02/F10 yang dulu lolos dari pemindai. Berkas ini sengaja salah. */

export function PratinjauAlamat() {
    return (
        <dl>
            {/* i18n-abaikan: pengecualian satu baris untuk contoh pertama */}
            <Baris label={t('Alamat')} />
        </dl>
    );
}

export function FormAlamat() {
    return <Input label={t('Alamat')} />;
}

export const TEMPLATE = [
    { value: 'semesta', label: 'Semesta' }, // i18n-abaikan: nama template
    { value: 'invoice', label: tk('Generik') },
];

export const kolom = [{ id: 'nama', header: 'Nama' }];

export function Kanvas() {
    const bandSubtitle = { header: 'Halaman pertama', content: 'Setelah konten' };
    return <Panel meta="Halaman" subtitle={bandSubtitle.header} />;
}
