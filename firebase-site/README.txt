SEASIDER ESPORTS — static site for Firebase Hosting

ADMIN PANEL: officers can edit all content at /admin.html.
See ADMIN-SETUP.md (one folder up) for the login details and
how to connect Firebase so edits go live for everyone.

Deploy:
1. Install Node.js LTS, then: npm install -g firebase-tools
2. firebase login
3. In this folder's parent, run: firebase init hosting
   - Public directory: firebase-site
   - Single-page app: No
4. firebase deploy

Editing:
- All pages share style.css.
- Image placeholders are <div class="ph">...</div> blocks — replace each with
  <img src="images/your-photo.jpg" alt=""> (put photos in an images/ folder).
- Update Facebook/Discord links in the footers and video hrefs.
- Countdown target date is set in the <script> at the bottom of index.html.
