<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Role-Based Access Control.
 * Usage in routes: ->middleware('role:municipal_admin')
 *                  ->middleware('role:municipal_admin,distribution_personnel')
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user || ! in_array($user->role, $roles, true)) {
            abort(403, 'Your account does not have access to this function.');
        }

        return $next($request);
    }
}
