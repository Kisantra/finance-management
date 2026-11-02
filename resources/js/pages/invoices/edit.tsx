import * as React from 'react';
import { AppLayout } from '@/layouts/app-layout';
import type { SharedProps } from '@/types';
import { type ClientOption, InvoiceEditor, type PpnOption, type ServiceOption } from './create';

interface InvoiceData {
    id: number;
    invoice_number: string | null;
    status: string;
    client_id: number;
    issue_date: string;
    due_date: string;
    discount_type: 'fixed' | 'percentage';
    discount_value: number;
    discount_reason: string | null;
    ppn_rate: number | null;
    faktur: string | null;
    items: Array<{
        client_id: number | null;
        service_name: string;
        quantity: number;
        unit: string | null;
        unit_price: number;
        cogs_amount: number;
        is_tax_deposit: boolean;
    }>;
}

interface Props extends SharedProps {
    invoice: InvoiceData;
    clients: ClientOption[];
    services: ServiceOption[];
    ppn: PpnOption;
}

function EditInvoicePage({ invoice, clients, services, ppn }: Props) {
    return (
        <InvoiceEditor
            clients={clients}
            services={services}
            ppn={ppn}
            invoice={{ id: invoice.id, invoice_number: invoice.invoice_number, status: invoice.status, ppn_rate: invoice.ppn_rate }}
            initialData={{
                client_id: invoice.client_id,
                issue_date: invoice.issue_date,
                due_date: invoice.due_date,
                discount_type: invoice.discount_type,
                discount_value: invoice.discount_value,
                discount_reason: invoice.discount_reason ?? '',
                apply_ppn: invoice.ppn_rate !== null,
                faktur: invoice.faktur ?? '',
                items: invoice.items.map((item) => ({
                    // Klien baris = klien invoice disimpan eksplisit; null-kan agar sakelar "beberapa klien" tetap mati.
                    client_id: item.client_id === invoice.client_id ? null : item.client_id,
                    service_name: item.service_name,
                    quantity: String(item.quantity).replace('.', ','),
                    unit: item.unit ?? '',
                    unit_price: item.unit_price,
                    cogs_amount: item.cogs_amount,
                    is_tax_deposit: item.is_tax_deposit,
                })),
            }}
        />
    );
}

EditInvoicePage.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;

export default EditInvoicePage;
