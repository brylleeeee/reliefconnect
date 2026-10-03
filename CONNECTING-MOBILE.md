# Connecting the mobile app to the Laravel API

The mobile app (`mobile/`) and the admin web (`frontend/`) share one Laravel API (`backend/`).
Residents and distribution staff use the same `/api/login`; the token is stored in the phone's
encrypted storage (`expo-secure-store`) and sent as `Authorization: Bearer <token>`.

## Run it

1. **Backend** (laptop): after pulling, run
   ```bash
   cd backend
   php artisan migrate:fresh --seed
   php artisan serve --host=0.0.0.0 --port=8000
   ```
   Allow PHP through Windows Firewall when asked. Find the laptop's IPv4 address with `ipconfig`.

   **PHP upload limits (each laptop, once):** run `php.exe --ini` to find the loaded `php.ini`
   (with Herd Lite: `C:\Users\<you>\.config\herd-lite\bin\php.ini`) and add
   `upload_max_filesize = 10M`, `post_max_size = 25M`, `memory_limit = 256M`, then restart `php artisan serve`.
   Check with `php.exe -i | grep -E "upload_max_filesize|post_max_size"`.
2. **Mobile**:
   ```bash
   cd mobile
   npm install
   cp .env.example .env      # then set EXPO_PUBLIC_API_URL=http://<laptop IP>:8000/api
   npx expo start -c         # -c clears the cache so the new .env is read
   ```
   The phone and the laptop must be on the same Wi-Fi (school Wi-Fi often blocks this; a phone hotspot works).
   Quick test: open `http://<laptop IP>:8000/up` in the phone's browser.

## Demo accounts (password: `password`)

| App | Log in with | Notes |
|---|---|---|
| Resident | `09171234567` | Approved household in Batancaoa, QR issued |
| Staff | username `staff` | Can record claims for any barangay whose distribution is ongoing |
| Admin web | `admin@urbiztondo.test`, `batancaoa@urbiztondo.test` | Approve the app registrations in QR Issuance Review |

To test the staff app, a barangay must first **start** its distribution day in the admin web
(Barangay Admin → Distributions), otherwise the staff dashboard has nothing to serve.

## End-to-end test

1. Resident app: Register with a new number → fill household (barangay, purok, members) → upload both photos → Submit.
2. Admin web (Barangay Admin of that barangay): QR Issuance Review → open the household → view documents → Approve.
3. Resident app: Our QR tab → pull down to refresh → QR and reference number appear.
4. Admin web: LGU Admin creates a Distribution Event that includes that barangay; Barangay Admin schedules and starts it.
5. Staff app: log in → pick the distribution → scan the resident's QR (or type the reference number) → Release.
6. Scan the same QR again → "This household already claimed for this event."

## Endpoints used by the app

| Method | Endpoint | Used by |
|---|---|---|
| POST | `/api/login` `{ login, password, device_name }` (login = email, phone or username) | Both |
| POST | `/api/register` `{ name, phone, password }` | Resident sign-up |
| GET | `/api/me`, POST `/api/logout` | Both |
| GET | `/api/barangays` (public) | Household form |
| GET | `/api/resident/household` (404 if none yet) | QR tab, login |
| POST | `/api/resident/household` (JSON: `barangay_id, purok, address, is_solo_parent, members[]`, plus `valid_id_base64` and `birth_certificate_base64` as data URIs; multipart file uploads also accepted) | Household form |
| GET | `/api/resident/announcements` | Home tab |
| GET | `/api/distribution/events` (ongoing, with `quota` and `claimed`) | Staff dashboard |
| GET | `/api/distribution/events/{event}/check?reference_number=` | Verification |
| POST | `/api/distribution/events/{event}/claims` `{ reference_number, verification_method }` | Release aid |

## Not done yet (see the sprint to-do list)

- **Dynamic QR**: the QR currently encodes the reference number. The signed, expiring token (Sprint 2) only changes
  `qr_value` in `/resident/household` and the check endpoint; the screens stay the same.
- **Offline claims**: the staff app needs a connection to check and record claims. The offline queue + batch sync is Sprint 3.
- **SMS and push notifications**, **SOS** (tab is disabled), **change password**.
