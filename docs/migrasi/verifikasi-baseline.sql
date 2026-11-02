-- Baseline cutover multi-tenancy: jalankan SEBELUM dan SESUDAH, lalu bandingkan.
--
--   mysql -h127.0.0.1 -u<user> -p <nama-db> < docs/migrasi/verifikasi-baseline.sql > sebelum.txt
--   mysql -h127.0.0.1 -u<user> -p tenant_<slug> < docs/migrasi/verifikasi-baseline.sql > sesudah.txt
--   diff sebelum.txt sesudah.txt
--
-- Perbedaan yang WAJAR hanya satu: blok invoice_sequence (NULL sebelum backfill).
-- Perbedaan apa pun di blok JUMLAH BARIS atau SALDO berarti cutover TIDAK aman —
-- mundur ke backup, jangan lanjut.

SELECT '== JUMLAH BARIS ==' AS blok;
SELECT 'clients' AS tabel, COUNT(*) AS jumlah FROM clients
UNION ALL SELECT 'invoices',            COUNT(*) FROM invoices
UNION ALL SELECT 'invoice_items',       COUNT(*) FROM invoice_items
UNION ALL SELECT 'payments',            COUNT(*) FROM payments
UNION ALL SELECT 'bank_accounts',       COUNT(*) FROM bank_accounts
UNION ALL SELECT 'bank_transactions',   COUNT(*) FROM bank_transactions
UNION ALL SELECT 'transaction_categories', COUNT(*) FROM transaction_categories
UNION ALL SELECT 'reimbursements',      COUNT(*) FROM reimbursements
UNION ALL SELECT 'fund_requests',       COUNT(*) FROM fund_requests
UNION ALL SELECT 'loans',               COUNT(*) FROM loans
UNION ALL SELECT 'receivables',         COUNT(*) FROM receivables
UNION ALL SELECT 'recurring_templates', COUNT(*) FROM recurring_templates
UNION ALL SELECT 'recurring_invoices',  COUNT(*) FROM recurring_invoices
UNION ALL SELECT 'services',            COUNT(*) FROM services;

SELECT '== TOTAL NILAI ==' AS blok;
SELECT 'invoices.total_amount' AS metrik, COALESCE(SUM(total_amount),0) AS nilai FROM invoices
UNION ALL SELECT 'payments.amount',           COALESCE(SUM(amount),0) FROM payments
UNION ALL SELECT 'bank_tx.credit',            COALESCE(SUM(amount),0) FROM bank_transactions WHERE transaction_type='credit'
UNION ALL SELECT 'bank_tx.debit',             COALESCE(SUM(amount),0) FROM bank_transactions WHERE transaction_type='debit';

-- Saldo dihitung dengan rumus yang sama dengan BankAccount::withBalance():
-- initial_balance + payments(credit) + tx(credit) - tx(debit). Saldo TIDAK disimpan.
SELECT '== SALDO PER REKENING ==' AS blok;
SELECT b.id, b.bank_name, b.account_number,
       b.initial_balance
       + COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.bank_account_id = b.id), 0)
       + COALESCE((SELECT SUM(t.amount) FROM bank_transactions t WHERE t.bank_account_id = b.id AND t.transaction_type='credit'), 0)
       - COALESCE((SELECT SUM(t.amount) FROM bank_transactions t WHERE t.bank_account_id = b.id AND t.transaction_type='debit'), 0) AS saldo
FROM bank_accounts b ORDER BY b.id;

SELECT '== NOMOR & URUTAN INVOICE ==' AS blok;
SELECT id, invoice_number, IFNULL(invoice_sequence, 'NULL') AS urutan, issue_date, status
FROM invoices ORDER BY id;

SELECT '== POLA PENOMORAN AKTIF ==' AS blok;
SELECT name, invoice_number_format, invoice_number_padding, invoice_number_reset FROM company_profiles;
