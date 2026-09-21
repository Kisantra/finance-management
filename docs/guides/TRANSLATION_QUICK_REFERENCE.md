# Translation Quick Reference

Panduan cepat untuk menggunakan translation di Finance Management System.

---

## UI Labels vs Database Content

### UI Labels - Use `__()`

```blade
{{-- Static UI text --}}
<h1>{{ __('pages.dashboard') }}</h1>
<button>{{ __('common.save') }}</button>
<p>{{ __('pages.total_invoices') }}: {{ $count }}</p>
```

**Translation files:**
- `lang/id/pages.php`
- `lang/zh/pages.php`
- `lang/id/common.php`
- `lang/zh/common.php`

---

### Database Content - Use `translate_category()`

```blade
{{-- Category names from database --}}
<span>{{ translate_category($transaction->category->label) }}</span>

{{-- Debtor names --}}
<span>{{ translate_text($receivable->debtor->name) }}</span>

{{-- Any dynamic database text --}}
<span>{{ translate_text($customField) }}</span>
```

---

## Common Use Cases

### 1. Transaction Listing

```blade
@foreach ($transactions as $transaction)
    <tr>
        <td>{{ $transaction->transaction_date }}</td>
        <td>{{ translate_category($transaction->category->label ?? __('pages.uncategorized')) }}</td>
        <td>{{ $transaction->amount }}</td>
    </tr>
@endforeach
```

### 2. Chart Labels

```php
// Livewire Component
#[Computed]
public function chartData()
{
    $translationService = app(TranslationService::class);

    return $categories->map(function ($category) use ($translationService) {
        return [
            'label' => $translationService->translateCategory($category->label),
            'value' => $category->total,
        ];
    });
}
```

```blade
{{-- Blade Template --}}
<script>
    const chartData = @js($this->chartData);
</script>
```

### 3. Dropdown Options

```blade
<x-select.styled wire:model="categoryId" label="{{ __('common.category') }}">
    @foreach ($categories as $category)
        <x-select.option
            :value="$category->id"
            :label="translate_category($category->label)"
        />
    @endforeach
</x-select.styled>
```

### 4. Stats Cards

```blade
{{-- UI label: use __() --}}
<div class="text-sm text-dark-600 dark:text-dark-400">
    {{ __('pages.top_category') }}
</div>

{{-- Database value: use translate_category() --}}
<div class="text-2xl font-bold">
    {{ translate_category($topCategory->label) }}
</div>
```

### 5. Table Headers vs Content

```blade
<x-table>
    <x-slot:header>
        {{-- Headers: static UI, use __() --}}
        <th>{{ __('common.date') }}</th>
        <th>{{ __('common.category') }}</th>
        <th>{{ __('common.amount') }}</th>
    </x-slot:header>

    @foreach ($transactions as $transaction)
        <tr>
            <td>{{ $transaction->date }}</td>
            {{-- Content: dynamic DB, use translate_category() --}}
            <td>{{ translate_category($transaction->category->label) }}</td>
            <td>{{ $transaction->amount }}</td>
        </tr>
    @endforeach
</x-table>
```

---

## Decision Tree

```
Apakah text ini dari UI/hardcoded?
├─ YES → Gunakan __('translation.key')
│         - Button labels
│         - Page titles
│         - Form labels
│         - Validation messages
│         - Static text
│
└─ NO → Apakah text dari database?
    ├─ YES → Category name?
    │   ├─ YES → translate_category($name)
    │   └─ NO → translate_text($text)
    │
    └─ NO → Computed/calculated text?
        └─ Gunakan __() untuk template, lalu insert values
```

---

## Examples by Module

### Dashboard

```blade
{{-- Period Filter --}}
<x-select.styled wire:model.live="period">
    <x-select.option value="this_month" :label="__('pages.this_month')" />
    <x-select.option value="last_month" :label="__('pages.last_month')" />
</x-select.styled>

{{-- Stats Card --}}
<div>
    <p class="text-sm">{{ __('pages.total_income') }}</p>
    <p class="text-2xl font-bold">{{ $totalIncome }}</p>
</div>

{{-- Chart with DB categories --}}
@foreach ($expensesByCategory as $item)
    <div>
        <span>{{ translate_category($item['name']) }}</span>
        <span>{{ $item['value'] }}</span>
    </div>
@endforeach
```

### Transactions Module

```blade
{{-- Filter Section --}}
<x-select.styled
    wire:model.live="filterCategory"
    label="{{ __('common.category') }}"
>
    <x-select.option value="" :label="__('common.all')" />
    @foreach ($categories as $category)
        <x-select.option
            :value="$category->id"
            :label="translate_category($category->label)"
        />
    @endforeach
</x-select.styled>

{{-- Transaction Table --}}
@foreach ($transactions as $transaction)
    <tr>
        <td>{{ $transaction->transaction_date }}</td>
        <td>
            @if ($transaction->category)
                {{ translate_category($transaction->category->label) }}
            @else
                {{ __('pages.uncategorized') }}
            @endif
        </td>
        <td>{{ $transaction->amount }}</td>
    </tr>
@endforeach
```

