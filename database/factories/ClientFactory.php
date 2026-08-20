<?php

namespace Database\Factories;

use App\Models\Client;
use Illuminate\Database\Eloquent\Factories\Factory;

class ClientFactory extends Factory
{
    protected $model = Client::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->company,
            'type' => $this->faker->randomElement(['individual', 'company']),
            'email' => $this->faker->unique()->safeEmail,
            'NPWP' => $this->faker->numerify('##.###.###.#-###.###'),
            'KPP' => $this->faker->numerify('###'),
            'logo' => null,
            // Default 'Active': status acak membuat setiap test yang menerbitkan
            // invoice lewat HTTP gagal separuh waktu, sejak klien nonaktif ditolak
            // di server (TEMUAN C-04). Gunakan state inactive() bila memang
            // klien nonaktif yang diuji.
            'status' => Client::STATUS_ACTIVE,
            'EFIN' => $this->faker->numerify('##########'),
            'account_representative' => $this->faker->name,
            'ar_phone_number' => $this->faker->phoneNumber,
            'person_in_charge' => $this->faker->name,
            'address' => $this->faker->address,
        ];
    }

    public function individual()
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'individual',
            'name' => $this->faker->name,
        ]);
    }

    public function company()
    {
        return $this->state(fn (array $attributes) => [
            'type' => 'company',
            'name' => $this->faker->company,
        ]);
    }

    public function active()
    {
        return $this->state(fn (array $attributes) => [
            'status' => Client::STATUS_ACTIVE,
        ]);
    }

    public function inactive()
    {
        return $this->state(fn (array $attributes) => [
            'status' => Client::STATUS_INACTIVE,
        ]);
    }
}
