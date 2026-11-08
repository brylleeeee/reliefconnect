<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    // Gemini (Google AI Studio) calculates which barangay gets relief goods first (SOS Prioritization).
    // Leave the key empty and the page falls back to a plain formula.
    'gemini' => [
        'key' => env('GEMINI_API_KEY'),
        'model' => env('GEMINI_MODEL', 'gemini-3.5-flash-lite'),
        // Tried when the main model is busy (429/5xx), slow or unreachable
        'fallback_model' => env('GEMINI_FALLBACK_MODEL', 'gemini-3.1-flash-lite'),
        'timeout' => (int) env('GEMINI_TIMEOUT', 30), // seconds per model attempt
        // Daily budget (Philippine time) shown on the AI status card; 0 = no limit. When it is used up the
        // built-in rules take over until midnight. Set it at or below your free-tier limit in AI Studio.
        'daily_requests' => (int) env('GEMINI_DAILY_REQUESTS', 500),
        'daily_tokens' => (int) env('GEMINI_DAILY_TOKENS', 0),
    ],

    // Push notifications: Laravel -> Expo Push Service -> Firebase (FCM) -> the phone.
    // EXPO_ACCESS_TOKEN is optional (only needed if "Enhanced Security for Push Notifications" is on in expo.dev).
    'expo' => [
        'push_url' => env('EXPO_PUSH_URL', 'https://exp.host/--/api/v2/push/send'),
        'access_token' => env('EXPO_ACCESS_TOKEN'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
