import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import * as React from 'react';
import { TemplateForm } from './create-template';
import { AppLayout } from '@/layouts/app-layout';
import { companyUrl } from '@/lib/company';
import type { SharedProps } from '@/types';

/* ─────────────────────────────────── types ─── */

interface TemplateItem {
    client_id: number | null;
    service_name: string;
    quantity: number;
    unit: string;
    unit_price: number;
    cogs_amount: number;
    is_tax_deposit: boolean;
}

interface ClientOption { id: number; name: string; display_name: string; email: string }
interface ServiceOption { id: number; name: string; price: number; type: string }

interface Props extends SharedProps {
    template: {
        id: number;
        template_name: string;
        client_id: number;
        start_date: string;
        end_date: string;
        frequency: string;
        invoice_template: {
            items: TemplateItem[];
            discount_type: 'fixed' | 'percentage';
            discount_value: number;
            discount_reason: string;
        };
    };
    clients: ClientOption[];
    services: ServiceOption[];
}

/* ─────────────────────────────────── page ─── */

function EditTemplatePage() {
    const { template, clients, services } = usePage<Props>().props;

    const initialData = {
        template_name: template.template_name,
        client_id: template.client_id,
        start_date: template.start_date,
        end_date: template.end_date,
        frequency: template.frequency,
        items: template.invoice_template?.items ?? [],
        discount_type: template.invoice_template?.discount_type ?? 'fixed' as 'fixed' | 'percentage',
        discount_value: template.invoice_template?.discount_value ?? 0,
        discount_reason: template.invoice_template?.discount_reason ?? '',
    };

    return (
        <>
            <Head title={`Edit Template — ${template.template_name}`} />
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <Link
                        href={companyUrl('/recurring-invoices')}
                        className="h-9 w-9 rounded-xl flex items-center justify-center border border-secondary-200 dark:border-dark-600 hover:bg-zinc-100 dark:hover:bg-dark-600 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 text-dark-600 dark:text-dark-400" />
                    </Link>
                    <div>
                        <h1 className="text-2xl sm:text-4xl font-bold bg-linear-to-r from-gray-900 via-blue-800 to-indigo-800 dark:from-white dark:via-blue-200 dark:to-indigo-200 bg-clip-text text-transparent">
                            Edit Template Recurring
                        </h1>
                        <p className="text-gray-600 dark:text-zinc-400 text-sm sm:text-lg">
                            {template.template_name}
                        </p>
                    </div>
                </div>

                <TemplateForm
                    clients={clients}
                    services={services}
                    submitUrl={companyUrl(`/recurring-invoices/templates/${template.id}`)}
                    method="put"
                    submitLabel="Perbarui Template"
                    isEdit={true}
                    initialData={initialData}
                />
            </div>
        </>
    );
}

EditTemplatePage.layout = (page: React.ReactNode) => <AppLayout>{page}</AppLayout>;

export default EditTemplatePage;
