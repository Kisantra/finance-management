import { router } from '@inertiajs/react';
import * as React from 'react';
import { closeResource, useResource } from '@/lib/resource-modal';

/* Dimuat saat pertama dibutuhkan agar halaman yang tidak membuka modal tidak ikut memuat kodenya. */
const InvoiceDrawer = React.lazy(() => import('@/pages/invoices/components/invoice-drawer').then((m) => ({ default: m.InvoiceDrawer })));

/**
 * Modal detail yang ditentukan hash URL (`#invoice/13`) dan tampil di atas halaman apa pun.
 * Lihat resources/js/lib/resource-modal.ts.
 */
export function ResourceModalHost() {
    const resource = useResource();

    return (
        <React.Suspense fallback={null}>
            {resource?.type === 'invoice' && (
                <InvoiceDrawer
                    invoiceId={resource.id}
                    onClose={closeResource}
                    // Muat ulang ke URL yang sama: Inertia mempertahankan hash, jadi modal tetap terbuka.
                    onChanged={() => router.reload()}
                />
            )}
        </React.Suspense>
    );
}
