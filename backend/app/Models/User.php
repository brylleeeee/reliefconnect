<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    public const ROLE_MUNICIPAL_ADMIN = 'municipal_admin';
    public const ROLE_BARANGAY_ADMIN = 'barangay_admin';
    public const ROLE_DISTRIBUTION = 'distribution_personnel';
    public const ROLE_RESIDENT = 'resident';

    protected $fillable = ['name', 'email', 'password', 'role', 'position', 'barangay_id'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function barangay()
    {
        return $this->belongsTo(Barangay::class);
    }
}
