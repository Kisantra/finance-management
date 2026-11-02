# Auto Translation Guide

## Overview

Sistem ini menggunakan **Google Translate API (unofficial endpoint)** untuk auto-translate text dari database tanpa modifikasi database schema. Semua translation di-cache selama 6 bulan untuk performa optimal.

---

## Features

✅ **Zero Database Changes** - Tidak ada kolom tambahan di database
✅ **Auto-Caching** - Translation di-cache 6 bulan untuk menghindari repeated API calls
✅ **Automatic Fallback** - Jika translation gagal, tampilkan text original
✅ **Language Support** - Indonesian (id) dan Chinese (zh)
✅ **Global Helper Functions** - Mudah digunakan di mana saja

---

## Installation

### 1. Update Composer Autoload

File `composer.json` sudah diupdate untuk autoload `app/helpers.php`:

```json
"autoload": {
    "files": [
        "app/helpers.php"
    ]
}
```

### 2. Run Composer Dump-Autoload

```bash
composer dump-autoload
```

---

## Usage

### Option 1: Global Helper Functions (Recommended)

#### Translate Category Names

```blade
{{-- Blade Template --}}
<p>{{ translate_category('MAKAN MINUM') }}</p>
{{-- Output: "饮食" (jika locale = zh) --}}
{{-- Output: "MAKAN MINUM" (jika locale = id) --}}
```

```php
// Livewire Component
public function getCategoryName($category)
{
    return translate_category($category->label);
}
```

#### Translate Any Text

```blade
{{-- Blade Template --}}
<p>{{ translate_text('Pembayaran Invoice') }}</p>
{{-- Output: "发票付款" (jika locale = zh) --}}
```

```php
// PHP Code
$translated = translate_text('Pembayaran Invoice', 'id');
```

---

### Option 2: Direct Service Usage

```php
use App\Services\TranslationService;

class YourComponent extends Component
{
    public function translateData()
    {
        $service = app(TranslationService::class);

        // Translate single text
        $result = $service->translate('MAKAN MINUM', 'zh', 'id');
        // Output: "饮食"

        // Translate category (auto-detect current locale)
        $result = $service->translateCategory('KASBON');
        // Output: "预付款" (jika locale = zh)

        // Batch translate
        $texts = ['MAKAN MINUM', 'KASBON', 'TRANSPORT'];
        $results = $service->batchTranslate($texts, 'zh', 'id');
        // Output: ['饮食', '预付款', '交通']
    }
}
```

---

## How It Works

### Translation Flow

```
User Request
    ↓
translate_category('MAKAN MINUM')
    ↓
Check Current Locale (app()->getLocale())
    ↓
If locale == 'id' → Return original text
    ↓
Check Cache (translation.id.zh.{md5})
    ↓
If cached → Return cached translation
    ↓
If not cached → Call Google Translate API
    ↓
Cache result for 6 months
    ↓
Return translated text
```

### Cache Strategy

**Cache Key Format:**
```php
"translation.{source}.{target}.{md5(text)}"
// Example: "translation.id.zh.a1b2c3d4e5f6..."
```

**Cache Duration:** 6 months (configurable in `TranslationService.php`)

**Why 6 months?**
- Category names jarang berubah
- Reduce API calls drastically
- Balance between freshness and performance

---

## Cache Management

### Clear Cache for Specific Text

```php
$service = app(TranslationService::class);
$service->clearCache('MAKAN MINUM', 'zh', 'id');
```

### Clear All Translation Cache

```php
$service = app(TranslationService::class);
$service->clearAllCache();
```

**Warning:** `clearAllCache()` akan clear SEMUA cache di aplikasi, bukan hanya translation!

---

## API Limitations

### Google Translate API (Unofficial Endpoint)

**Pros:**
- ✅ FREE (no API key required)
- ✅ Simple integration
- ✅ Supports 100+ languages
- ✅ Good quality translation

**Cons:**
- ❌ No official support dari Google
- ❌ Rate limiting (unknown limits, tapi jarang terjadi)
- ❌ Bisa di-deprecate tanpa notice

**Alternative (Production-Ready):**

Jika mau production-grade solution, bisa upgrade ke:
1. **Google Cloud Translation API (Official)** - $20/1M characters
2. **DeepL API** - More accurate, €5/500k characters
3. **AWS Translate** - $15/1M characters

---

