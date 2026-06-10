# BCOS Site Survey App

A Progressive Web App (PWA) for building inspectors to conduct and submit site surveys from a tablet, with full offline support.

## Overview

Surveyors use this app to:
1. Search for planning applications (requires online connection)
2. Load applications to their device for offline access
3. Complete a 4-step survey form (supervision details, report, defects/advisories, contractor/photos)
4. Submit surveys — saved locally if offline, synced to BCOS when connectivity returns

The app is served at `https://devapp.myplanit.uk` (development) and is installable as a PWA on iOS and Android.

## Authentication

Two login methods are supported:

- **Username/password**: `surveyor` / `Survey2024!` (development credentials — change for production)
- **Google OAuth**: Configured via Google Cloud Console; callback handled at `/gateway/google-callback.php`

## Development Setup

### Requirements

- PHP 8+ with `mysqli` extension
- Apache with `mod_headers` enabled
- MariaDB with access to the `bcos_dev` database
- The BCOS back-office system running (provides the application/survey data)

### Configuration

All configuration is in `api/config.php`:

```
$_db_user = 'bcos_dev';
$_db_pass = '...';
$_db_data = 'bcos_dev';
```

The encryption keys (`_SALT_`, `_KEY_1_`, `_KEY_2_`) must match those in the BCOS back-office system — they are used to encrypt/decrypt application IDs passed between the two systems.

### Environment flag

`APP_ENV` is set in two places and must be kept in sync:
- `index.php` — controls the dev banner in the UI
- `api/config.php` — controls server-side behaviour (e.g. commencement emails are suppressed in dev)

Change both to `'production'` before live deployment.

## Releasing a new version

1. Increment `APP_VERSION` in `index.php`
2. Increment `APP_VERSION` in `api/config.php`
3. Update the `CACHE` constant in `sw.js` to match (e.g. `survey-devapp-v1.0.1`)

This forces installed PWAs to pick up the new service worker and show the in-app update prompt.

## File uploads

Survey photos are uploaded via `sync-survey.php` and stored under `uploads/{appID}/`. Accepted types: JPEG, PNG, BMP, WebP, PDF, Word, Excel. The upload directory must be writable by the web server.

## Error logs

PHP errors are written to `.errors` in each directory (e.g. `api/.errors`). These files are not served publicly.

---

&copy; Cirrus Design Studio Ltd
