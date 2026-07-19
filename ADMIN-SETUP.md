# Seasider Esports — Officer Admin Panel

The site now has an admin panel at **`/admin.html`** (there's also an "Officer Login"
link in every page footer). Officers sign in and manage everything on the site:

| Panel section  | What it controls |
|----------------|------------------|
| Home Page      | Hero title/text/photo, countdown toggle + target date, games grid |
| Matches        | Schedule + results (add/edit/delete, scores), page intro text, register banner |
| Bracket        | The full 8-team bracket shown on the Matches page |
| Standings      | Team rows (auto-ranked by points), qualified highlight, footnote |
| News           | Posts (newest first), one pinned post with its link button |
| Photos         | Gallery tiles: upload images, captions, tile size, ordering |
| Videos         | Video cards + one featured video (also shown on the home page) |
| Site Settings  | Ticker messages, Facebook/Discord links, register link, footer |
| Officers       | Who can log in |

Home page "Upcoming Matches", "Announcements", and "Latest Video" fill in
automatically from the Matches, News, and Videos data.

---

## Demo mode (works right now, no setup)

Until Firebase is configured, the panel runs in **demo mode**:

- Sign in at `/admin.html` with **officer@byuh.edu** / **seasiders**
- All content and officer accounts are stored **in that browser only**
  (localStorage). Open the public pages in the same browser to see your edits.
- "Reset everything" in Site Settings → Data Tools restores the defaults.

Demo mode is for trying the panel and building content locally. Nothing is
shared between computers, and demo passwords are not real security.

## Going live with Firebase (free tier, ~15 minutes)

1. **Create a project** at https://console.firebase.google.com (any name, e.g.
   `seasider-esports`). Google Analytics is optional.
2. **Enable login:** Build → Authentication → Get started → Sign-in method →
   enable **Email/Password**, and also **Google** (the panel has a
   "Continue with Google" button — officers on the allowlist can sign in with
   their Google account, no password needed).
3. **Create the database:** Build → Firestore Database → Create database →
   production mode → pick a US region.
4. **Get your config:** Project settings (gear icon) → Your apps → Web app
   (`</>`) → register the app → copy the `firebaseConfig = { ... }` object and
   paste it over the placeholder in **`firebase-site/firebase-config.js`**.
   The site switches from demo mode to live mode automatically.
5. **Add the first officer:** In Firestore, click **Start collection** → ID
   `officers` → document ID = your email **in lowercase** (e.g.
   `you@go.byuh.edu`) → add a field `name` with your name.
6. **Publish the security rules:** Firestore Database → Rules → replace the
   contents with the contents of **`firestore.rules`** (in this folder) →
   Publish. These rules make content publicly readable but only writable by
   people on the officer list.
7. **Sign in:** open `/admin.html` → press **Continue with Google** with the
   account from step 5. (No Google account? In the Firebase console go to
   Authentication → Users → **Add user** with that email and a password —
   there is deliberately no self-signup on the login screen.) Use Site
   Settings → **Load sample content** to fill the site with the starter
   content, then edit away.

Officers after the first one are easier: an existing officer adds their email
on the Officers page — that creates their sign-in account and emails them a
link to set their own password. Google-account officers can skip the email
and just press "Continue with Google".

### Deploying the site to Firebase Hosting

```
npm install -g firebase-tools
firebase login
cd <this folder>          # the folder containing firebase.json
firebase use --add        # pick your project
firebase deploy           # deploys hosting + firestore rules
```

Your site goes live at `https://<project-id>.web.app`, admin panel at
`/admin.html`, and every officer edit is instantly visible to everyone.

## Notes & limits

- **Photos/thumbnails** are compressed in the browser (max ~1400px JPEG) and
  stored inside the database, which keeps everything on Firebase's free tier.
  Firestore documents cap at 1 MB, so keep uploads to normal photo sizes — the
  panel warns you if an upload is still too large. If the club ever wants
  full-resolution albums, that's what Firebase Storage is for (paid plan on
  new projects); linking a Facebook album is the free alternative.
- **admin.html is only a door, not the lock.** In live mode the real
  protection is the Firestore rules: even someone who opens the admin page
  cannot write anything unless their signed-in email is in `officers`.
- The original static content of each page remains in the HTML as a fallback
  and shows whenever no data is available (e.g. Firebase configured but empty).
