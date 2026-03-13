# Production Login Fix - Deployment Guide

## Issue
Login cards don't work in production because:
1. **CSP blocks JavaScript execution** - Production CSP has `script-src 'self'` which blocks Next.js inline scripts needed for React hydration and NextAuth's `signIn` function
2. **NEXTAUTH_URL misconfiguration** - Mismatch between NEXTAUTH_URL and actual access URL causes NextAuth CSRF token validation to fail

## Fix 1: Updated CSP Configuration ✅

**File:** `next.config.mjs`

**Changed production CSP from:**
```javascript
"script-src 'self'"  // ❌ Blocks Next.js inline scripts
```

**To:**
```javascript
"script-src 'self' 'unsafe-inline'"  // ✅ Allows Next.js inline scripts
```

**Also updated:**
- `font-src 'self' fonts.gstatic.com data:` (added `data:` for inline fonts)
- `img-src 'self' data: blob:` (added `blob:` for dynamic images)

### Why This Works
Next.js requires inline scripts for:
- React hydration after SSR
- Client-side navigation
- Event handlers (like login card clicks)
- NextAuth session management

Without `'unsafe-inline'`, these scripts are blocked by CSP, causing click handlers to never fire.

### Security Note
`'unsafe-inline'` reduces CSP protection but is required for Next.js to function. A more secure alternative is to use **nonces**, but that requires custom Next.js middleware configuration. For now, this is the practical fix.

---

## Fix 2: NEXTAUTH_URL Configuration

### On the GCP VM, verify the `.env` file:

```bash
cd ~/cmp/cmp-app
cat .env | grep NEXTAUTH_URL
```

**The NEXTAUTH_URL must match EXACTLY how users access the app:**

| Access Method | Required NEXTAUTH_URL |
|--------------|----------------------|
| IAP URL | `https://some-iap-url.googleusercontent.com` |
| Custom domain | `https://cmp.deriv.com` |
| External IP | `http://EXTERNAL_IP` |
| Localhost (dev) | `http://localhost:3000` |

### Example for IAP Access:
```bash
NEXTAUTH_URL="https://your-iap-url.googleusercontent.com"
```

### Example for Custom Domain:
```bash
NEXTAUTH_URL="https://cmp.deriv.com"
```

### How to Check the Correct URL:
1. Open the app in a browser
2. Copy the exact URL from the address bar (including protocol)
3. Use that as NEXTAUTH_URL (without any trailing slashes or paths)

---

## Deployment Steps

### Step 1: Pull the Latest Code
```bash
cd ~/cmp/cmp-app
git pull origin main
```

### Step 2: Update Environment Variables
```bash
nano .env
```

**Verify these settings:**
```env
DATABASE_URL="postgresql://user:password@localhost:5432/cmpdb"
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="https://your-actual-access-url"  # ⚠️ Must match browser URL
AUTH_PROVIDER="credentials"
STORAGE_PROVIDER="local"
```

### Step 3: Rebuild the Application
```bash
npm run build
```

**Expected output:**
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
✓ Finalizing page optimization
```

### Step 4: Restart the Application
```bash
pm2 restart cmp-app
```

**Verify it's running:**
```bash
pm2 status
pm2 logs cmp-app --lines 50
```

### Step 5: Test the Login
1. Open the app in a browser: `https://your-access-url`
2. Click on a login card (DIEL, DGL, DBVI, etc.)
3. Enter credentials and submit
4. **Expected:** Should redirect to the correct entity's dashboard
5. **Check browser console:** Should see no CSP violations

---

## Verification Checklist

- [ ] Code pulled from `main` branch
- [ ] `.env` file has correct `NEXTAUTH_URL` (matches browser URL)
- [ ] `npm run build` completed successfully
- [ ] `pm2 restart cmp-app` executed
- [ ] Application status shows "online" in `pm2 status`
- [ ] Login cards are clickable (no JavaScript errors in browser console)
- [ ] No CSP violation errors in browser console (check DevTools → Console)
- [ ] Can successfully log in and see the dashboard
- [ ] Session persists after page refresh

---

## Troubleshooting

### Issue: Login cards still don't respond to clicks
**Solution:**
1. Hard refresh the browser: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. Clear browser cache and cookies
3. Check browser console for CSP errors:
   ```
   Refused to execute inline script because it violates CSP directive...
   ```
4. If CSP errors persist, verify the build included the updated `next.config.mjs`

### Issue: Login succeeds but redirects to wrong page
**Solution:**
1. Verify `NEXTAUTH_URL` matches the browser URL exactly
2. Check NextAuth logs: `pm2 logs cmp-app | grep -i nextauth`
3. Ensure no trailing slashes in `NEXTAUTH_URL`

### Issue: "CSRF token mismatch" error
**Solution:**
1. This is caused by `NEXTAUTH_URL` mismatch
2. Set `NEXTAUTH_URL` to the EXACT URL users type in the browser
3. Restart the app after changing `.env`
4. Clear browser cookies and try again

### Issue: Build fails
**Solution:**
1. Check for syntax errors: `npm run build 2>&1 | tee build.log`
2. Verify Node version: `node --version` (should be 18.x or higher)
3. Clear Next.js cache: `rm -rf .next`
4. Try building again

---

## Testing Locally Before Deploying

**To test the production CSP locally:**

1. Create a production build:
   ```bash
   NODE_ENV=production npm run build
   ```

2. Start in production mode:
   ```bash
   NODE_ENV=production npm start
   ```

3. Test login functionality with production CSP settings

---

## Changes Made in This Fix

**Commit:** Fix production login by updating CSP to allow Next.js inline scripts

**Files Changed:**
- `next.config.mjs` - Updated production CSP to include `'unsafe-inline'` for scripts
- `DEPLOYMENT_FIX.md` - This deployment guide

**CSP Changes:**
```diff
- "script-src 'self'",
+ "script-src 'self' 'unsafe-inline'",
- "font-src 'self' fonts.gstatic.com",
+ "font-src 'self' fonts.gstatic.com data:",
- "img-src 'self' data:",
+ "img-src 'self' data: blob:",
```

---

## Security Considerations

### Current Implementation
- Uses `'unsafe-inline'` for scripts in production
- Still maintains other CSP protections (XSS, frame ancestors, etc.)
- Acceptable risk for internal compliance management platform

### Future Improvements (Optional)
To remove `'unsafe-inline'` and improve security:

1. **Implement CSP nonces:**
   ```javascript
   // In middleware.ts or next.config.mjs
   const nonce = crypto.randomBytes(16).toString('base64');
   headers.set('Content-Security-Policy', `script-src 'self' 'nonce-${nonce}'`);
   ```

2. **Configure Next.js to use nonces:**
   - Add nonce to inline scripts
   - Pass nonce to client components
   - Update CSP headers dynamically per request

3. **Use external scripts only:**
   - Extract all inline scripts to separate files
   - Load them with `<script src="...">` tags
   - Requires significant refactoring

**Recommendation:** Current fix (`'unsafe-inline'`) is sufficient for now. Consider nonce-based CSP in future security hardening phase.

---

## Contact

If issues persist after following this guide:
1. Check PM2 logs: `pm2 logs cmp-app --lines 100`
2. Check Next.js logs: `cat ~/cmp/cmp-app/.next/trace` (if exists)
3. Review browser DevTools → Network tab for failed requests
4. Review browser DevTools → Console tab for JavaScript errors