### Reimbursements Module

```blade
{{-- Category Input (optional translation) --}}
<x-input
    wire:model="category_input"
    label="{{ __('common.category') }}"
    placeholder="{{ __('pages.expense_category_example') }}"
/>

{{-- Display category (translate if from DB) --}}
@if ($reimbursement->category)
    <span>{{ translate_category($reimbursement->category->label) }}</span>
@else
    <span>{{ translate_text($reimbursement->category_input) }}</span>
@endif
```

---

## Performance Tips

### 1. Eager Load Relationships

```php
// ✅ GOOD - Single query
$transactions = BankTransaction::with('category')->get();

foreach ($transactions as $transaction) {
    echo translate_category($transaction->category->label);
}

// ❌ BAD - N+1 problem
$transactions = BankTransaction::all();

foreach ($transactions as $transaction) {
    echo translate_category($transaction->category->label); // Query setiap loop!
}
```

### 2. Cache in Computed Properties

```php
// Livewire Component
#[Computed]
public function translatedCategories()
{
    return $this->categories->map(fn($cat) => [
        'id' => $cat->id,
        'label' => translate_category($cat->label),
    ]);
}
```

```blade
{{-- Use computed property --}}
@foreach ($this->translatedCategories as $category)
    <option value="{{ $category['id'] }}">{{ $category['label'] }}</option>
@endforeach
```

### 3. Batch Translate in Component

```php
public function mount()
{
    // Warm up cache untuk semua categories
    $service = app(TranslationService::class);
    $categoryNames = $this->categories->pluck('label')->toArray();
    $service->batchTranslate($categoryNames, app()->getLocale(), 'id');
}
```

---

## Common Mistakes

### ❌ WRONG - Using __() for DB content

```blade
{{-- JANGAN seperti ini --}}
<span>{{ __($transaction->category->label) }}</span>
{{-- Error: Translation key not found --}}
```

### ✅ CORRECT - Using translate_category()

```blade
<span>{{ translate_category($transaction->category->label) }}</span>
```

---

### ❌ WRONG - Using translate_text() for UI labels

```blade
{{-- JANGAN seperti ini --}}
<button>{{ translate_text('Save') }}</button>
{{-- Inefficient, gunakan __() --}}
```

### ✅ CORRECT - Using __() for static UI

```blade
<button>{{ __('common.save') }}</button>
```

---

### ❌ WRONG - Translating inside loop without cache

```blade
@foreach ($transactions as $transaction)
    {{-- API call setiap loop! --}}
    <td>{{ app(TranslationService::class)->translate($transaction->category->label, 'zh') }}</td>
@endforeach
```

### ✅ CORRECT - Pre-translate in component

```php
// Component
#[Computed]
public function transactionsWithTranslation()
{
    return $this->transactions->map(function ($transaction) {
        $transaction->translated_category = translate_category($transaction->category->label);
        return $transaction;
    });
}
```

```blade
@foreach ($this->transactionsWithTranslation as $transaction)
    <td>{{ $transaction->translated_category }}</td>
@endforeach
```

---

## Testing

### Test Helper Functions

```php
php artisan tinker

// Test translate_category
>>> translate_category('MAKAN MINUM')
=> "饮食" // (if locale = zh)

// Test translate_text
>>> translate_text('Pembayaran Invoice', 'id')
=> "Invoice Payment"

// Change locale and test
>>> app()->setLocale('zh');
>>> translate_category('KASBON')
=> "预付款"
```

### Test in Browser

1. Buka dashboard
2. Klik language switcher (ID/中文)
3. Chart categories harus berubah bahasa
4. UI labels juga harus berubah

---

## Summary Cheat Sheet

| Content Type | Helper | Example |
|--------------|--------|---------|
| **UI Labels** | `__()` | `{{ __('common.save') }}` |
| **Category Names** | `translate_category()` | `{{ translate_category($cat->label) }}` |
| **Custom DB Text** | `translate_text()` | `{{ translate_text($field) }}` |
| **Form Placeholders** | `__()` | `placeholder="{{ __('common.search_here') }}"` |
| **Table Headers** | `__()` | `<th>{{ __('common.date') }}</th>` |
| **Chart Labels (UI)** | `__()` | `@js(__('pages.revenue'))` |
| **Chart Data (DB)** | Component method | Pre-translate in `#[Computed]` |

---

**Remember:**
- 🔵 **Blue (Static UI)** → `__()`
- 🟢 **Green (Dynamic DB)** → `translate_category()` / `translate_text()`
- ⚡ **Performance** → Cache, eager load, batch translate