## Example Implementation

### Dashboard Category Chart

File: `app/Livewire/Dashboard.php`

```php
use App\Services\TranslationService;

#[Computed]
public function expensesByCategoryChart()
{
    $translationService = app(TranslationService::class);

    $grouped = $transactions->groupBy('category_id')
        ->map(function ($group) use ($translationService) {
            $categoryName = $group->first()->category->label ?? __('pages.others');
            return [
                'name' => $translationService->translateCategory($categoryName),
                'value' => $group->sum('amount'),
            ];
        })
        ->toArray();

    return $grouped;
}
```

---

## Troubleshooting

### Translation Not Working

**Check 1: Is helper loaded?**
```bash
composer dump-autoload
php artisan config:clear
php artisan cache:clear
```

**Check 2: Internet connection**
```bash
# Test di tinker
php artisan tinker
>>> app(\App\Services\TranslationService::class)->translate('test', 'zh')
```

**Check 3: Check logs**
```bash
tail -f storage/logs/laravel.log
```

### Translation Cached but Wrong

```php
// Clear specific translation
$service->clearCache('MAKAN MINUM', 'zh', 'id');

// Re-fetch
$newTranslation = $service->translate('MAKAN MINUM', 'zh', 'id');
```

---

## Best Practices

### 1. Use Helper Functions

```php
// ✅ GOOD - Simple and readable
translate_category($category->label)

// ❌ BAD - Verbose
app(TranslationService::class)->translateCategory($category->label)
```

### 2. Cache Aggressively

Translation adalah expensive operation (HTTP call), jadi cache selama mungkin:

```php
// Default: 6 months
Cache::remember($cacheKey, now()->addMonths(6), fn() => ...)
```

### 3. Fallback Gracefully

```php
// Service sudah handle fallback otomatis
try {
    return $this->translate($text, $targetLang);
} catch (\Exception $e) {
    return $text; // Return original
}
```

### 4. Batch When Possible

```php
// ✅ GOOD - Single API call
$results = $service->batchTranslate($categoryNames, 'zh');

// ❌ BAD - Multiple API calls
foreach ($categoryNames as $name) {
    $result = $service->translate($name, 'zh');
}
```

---

## Performance Considerations

### First Load (No Cache)

- ❌ Slow - API call untuk setiap unique category
- Timeline: ~200-500ms per category
- Example: 5 categories = ~2 seconds

### Subsequent Loads (With Cache)

- ✅ FAST - Direct dari cache
- Timeline: <1ms per category
- Example: 5 categories = ~5ms

### Recommendation

Warm up cache setelah deploy:

```php
php artisan tinker

// Translate all categories
$categories = App\Models\TransactionCategory::pluck('label');
$service = app(App\Services\TranslationService::class);
$service->batchTranslate($categories->toArray(), 'zh', 'id');
```

---

## Future Enhancements

### 1. Background Translation

Schedule translation di background untuk warm-up cache:

```php
// app/Console/Kernel.php
$schedule->call(function () {
    $service = app(TranslationService::class);
    $categories = TransactionCategory::pluck('label');
    $service->batchTranslate($categories->toArray(), 'zh', 'id');
})->daily();
```

### 2. Database Translation Cache

Create separate table untuk cache translation (optional):

```php
// migrations/create_translations_table.php
Schema::create('translations', function (Blueprint $table) {
    $table->id();
    $table->string('source_lang', 2);
    $table->string('target_lang', 2);
    $table->string('source_text');
    $table->string('translated_text');
    $table->timestamp('cached_at');
    $table->unique(['source_lang', 'target_lang', 'source_text']);
});
```

### 3. Manual Translation Override

Allow admin to override auto-translation:

```php
// If manual translation exists, use it
$manualTranslation = Translation::where([
    'source_text' => $text,
    'target_lang' => $targetLang,
])->value('manual_override');

return $manualTranslation ?? $this->translate($text, $targetLang);
```

---

## Summary

- ✅ **Zero DB Changes** - No migration needed
- ✅ **Auto Cache** - 6 months TTL
- ✅ **Easy to Use** - Global helper functions
- ✅ **Graceful Fallback** - Show original if failed
- ✅ **Production Ready** - Can upgrade to paid APIs later

**Next Steps:**
1. Run `composer dump-autoload`
2. Test di tinker
3. Deploy & enjoy auto-translation! 🎉
