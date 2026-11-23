<?php

namespace App\Mcp;

use Lcobucci\JWT\Validation\Constraint\LooseValidAt;
use Lcobucci\JWT\Validation\ConstraintViolation;
use Lcobucci\JWT\Validation\RequiredConstraintsViolated;
use League\OAuth2\Server\Exception\OAuthServerException;
use Throwable;

/**
 * Penolakan token Bearer di /mcp/keuangan yang termasuk alur normal koneksi Claude. Guard
 * Passport menjawabnya 401 + WWW-Authenticate (Claude lalu memakai refresh token atau meminta
 * login ulang), tetapi tetap memanggil report(), sehingga setiap kejadian menjadi error di
 * Watchpost (#20). Yang wajar:
 *
 * - token kedaluwarsa: token akses berumur 1 jam (AppServiceProvider);
 * - token dicabut: Pengaturan › Koneksi Claude › Cabut, atau token lama yang dicabut refresh.
 *
 * Tanda tangan yang tidak cocok dan token rusak TIDAK termasuk dan tetap dilaporkan: dalam
 * operasi normal keduanya tidak pernah terjadi. Artinya kunci OAuth server berubah (semua token
 * akses lama sekaligus tidak berlaku) atau ada yang mengirim token dari server lain atau palsu.
 */
class TokenDitolak
{
    public static function wajar(Throwable $e): bool
    {
        if (! $e instanceof OAuthServerException || $e->getErrorType() !== 'access_denied') {
            return false;
        }

        if ($e->getHint() === 'Access token has been revoked') {
            return true;
        }

        $pelanggaran = $e->getPrevious();

        return $pelanggaran instanceof RequiredConstraintsViolated
            && $pelanggaran->violations() !== []
            && collect($pelanggaran->violations())
                ->every(fn (ConstraintViolation $v) => $v->constraint === LooseValidAt::class);
    }
}
