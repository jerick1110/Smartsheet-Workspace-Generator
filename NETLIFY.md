# 🚀 Hosting your Smartsheet Workspace Directory on Netlify

This application is built with a dual-mode communication engine. It works out-of-the-box as a **static single page application (SPA)** on services like **Netlify** without requiring any back-ends or server configuration!

---

## 🛠️ Quick Steps to Deploy to Netlify

### 1. Push to your GitHub Repository
Initialize Git in your folder (or download your app zip), push it to your private or public GitHub repository:
```bash
git init
git add .
git commit -m "feat: first release of Smartsheet directory"
# Link to your github repo:
git remote add origin https://github.com/your-username/your-repo.git
git branch -M main
git push -u origin main
```

### 2. Connect to Netlify
1. Log in to your [Netlify Console](https://app.netlify.com/).
2. Click **Add new site** -> select **Import an existing project**.
3. Choose **GitHub** and select your directory repository.
4. Netlify will auto-detect the configuration settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Click **Deploy Site**.

---

## ⚡ How direct Smartsheet communication works on Netlify

When running locally or on server environments, the app routes requests through an Express proxy. 
However, since Netlify hosts **purely static static assets**, the frontend has a **smart auto-fallback**:
* If the app detects that the mock/Express server proxy is not reachable, it automatically transitions to **Secure Client-Side Mode**.
* It establishes a direct browser connection with `api.smartsheet.com`, appending your inputted personal access token as:
  `Authorization: Bearer <your_token>`
* This completely avoids CORS issues and operates with zero servers or extra configurations!

---

## 🧭 Dynamic Routing Fallback
We have pre-configured a `/public/_redirects` file with the following directive:
```text
/* /index.html 200
```
This guarantees that if you reload the page on any custom route or share link inside your Netlify domain, Netlify will gracefully fall back to serving your React application without throwing a `404 Not Found` error.
