<?php

return [

    /*
    |--------------------------------------------------------------------------
    | 验证语言行
    |--------------------------------------------------------------------------
    |
    | Pesan bawaan validator dalam Bahasa Mandarin (zh-CN). Kunci dan placeholder
    | sejajar dengan lang/id/validation.php (dijaga TeksServerMultiBahasaTest).
    | Gaya mengikuti docs/i18n/glosarium.md: tanpa spasi di sebelah :attribute /
    | :other (menghasilkan nama kolom Mandarin), satu spasi di sebelah angka dan nilai.
    |
    */

    'accepted' => '必须接受:attribute。',
    'accepted_if' => '当:other为 :value 时，必须接受:attribute。',
    'active_url' => ':attribute必须是有效的网址。',
    'after' => ':attribute必须是 :date 之后的日期。',
    'after_or_equal' => ':attribute必须是 :date 当天或之后的日期。',
    'alpha' => ':attribute只能包含字母。',
    'alpha_dash' => ':attribute只能包含字母、数字、连字符和下划线。',
    'alpha_num' => ':attribute只能包含字母和数字。',
    'any_of' => ':attribute无效。',
    'array' => ':attribute必须是数组。',
    'ascii' => ':attribute只能包含单字节的字母、数字和符号。',
    'before' => ':attribute必须是 :date 之前的日期。',
    'before_or_equal' => ':attribute必须是 :date 当天或之前的日期。',
    'between' => [
        'array' => ':attribute必须包含 :min 到 :max 项。',
        'file' => ':attribute的大小必须在 :min 到 :max KB 之间。',
        'numeric' => ':attribute必须介于 :min 和 :max 之间。',
        'string' => ':attribute必须为 :min 到 :max 个字符。',
    ],
    'boolean' => ':attribute必须为是或否。',
    'can' => ':attribute包含不允许的值。',
    'confirmed' => '两次输入的:attribute不一致。',
    'contains' => ':attribute缺少必需的值。',
    'current_password' => '密码错误。',
    'date' => ':attribute必须是有效的日期。',
    'date_equals' => ':attribute必须是与 :date 相同的日期。',
    'date_format' => ':attribute必须符合 :format 格式。',
    'decimal' => ':attribute必须有 :decimal 位小数。',
    'declined' => '必须拒绝:attribute。',
    'declined_if' => '当:other为 :value 时，必须拒绝:attribute。',
    'different' => ':attribute和:other必须不同。',
    'digits' => ':attribute必须是 :digits 位数字。',
    'digits_between' => ':attribute必须是 :min 到 :max 位数字。',
    'dimensions' => ':attribute的图片尺寸无效。',
    'distinct' => ':attribute有重复的值。',
    'doesnt_contain' => ':attribute不能包含以下任一项：:values。',
    'doesnt_end_with' => ':attribute不能以以下任一项结尾：:values。',
    'doesnt_start_with' => ':attribute不能以以下任一项开头：:values。',
    'email' => ':attribute必须是有效的邮箱地址。',
    'ends_with' => ':attribute必须以以下任一项结尾：:values。',
    'enum' => '所选的:attribute无效。',
    'exists' => '所选的:attribute无效。',
    'extensions' => ':attribute的扩展名必须是以下之一：:values。',
    'file' => ':attribute必须是文件。',
    'filled' => ':attribute不能为空。',
    'gt' => [
        'array' => ':attribute必须多于 :value 项。',
        'file' => ':attribute必须大于 :value KB。',
        'numeric' => ':attribute必须大于 :value。',
        'string' => ':attribute必须多于 :value 个字符。',
    ],
    'gte' => [
        'array' => ':attribute必须至少有 :value 项。',
        'file' => ':attribute必须大于或等于 :value KB。',
        'numeric' => ':attribute必须大于或等于 :value。',
        'string' => ':attribute必须至少为 :value 个字符。',
    ],
    'hex_color' => ':attribute必须是有效的十六进制颜色值。',
    'image' => ':attribute必须是图片。',
    'in' => '所选的:attribute无效。',
    'in_array' => ':attribute必须存在于:other中。',
    'in_array_keys' => ':attribute必须至少包含以下键之一：:values。',
    'integer' => ':attribute必须是整数。',
    'ip' => ':attribute必须是有效的 IP 地址。',
    'ipv4' => ':attribute必须是有效的 IPv4 地址。',
    'ipv6' => ':attribute必须是有效的 IPv6 地址。',
    'json' => ':attribute必须是有效的 JSON 字符串。',
    'list' => ':attribute必须是列表。',
    'lowercase' => ':attribute必须是小写字母。',
    'lt' => [
        'array' => ':attribute必须少于 :value 项。',
        'file' => ':attribute必须小于 :value KB。',
        'numeric' => ':attribute必须小于 :value。',
        'string' => ':attribute必须少于 :value 个字符。',
    ],
    'lte' => [
        'array' => ':attribute不能多于 :value 项。',
        'file' => ':attribute必须小于或等于 :value KB。',
        'numeric' => ':attribute必须小于或等于 :value。',
        'string' => ':attribute不能多于 :value 个字符。',
    ],
    'mac_address' => ':attribute必须是有效的 MAC 地址。',
    'max' => [
        'array' => ':attribute不能多于 :max 项。',
        'file' => ':attribute不能大于 :max KB。',
        'numeric' => ':attribute不能大于 :max。',
        'string' => ':attribute不能多于 :max 个字符。',
    ],
    'max_digits' => ':attribute不能超过 :max 位数字。',
    'mimes' => ':attribute必须是以下类型的文件：:values。',
    'mimetypes' => ':attribute必须是以下类型的文件：:values。',
    'min' => [
        'array' => ':attribute至少需要 :min 项。',
        'file' => ':attribute至少需要 :min KB。',
        'numeric' => ':attribute不能小于 :min。',
        'string' => ':attribute至少需要 :min 个字符。',
    ],
    'min_digits' => ':attribute至少需要 :min 位数字。',
    'missing' => '不应提供:attribute。',
    'missing_if' => '当:other为 :value 时，不应提供:attribute。',
    'missing_unless' => '除非:other为 :value，否则不应提供:attribute。',
    'missing_with' => '当 :values 存在时，不应提供:attribute。',
    'missing_with_all' => '当 :values 存在时，不应提供:attribute。',
    'multiple_of' => ':attribute必须是 :value 的倍数。',
    'not_in' => '所选的:attribute无效。',
    'not_regex' => ':attribute的格式无效。',
    'numeric' => ':attribute必须是数字。',
    'password' => [
        'letters' => ':attribute必须至少包含一个字母。',
        'mixed' => ':attribute必须至少包含一个大写字母和一个小写字母。',
        'numbers' => ':attribute必须至少包含一个数字。',
        'symbols' => ':attribute必须至少包含一个符号。',
        'uncompromised' => '此:attribute曾出现在数据泄露中，请换一个:attribute。',
    ],
    'present' => '必须提供:attribute。',
    'present_if' => '当:other为 :value 时，必须提供:attribute。',
    'present_unless' => '除非:other为 :value，否则必须提供:attribute。',
    'present_with' => '当 :values 存在时，必须提供:attribute。',
    'present_with_all' => '当 :values 存在时，必须提供:attribute。',
    'prohibited' => '不允许填写:attribute。',
    'prohibited_if' => '当:other为 :value 时，不允许填写:attribute。',
    'prohibited_if_accepted' => '当:other被接受时，不允许填写:attribute。',
    'prohibited_if_declined' => '当:other被拒绝时，不允许填写:attribute。',
    'prohibited_unless' => '除非:other在 :values 中，否则不允许填写:attribute。',
    'prohibits' => ':attribute不允许与:other同时填写。',
    'regex' => ':attribute的格式无效。',
    'required' => ':attribute不能为空。',
    'required_array_keys' => ':attribute必须包含以下项：:values。',
    'required_if' => '当:other为 :value 时，:attribute不能为空。',
    'required_if_accepted' => '当:other被接受时，:attribute不能为空。',
    'required_if_declined' => '当:other被拒绝时，:attribute不能为空。',
    'required_unless' => '除非:other在 :values 中，否则:attribute不能为空。',
    'required_with' => '当 :values 存在时，:attribute不能为空。',
    'required_with_all' => '当 :values 存在时，:attribute不能为空。',
    'required_without' => '当 :values 不存在时，:attribute不能为空。',
    'required_without_all' => '当 :values 都不存在时，:attribute不能为空。',
    'same' => ':attribute和:other必须相同。',
    'size' => [
        'array' => ':attribute必须包含 :size 项。',
        'file' => ':attribute的大小必须为 :size KB。',
        'numeric' => ':attribute必须为 :size。',
        'string' => ':attribute必须为 :size 个字符。',
    ],
    'starts_with' => ':attribute必须以以下任一项开头：:values。',
    'string' => ':attribute必须是文本。',
    'timezone' => ':attribute必须是有效的时区。',
    'unique' => ':attribute已被使用。',
    'uploaded' => ':attribute上传失败。请确认文件大小未超过服务器限制。',
    'uppercase' => ':attribute必须是大写字母。',
    'url' => ':attribute必须是有效的网址。',
    'ulid' => ':attribute必须是有效的 ULID。',
    'uuid' => ':attribute必须是有效的 UUID。',

    /*
    |--------------------------------------------------------------------------
    | 自定义验证消息
    |--------------------------------------------------------------------------
    */

    'custom' => [
        'attribute-name' => [
            'rule-name' => 'custom-message',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | 属性名称
    |--------------------------------------------------------------------------
    |
    | Nama kolom yang mudah dibaca untuk placeholder :attribute.
    |
    */

    'attributes' => [
        'title' => '标题',
        'description' => '描述',
        'amount' => '金额',
        'expense_date' => '支出日期',
        'category' => '类别',
        'category_id' => '交易类别',
        'attachment' => '附件',
        'action' => '操作',
        'review_notes' => '审核人备注',
        'bank_account_id' => '银行账户',
        'payment_date' => '付款日期',
        'payment_amount' => '付款金额',
        'reference_notes' => '参考备注',
        'name' => '名称',
        'email' => '邮箱',
        'password' => '密码',
        'phone' => '电话',
        'address' => '地址',
        'notes' => '备注',
        'date' => '日期',
        'start_date' => '开始日期',
        'end_date' => '结束日期',
        'due_date' => '到期日',
        'issue_date' => '开具日期',
    ],

];
