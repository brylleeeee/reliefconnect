<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * Turns a name into a comparison key, so the same person written differently still matches:
 *   "Ma. Dela Cruz"  -> "maria dela cruz"     "MARIA DE LA CRUZ" -> "maria dela cruz"
 *   "Sto. Niño"      -> "santo nino"          "Juan  Cruz, Jr."  -> "juan cruz jr"
 * Suffixes (Jr., Sr., III) are kept: a father and son can share a name.
 */
class PersonName
{
    private const TOKENS = ['ma' => 'maria', 'sto' => 'santo', 'sta' => 'santa', 'ma.' => 'maria'];

    /** "de la" -> "dela", "de los" -> "delos", "de los santos" -> "delos santos" */
    private const PARTICLES = ['/\bde la\b/' => 'dela', '/\bde los\b/' => 'delos', '/\bdel a\b/' => 'dela'];

    public static function key(string $name): string
    {
        $s = Str::lower(Str::ascii(trim($name)));          // ñ -> n, é -> e
        $s = preg_replace('/[.,\'"`\-]+/', ' ', $s);         // punctuation becomes a space
        $s = preg_replace('/\s+/', ' ', trim($s));
        $s = preg_replace(array_keys(self::PARTICLES), array_values(self::PARTICLES), $s);

        $tokens = array_map(fn ($t) => self::TOKENS[$t] ?? $t, explode(' ', $s));

        return mb_substr(implode(' ', array_filter($tokens, fn ($t) => $t !== '')), 0, 150);
    }

    /**
     * Probably the same person written a little differently ("Jon Cruz" / "John Cruz",
     * "Maria Santos" / "Maria L. Santos")? Used only for warnings, never to block.
     */
    public static function similar(string $keyA, string $keyB): bool
    {
        if ($keyA === $keyB) {
            return true;
        }
        $a = explode(' ', $keyA);
        $b = explode(' ', $keyB);

        // Same first and last name, different or missing middle name / initial
        if (count($a) > 1 && count($b) > 1 && $a[0] === $b[0] && end($a) === end($b)) {
            return true;
        }

        // A typo or two
        return levenshtein($keyA, $keyB) <= max(2, (int) floor(min(strlen($keyA), strlen($keyB)) * 0.15));
    }
}
