import * as React from 'react';
import { AppLayout } from '@/layouts/app-layout';
import type { SharedProps } from '@/types';
import type { CompanyTemplate } from './components/print-invoice-dialog';
import {
    type ClientOption,
    type Currency,
    type DocumentOptions,
    type DocumentType,
    type ForeignCurrencyOption,
    formatRate,
    InvoiceEditor,
    type PphOption,
    type PpnOption,
    type ServiceOption,
} from './create';

interface InvoiceData {
    id: number;
    invoice_number: string | null;
    status: string;
    document_type: DocumentType;
    document_code: string | null;
    client_id: number;
    issue_date: string;
    due_date: string;
    discount_type: 'fixed' | 'percentage';
    discount_value: number;
    discount_reason: string | null;
    ppn_rate: number | null;
    /** Tarif PPh 23 tersimpan bila klien memotong PPh; null = tidak dipotong. */
    pph_rate: number | null;
    faktur: string | null;
    subject: string | null;
    currency: Currency;
    /** Kurs tersimpan (Rp per 1 USD); null = tidak memakai kurs. */
    exchange_rate: number | null;
    /** Sudah ada pembayaran: mata uang terkunci. */
    has_payments: boolean;
    items: Array<{
        client_id: number | null;
        service_name: string;
        description: string | null;
        quantity: number;
        unit: string | null;
        unit_price: number;
        foreign_unit_price: number | null;
        cogs_amount: number;
        is_tax_deposit: boolean;
    }>;
}

interface Props extends SharedProps {
    invoice: InvoiceData;
    clients: ClientOption[];
    services: ServiceOption[];
    ppn: PpnOption;
    pph: PphOption;
    foreignCurrency: ForeignCurrencyOption;
    documents: DocumentOptions;
    defaultDueDays: number;
    companyTemplate: CompanyTemplate | null;
}

function EditInvoicePage({ invoice, clients, services, ppn, pph, foreignCurrency, documents, defaultDueDays, companyTemplate }: Props) {
    return (
        <InvoiceEditor
            clients={clients}
            services={services}
            ppn={ppn}
            pph={pph}
            foreignCurrency={foreignCurrency}
            documents={documents}
            defaultDueDays={defaultDueDays}
            companyTemplate={companyTemplate}
            invoice={{
                id: invoice.id,
                invoice_number: invoice.invoice_number,
                status: invoice.status,
                ppn_rate: invoice.ppn_rate,
                pph_rate: invoice.pph_rate,
                has_payments: invoice.has_payments,
                // Invoice yang sudah memakai kurs tetap bisa diubah walau tagihan USD dimatikan di profil.
                uses_foreign: invoice.exchange_rate !== null,
            }}
            initialData={{
                document_type: invoice.document_type,
                document_code: invoice.document_code ?? '',
                client_id: invoice.client_id,
                subject: invoice.subject ?? '',
                issue_date: invoice.issue_date,
                due_date: invoice.due_date,
                discount_type: invoice.discount_type,
                discount_value: invoice.discount_value,
                discount_reason: invoice.discount_reason ?? '',
                apply_ppn: invoice.ppn_rate !== null,
                faktur: invoice.faktur ?? '',
                apply_pph: invoice.pph_rate !== null,
                pph_rate: formatRate(invoice.pph_rate ?? pph.rate),
                currency: invoice.currency,
                exchange_rate: invoice.exchange_rate ?? foreignCurrency.lastRate ?? 0,
                items: invoice.items.map((item) => ({
                    // Klien baris = klien invoice disimpan eksplisit; null-kan agar sakelar "beberapa klien" tetap mati.
                    client_id: item.client_id === invoice.client_id ? null : item.client_id,
                    service_name: item.service_name,
                    description: item.description ?? '',
                    quantity: String(item.quantity).replace('.', ','),
                    unit: item.unit ?? '',
                    unit_price: item.unit_price,
                    foreign_unit_price: item.foreign_unit_price,
                    cogs_amount: item.cogs_amount,
                    is_tax_deposit: item.is_tax_deposit,
                })),
            }}
        />
    );
}

EditInvoicePage.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;

export default EditInvoicePage;
