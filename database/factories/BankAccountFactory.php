<?php

namespace Database\Factories;

use App\Models\BankAccount;
use Illuminate\Database\Eloquent\Factories\Factory;

class BankAccountFactory extends Factory
{
    protected $model = BankAccount::class;

    private $banks = [
        'Bank Central Asia (BCA)',
        'Bank Mandiri',
        'Bank Rakyat Indonesia (BRI)',
        'Bank Negara Indonesia (BNI)',
        'Bank Danamon',
        'Bank Permata',
        'CIMB Niaga',
    ];

    public function definition(): array
    {
        $initialBalance = $this->faker->numberBetween(1000000, 100000000);

        return [
            'type' => BankAccount::TYPE_BANK,
            'account_name' => $this->faker->company.' - Operational',
            'account_number' => $this->faker->numerify('##########'),
            'bank_name' => $this->faker->randomElement($this->banks),
            'branch' => $this->faker->city,
            'initial_balance' => $initialBalance,
        ];
    }

    /**
     * Kas tunai / kas kecil. Nomor & bank sengaja kosong: model mengisinya kode KAS-0001 dan
     * "Tunai", sama seperti akun kas yang dibuat dari form.
     */
    public function cash(?int $cashLimit = null, ?int $custodianId = null): static
    {
        return $this->state(fn (): array => [
            'type' => BankAccount::TYPE_CASH,
            'account_name' => 'Kas Kecil '.$this->faker->city,
            'account_number' => null,
            'bank_name' => null,
            'branch' => null,
            'initial_balance' => $this->faker->numberBetween(100000, 2000000),
            'cash_limit' => $cashLimit,
            'custodian_id' => $custodianId,
        ]);
    }
}
