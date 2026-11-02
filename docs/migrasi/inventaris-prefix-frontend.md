# Inventaris titik company-aware yang DIBUANG saat merge rekonsiliasi

Dihasilkan otomatis dari sisi tenancy (`:2:`) tiap berkas konflik, sebelum sisi
`main` diambil utuh. Tiap baris di bawah HILANG dari berkas setelah merge dan
harus dipulihkan — lewat interceptor (`router.*`), pembungkus `api()` (`fetch`),
komponen `<AppLink>` (`href`), atau tangan (`appPath`, perakitan string).

Gerbang G2 (`tests/Feature/FrontendCompanyPrefixTest.php`) harus hijau sebelum ini dianggap selesai.

## resources/js/components/notifications/notification-drawer.tsx
```
  87:            const res = await fetch(companyUrl(`/notifications?page=${targetPage}&per_page=20`), {
  122:            companyUrl(`/notifications/${item.id}/read`),
  128:                    if (url) router.visit(companyUrl(url));
  136:            companyUrl('/notifications/mark-all-read'),
```

## resources/js/layouts/app-layout.tsx
```
```

## resources/js/layouts/header.tsx
```
  52:    const path = appPath(url).split('?')[0];
  145:                    href={companyUrl('/dashboard')}
  184:                                href={companyUrl(crumb.href)}
```

## resources/js/layouts/settings-layout.tsx
```
  41:                            const isActive = appPath(url).startsWith(item.href);
  45:                                    href={companyUrl(item.href)}
```

## resources/js/layouts/sidebar.tsx
```
  284:            href={companyUrl(item.href)}
  320:    const currentUrl = appPath(usePage().url);
  494:                                href={companyUrl('/settings/profile')}
  502:                                    href={companyUrl('/settings/company')}
```

## resources/js/pages/dashboard.tsx
```
  498:                        <SectionHeader title="Reimburse Terbaru" href={companyUrl('/reimbursements')} />
  526:                        <SectionHeader title="Pengajuan Dana" href={companyUrl('/fund-requests')} />
  555:                        <SectionHeader title="Invoice Tertunda" href={companyUrl('/invoices')} />
```

## resources/js/pages/invoices/components/print-invoice-dialog.tsx
```
  135:        window.open(companyUrl(`/invoice/${invoiceId}/preview?${query}`), '_blank');
  143:        link.href = companyUrl(`/invoice/${invoiceId}/download?${query}`);
```

## resources/js/pages/invoices/create.tsx
```
  380:        fetch(companyUrl(`/api/invoices/next-sequence?date=${data.issue_date}`), {
  871:                                onClick={() => router.get(companyUrl('/invoices'))}
  900:                            onClick={() => router.get(companyUrl('/invoices'))}
  921:                    submitUrl={companyUrl('/invoices')}
```

## resources/js/pages/invoices/edit.tsx
```
  78:                            href={companyUrl('/invoices')}
  101:                    submitUrl={companyUrl(`/invoices/${invoice.id}`)}
```

## resources/js/pages/invoices/index.tsx
```
  299:        fetch(companyUrl(`/invoices/${id}`), {
  323:        fetch(companyUrl('/api/bank-accounts'), {
  333:        sendForm.post(companyUrl(`/invoices/${detail.id}/send`), {
  343:        router.post(companyUrl(`/invoices/${detail.id}/rollback`), {}, { onSuccess: () => onClose() });
  349:        router.delete(companyUrl(`/invoices/${detail.id}`), {
  408:            ? companyUrl(`/payments/${editPayment.id}`)
  409:            : companyUrl(`/invoices/${detail.id}/payments`);
  450:            const res = await fetch(companyUrl(`/payments/${deletePaymentTarget.id}`), {
  804:                                onClick={() => router.get(companyUrl(`/invoices/${detail.id}/edit`))}
  1104:        router.get(companyUrl('/invoices'), { ...currentFilters, ...params, page: 1 }, {
  1125:        return companyUrl(`/invoices/export/${format}${qs ? `?${qs}` : ''}`);
  1134:        router.get(companyUrl('/invoices'), { ...currentFilters, page }, {
  1155:        router.delete(companyUrl(`/invoices/${deleteId}`), {
  1220:                                onClick={() => router.get(companyUrl('/invoices/create'))}
  1661:                                                            <DropdownMenuItem onClick={() => router.get(companyUrl(`/invoices/${inv.id}/edit`))}>
```

## resources/js/pages/recurring-invoices/index.tsx
```
  591:            ? companyUrl(`/recurring-invoices/monthly/${editTarget!.id}`)
  592:            : companyUrl('/recurring-invoices/monthly');
  751:            const res = await fetch(companyUrl('/recurring-invoices/monthly/generate'), {
  842:            const res = await fetch(companyUrl(`/recurring-invoices/monthly/${invoice.id}/publish`), {
  920:            const res = await fetch(companyUrl('/recurring-invoices/monthly/bulk-publish'), {
  1005:        router.get(companyUrl('/recurring-invoices'), {
  1022:        router.get(companyUrl('/recurring-invoices'), {
  1051:            const res = await fetch(companyUrl(`/recurring-invoices/templates/${deleteTemplateTarget.id}`), {
  1069:            const res = await fetch(companyUrl(`/recurring-invoices/templates/${template.id}/restore`), {
  1095:            const res = await fetch(companyUrl(`/recurring-invoices/monthly/${deleteMonthlyTarget.id}`), {
  1112:            const res = await fetch(companyUrl('/recurring-invoices/monthly/bulk-destroy'), {
  1172:                                <Button variant="primary" size="sm" onClick={() => router.get(companyUrl('/recurring-invoices/templates/create'))}>
  1240:                                action={<Button variant="primary" onClick={() => router.get(companyUrl('/recurring-invoices/templates/create'))}><Plus className="w-4 h-4 mr-1.5" /> Buat Template</Button>}
  1261:                                                        <button onClick={() => router.get(companyUrl(`/recurring-invoices/templates/${t.id}/edit`))} className="p-1.5 rounded-lg hover:bg-secondary-100 dark:hover:bg-dark-600 text-dark-400 hover:text-dark-700 dark:hover:text-dark-200 transition-colors">
  1418:                                                        <a href={companyUrl(`/invoices?search=${inv.published_invoice_number}`)} className="text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 mt-0.5">
```

