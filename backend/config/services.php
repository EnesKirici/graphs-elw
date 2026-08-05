<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
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

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
     * Google Search Console — service account ile sunucudan sorgu.
     * credentials: JSON anahtar yolu (storage/app zaten .gitignore'da → depoya sızmaz).
     * site_url: elwgraphs.com GSC'ye ALAN ADI mülkü olarak eklendi; bu yüzden
     *           "https://..." değil "sc-domain:" biçimi şart, yoksa 403 gelir.
     */
    'gsc' => [
        'credentials' => env('GSC_CREDENTIALS', storage_path('app/google/gsc.json')),
        'site_url'    => env('GSC_SITE_URL', 'sc-domain:elwgraphs.com'),
    ],

];
