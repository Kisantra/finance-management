import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import * as React from 'react';
import { InvoiceForm } from './create';
import { AppLayout } from '@/layouts/app-layout';
import { companyUrl } from '@/lib/company';
import type { SharedProps } from '@/types';

/* ─────────────────────────────────── types ─── */

interface ClientOption {
    id: number;
    name: string;
    email: string | null;
}

interface ServiceOption {
    id: number;
    name: string;
    price: number;
    type: string;
}

interface InvoiceData {
    id: number;
    invoice_number: string;
    client_id: number;
    issue_date: string;
    due_date: string;
    discount_type: string;
    discount_value: number;
    discount_reason: string | null;
    items: Array<{
        client_id: number | null;
        service_name: string;
        quantity: number;
        unit: string;
        unit_price: number;
        cogs_amount: number;
        is_tax_deposit: boolean;
    }>;
}

interface Props extends SharedProps {
    invoice: InvoiceData;
    clients: ClientOption[];
    services: ServiceOption[];
}

/* ─────────────────────────────────── page ─── */

function EditInvoicePage({ invoice, clients, services }: Props) {
    const initialData = {
        client_id: invoice.client_id,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        discount_type: invoice.discount_type,
        discount_value: invoice.discount_value,
        discount_reason: invoice.discount_reason ?? '',
        items: invoice.items.map((item) => ({
            service_name: item.service_name,
            quantity: String(item.quantity),
            unit: item.unit,
            unit_price: item.unit_price,
            cogs_amount: item.cogs_amount,
            is_tax_deposit: item.is_tax_deposit,
        })),
    };

    return (
        <>
            <Head title="Edit Invoice" />
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <Link
                            href={companyUrl('/invoices')}
                            className="h-9 w-9 rounded-xl flex items-center justify-center border border-secondary-200 dark:border-dark-600 hover:bg-zinc-100 dark:hover:bg-dark-600 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4 text-dark-600 dark:text-dark-400" />
                        </Link>
                        <div>
                            <h1 className="text-2xl sm:text-4xl font-bold bg-linear-to-r from-gray-900 via-blue-800 to-indigo-800 dark:from-white dark:via-blue-200 dark:to-indigo-200 bg-clip-text text-transparent">
                                Edit Invoice
                            </h1>
                            <p className="text-gray-600 dark:text-zinc-400 text-sm sm:text-lg">
                                Perbarui detail invoice
                            </p>
                        </div>
                    </div>
                </div>

                <InvoiceForm
                    clients={clients}
                    services={services}
                    nextSeq={0}
                    companyInitials=""
                    existingInvoiceNumber={invoice.invoice_number}
                    initialData={initialData}
                    submitUrl={companyUrl(`/invoices/${invoice.id}`)}
                    method="put"
                    submitLabel="Simpan Perubahan"
                    isEdit
                />
            </div>
        </>
    );
}

EditInvoicePage.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;

export default EditInvoicePage;
