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
            'account_name' => $this->faker->company.' - Operational',
            'account_number' => $this->faker->numerify('##########'),
            'bank_name' => $this->faker->randomElement($this->banks),
            'branch' => $this->faker->city,
            'initial_balance' => $initialBalance,
        ];
    }
}
