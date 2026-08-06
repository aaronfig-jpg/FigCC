# Go live — putting the app on your phone and Dad's

Plain-English walkthrough. Goal: the app lives at a web address, and both you and Dad tap an icon on the home screen to use it — offline, at a customer's house. No app store, no accounts, no monthly cost.

There are two ways to host it. Start with the fastest.

---

## Option A — GitHub Pages (recommended, free, permanent)

You already use GitHub. This gives the app a permanent `https://` address that works on any phone.

### 1. Make a repository

- Go to github.com → **New repository**.
- Name it something like `figueroas-estimator`.
- **Set it to Private is fine** for the code — GitHub Pages can still serve it. (The app has no customer data in it, so Public is also OK. Either way, customer files never go in here — see the privacy note at the bottom.)
- Create it.

### 2. Put the app files in it

Easiest without touching a terminal:

- On the new repo page, click **uploading an existing file**.
- Open the `Estimate-Job-Invoice App` folder on your Mac, select **everything inside it** (index.html, app.js, styles.css, the `vendor`, `icons`, and `scripts` folders, manifest.webmanifest, sw.js, README.md), and drag it into the browser.
- Wait for the upload, then **Commit changes**.

> The files must sit at the **top level** of the repo (so the address ends in `/index.html`), not inside a subfolder.

### 3. Turn on Pages

- Repo → **Settings** → **Pages** (left sidebar).
- Under **Build and deployment → Source**, pick **Deploy from a branch**.
- Branch: **main**, folder: **/ (root)**. Save.
- Wait ~1 minute. The page will show your live URL, like
  `https://YOURNAME.github.io/figueroas-estimator/`

Open that URL on your computer to confirm it loads. That's the app, live.

### 4. Install it on the phones

On **Dad's iPhone** (and yours):

- Open the URL in **Safari**.
- Tap the **Share** button (square with an up arrow).
- Scroll down → **Add to Home Screen** → **Add**.
- A red **F** icon appears on the home screen. Tapping it opens the app full-screen, no browser bars.

On **Android**: open the URL in Chrome → menu (⋮) → **Add to Home screen**.

After the first open with signal, it's cached — it works with **no internet** at a job.

### Updating it later

When I change the app, re-upload the changed files to the repo (same drag-and-drop, Commit). The phones pick up the new version next time they open with a connection. If something looks stale, close the app fully and reopen.

---

## Option B — Just test it on your Mac first

Before hosting, you can run it locally to click around:

```
cd "Estimate-Job-Invoice App"
python3 -m http.server 8000
```

Open `http://localhost:8000` in your browser. (It needs `http://`, not double-clicking the file, because the offline feature only runs over a real address.)

---

## How Dad uses it, day to day

1. **Estimate** — at the customer's house. Tap **By room** or **By square foot** for carpet, then tap the **+** on each item (rooms, hallways, stairs, pet areas, sofas, rugs…). The total builds live at the bottom. Every price is editable if a job is unusual — tap the little price box. The $120 minimum handles itself. If he prices carpet under $100/room, a yellow reminder shows.
2. **Continue to job** — pick the customer (or type a new one), then add square footage, **hours on site**, who worked it, and payment. Tap **Save job**.
3. **Invoice** — tap **Generate PDF invoice**, then **Share / Save** to text or email it to the customer, or save it to Files. It looks exactly like your current invoices.

Everything he saves lives on his phone. Nothing is lost if there's no signal.

---

## Bringing the jobs back into your system (once a week)

The app is the front line; your `client-database.xlsx` and the Carpet King case study stay the record of truth. To sync:

1. In the app, go to **Saved → Export (JSON)**. AirDrop or email that file to your Mac.
2. On your Mac, in the `Estimate-Job-Invoice App` folder:
   ```
   python3 scripts/import_jobs.py ~/Downloads/figueroas-export.json --dry-run
   ```
   The `--dry-run` shows what it *would* add without changing anything. If it looks right, run it again **without** `--dry-run`. It appends the jobs (and any new customers) to `client-database.xlsx` and writes a backup first.
3. Open the workbook once in Excel/Numbers so the Job ID and Final Price formulas fill in.

That's also what feeds the case study — every synced job carries the square footage, hours, and ZIP the analysis needs.

### Giving Dad the repeat-customer list (one time)

So Dad doesn't retype regulars. A ready-made file with your current 38 customers is already generated at:

```
03 Projects/Figueroa's Carpet Cleaning/customers-PRIVATE-do-not-upload.json
```

(It lives outside the app folder on purpose — it holds real customer data and must never go in the GitHub repo.)

1. AirDrop that file to the phone (Files app).
2. In the app: **Clients tab → Import customers**, pick the file. The 38 customers appear on the **Clients** tab and in the customer dropdown on the Job screen.
3. To regenerate it later after the list grows: `python3 scripts/export_customers.py --out "../customers-PRIVATE-do-not-upload.json"`.

The **Clients** tab is also a full editor — add, edit, or delete customers right on the phone.

---

## Updating the app after I change it

When the app files change, two things have to happen:

1. **Re-upload the changed files to the repo** (drag the new `index.html`, `app.js`, `styles.css`, `sw.js`, etc. into the repo's root, Commit).
2. **The phone has to refresh its cached copy.** The app caches itself to work offline, so it won't show changes instantly. To force it: close the app fully (swipe it away in the app switcher) and reopen it **with internet** once or twice. I bump an internal version number on each change, which tells the phone to pull the new files on the next online open.

If the phone still looks old after that, remove the icon and re-add it from Safari (Share → Add to Home Screen).

---

## Privacy — the one rule

`customers.json` and the exports hold real names, phones, and addresses. **Never upload them to the GitHub repo.** The included `.gitignore` already blocks them, and the app itself carries no customer data — so the public web only ever sees blank software. Customer data moves Mac ↔ phone privately (AirDrop/Files) and nowhere else.

---

## If something breaks

- **Icon opens a blank page:** the files aren't at the repo root, or Pages is still building. Wait a minute, recheck the Pages settings.
- **"Add to Home Screen" missing:** you're not in Safari (iPhone) or Chrome (Android). Other browsers don't offer install.
- **Old version showing:** close the app fully (swipe it away) and reopen with signal.
- **PDF won't share on an older phone:** tap **Open PDF** instead, then use the browser's share/save.
