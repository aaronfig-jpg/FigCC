# Figueroa's — Estimate · Job · Invoice (V1)

A phone-first web app for pricing a job at the customer's house, turning it into a job record, and generating the branded PDF invoice on the spot. Works offline. No backend. Installs to the home screen.

Built from `(C) Estimate-Job-Invoice App — Findings & Spec.md`. The pricing model and invoice branding match `generate_invoice.py` and the Quick Price Sheet.

## What it does

Three screens, in order:

1. **Estimate** — pick a pricing basis and build the number.
   - **Carpet by room** ($100/room, $40 hallway, $40 stairs, +$40 pet area) or **by square foot** ($0.35/sq ft default — editable).
   - **Upholstery** and **rugs** are per-piece on top of either.
   - Every quantity has +/- and a typable box; every price is editable inline. The $120 minimum applies automatically. A nudge fires if the per-room price drops below the $100 standard.
   - Commercial toggles off auto-pricing and shows the "walk it, quote by phone" reminder.
2. **Job** — attach a customer (pick an existing one or add new), then capture square footage, **hours on site**, technician, payment method, paid status, discount, and notes. Save.
3. **Invoice** — one tap renders the branded PDF (red banner, pay methods, Google-review QR). Share it to the customer or save it from the phone's share sheet.

The **Saved** tab lists every job and exports them.

## Where the data lives

Jobs and customers are stored **on the phone** in the browser's IndexedDB. This is the source of truth — it works with no signal at a customer's house and needs no server. Nothing leaves the phone unless you export it.

## Feeding the client database and the case study

From **Saved → Export all (CSV)** you get `figueroas-jobs-export.csv`. Its columns match `Customer & Pricing Analytics/01 Data/clean/(C) jobs_clean.csv`, so it drops straight into:

- **`client-database.xlsx`** — append the rows (Jobs sheet).
- **The Carpet King case study** — the export captures the three fields Part B was blocked on: `sq_ft`, `labor_hours` (hours on site), and `zip`.

JSON export (jobs + clients, full fidelity) is there for backup and re-import.

> Note: a phone browser can't write to `client-database.xlsx` in the vault directly, so the flow is export-on-phone, import-on-Mac. If you later run this from a desktop browser, a direct File System Access write can be added.

## Run it

**Locally (test):**
```
cd "Estimate-Job-Invoice App"
python3 -m http.server 8000
```
Open `http://localhost:8000`. A service worker needs `http(s)`, not `file://`.

**Host on GitHub Pages (for the phone):**
1. Put this folder in a repo (or a `/docs` folder).
2. Settings → Pages → deploy from the branch/folder.
3. Open the Pages URL on Dad's phone → Share → **Add to Home Screen**. It then runs full-screen and offline.

## Files

| File | Purpose |
|---|---|
| `index.html` | UI shell, three screens |
| `app.js` | pricing engine, IndexedDB, PDF, export |
| `styles.css` | phone-first styling, dark-mode aware |
| `vendor/jspdf.umd.min.js` | PDF library, vendored so it works offline |
| `manifest.webmanifest`, `sw.js` | installable + offline |
| `icons/` | home-screen icons |

## To confirm with Dad

- **The $/sq ft rate.** $0.35 is reverse-engineered from the $100/room standard, not real data. Adjust it in the Estimate screen; the app collecting real square footage is what will let the case study calibrate it.

## Not in V1 (candidates for V2)

- Direct write-back into `client-database.xlsx` (needs desktop File System Access or a small sync step).
- Editing a saved job / deleting jobs from the UI.
- Auto-firing the review request + tracker the way `generate_invoice.py` does.
- Pulling the existing customer list in from `client-database.xlsx` (today the app builds its own customer list as you go).
