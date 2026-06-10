# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

A Progressive Web App (PWA) for building inspectors to conduct and submit site surveys offline from a tablet. Surveyors search for planning applications, load them to device (IndexedDB), fill a 4-step survey form, then sync back to the BCOS back-office system when online.

## Stack

- **Backend**: PHP 8+ served via Apache on `devapp.myplanit.uk`. No framework — plain procedural PHP.
- **Frontend**: Vanilla JS (no bundler, no framework). Three files loaded in order: `db.js` → `sync.js` → `app.js`.
- **Database**: MariaDB, database `bcos_dev` (dev) / `bcos` (prod). Uses `mysqli_*` directly.
- **Offline storage**: Browser IndexedDB (`survey_offline` DB, version 1).
- **PWA**: Service worker in `sw.js`, manifest in `manifest.json`.

## Architecture

### Request/response flow

1. `index.php` — PHP session gate (redirects to `/login.html` if unauthenticated). Injects `APP_VERSION` and `IS_DEV` as JS globals, then loads the three JS files.
2. All UI is rendered client-side by `app.js` into `#app-main`. No page navigations — single-page, view-switching pattern.
3. API calls go to `/api/*.php`. All require `require_auth()` (401 if session missing). `sync-survey.php` also requires a CSRF token fetched from `/api/csrf-token.php` immediately before POST.

### State

A single global `state` object in `app.js` tracks the current view (`home`, `app`, `survey`, `pending`), the loaded application, and the in-progress survey form. There is no reactive framework — views are re-rendered by calling `renderHomeView()`, `renderAppView()`, `showPendingView()`, or `renderSurveyForm()`.

### Offline / sync

- `db.js` owns IndexedDB. Stores: `applications`, `static_data`, `pending_surveys`, `survey_photos`.
- `sync.js` owns the sync logic: `syncSurvey(localID)` fetches a CSRF token then POSTs `FormData` to `/api/sync-survey.php`.
- Survey photos are stored as blobs in `survey_photos` and appended to the `FormData` as `upload[]` on sync.
- The service worker (`sw.js`) uses cache-first for the app shell and network-first for `/api/` calls.

### Application IDs

Application IDs are encrypted (AES-256-CBC) between the browser and the server using the constants `_SALT_`, `_KEY_1_`, `_KEY_2_` in `api/config.php`. The `do_crypt()` helper encrypts/decrypts. These must match the BCOS back-office system's keys.

### Authentication

Two paths:
- **Username/password**: `api/login.php` checks against `SURVEY_APP_USER` / `SURVEY_APP_PASS_HASH` (bcrypt). Default credentials: `surveyor` / `Survey2024!`.
- **Google OAuth**: `api/google-auth.php` → `gateway/google-callback.php`. Configured via `_GOOGLE_CLIENT_ID_` etc. in `api/config.php`.

Both set `$_SESSION['survey_user']` on success.

## Dev vs production

`APP_ENV` is set to `'development'` in both `index.php` and `api/config.php`. Change both to `'production'` for live deployment. Dev mode shows a "Development Environment" banner and a Sign Out button in the footer.

Database credentials, encryption keys, and Google OAuth secrets are all hardcoded in `api/config.php` — this file must not be committed with production secrets.

## Versioning

`APP_VERSION` is defined in `index.php` and `api/config.php` (must stay in sync). The service worker cache key (`CACHE` in `sw.js`) must also be bumped on each release to force cache invalidation.

When incrementing a version:
1. Update `APP_VERSION` in `index.php`
2. Update `APP_VERSION` in `api/config.php`
3. Update `CACHE` in `sw.js` to match

## Key files

| File | Purpose |
|------|---------|
| `api/config.php` | DB connection, encryption keys, auth constants, helper functions |
| `api/sync-survey.php` | Receives survey POST, inserts into `surveys`, defects, advisories, uploads |
| `api/static-data.php` | Returns lookup data (staff, inspection types, weather, defects, advisories) |
| `api/load-application.php` | Returns a single application record for offline caching |
| `db.js` | All IndexedDB read/write operations |
| `sync.js` | Survey sync logic + badge update |
| `app.js` | All UI rendering, state, form logic |
| `sw.js` | Service worker (cache strategy) |

## Database tables (relevant to this app)

`surveys`, `survey_defects`, `survey_advisory`, `filemanager`, `applications`, `application_ticks`, `application_cron`, `21_day_reminder`, `access` (staff lookup).

## PHP helpers (api/config.php)

- `sql(string $query)` — executes query, dies with JSON error on failure
- `safe(string $string)` — `mysqli_real_escape_string` wrapper
- `do_crypt(string, 'e'|'d')` — AES-256-CBC encrypt/decrypt
- `require_auth()` — exits 401 JSON if not authenticated
- `csrf_token()` — generates/returns session CSRF token
