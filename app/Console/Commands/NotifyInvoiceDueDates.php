<?php

namespace App\Console\Commands;

use App\Models\AppNotification;
use App\Models\Invoice;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Console\Command;

class NotifyInvoiceDueDates extends Command
{
    protected $signature = 'invoices:notify-due-dates';

    protected $description = 'Kirim notifikasi invoice yang akan jatuh tempo (H-3 dan H-0)';

    public function handle(): void
    {
        $recipients = User::role(['admin', 'finance manager'])->pluck('id')->toArray();

        if (empty($recipients)) {
            $this->info('No recipients found.');

            return;
        }

        $today = Carbon::today();
        $inThree = Carbon::today()->addDays(3);
        $count = 0;

        // H-3: jatuh tempo 3 hari lagi
        $dueSoon = Invoice::whereIn('status', ['draft', 'partially_paid'])
            ->whereDate('due_date', $inThree)
            ->with('client')
            ->get();

        foreach ($dueSoon as $invoice) {
            AppNotification::notifyMany(
                $recipients,
                'invoice_due_soon',
                'Invoice Jatuh Tempo 3 Hari Lagi',
                'Invoice '.$invoice->invoice_number.' ('.$invoice->client->name.') jatuh tempo pada '.$invoice->due_date->format('d M Y'),
                ['invoice_id' => $invoice->id, 'url' => route('invoices.index').'#invoice/'.$invoice->id]
            );
            $count++;
        }

        // H-0: jatuh tempo hari ini
        $dueToday = Invoice::whereIn('status', ['draft', 'partially_paid'])
            ->whereDate('due_date', $today)
            ->with('client')
            ->get();

        foreach ($dueToday as $invoice) {
            AppNotification::notifyMany(
                $recipients,
                'invoice_due_soon',
                'Invoice Jatuh Tempo Hari Ini',
                'Invoice '.$invoice->invoice_number.' ('.$invoice->client->name.') jatuh tempo hari ini!',
                ['invoice_id' => $invoice->id, 'url' => route('invoices.index').'#invoice/'.$invoice->id]
            );
            $count++;
        }

        $this->info("Due date notifications sent for {$count} invoice(s).");
    }
}
