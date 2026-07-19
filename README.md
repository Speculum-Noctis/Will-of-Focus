# The Will of Focus — Phase 1

Core loop: log study hours → earn EXP → level up → see your rank.

## What's in here
- `app/page.js` — login/signup screen + main dashboard
- `app/layout.js`, `app/globals.css` — page shell and styling
- `lib/levelSystem.js` — the EXP/level/rank math (7,500 EXP = level 600)
- `lib/supabaseClient.js` — connects the app to your Supabase project
- `supabase-schema.sql` — run this once in Supabase to create your database tables

## Setup steps

### 1. Run the database schema
1. Go to your Supabase project → **SQL Editor** → **New query**
2. Open `supabase-schema.sql` from this folder, copy all of it, paste it in
3. Tap **Run**. You should see "Success. No rows returned."

### 2. Push this code to GitHub
1. Create a new repository at github.com (name it `will-of-focus` or similar)
2. Upload every file in this folder **except** `node_modules` and `.env.local` (those won't be included in what you download from me anyway)

### 3. Deploy on Vercel
1. Go to Vercel → **Add New Project** → import your `will-of-focus` repo
2. Before deploying, open **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` → your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_KEY` → your Supabase publishable (or anon) key
3. Tap **Deploy**

### 4. Turn off email confirmation (for now, so signup is instant)
Supabase requires email confirmation by default. For quick testing with friends:
1. Supabase dashboard → **Authentication** → **Providers** → **Email**
2. Turn off **Confirm email**
(You can turn this back on later if you want it.)

## What works right now
- Sign up / log in
- Log study hours
- See live level, EXP bar, and current rank
- See your last 10 study sessions

## What's next (Phase 2)
Party system, weekly/monthly/yearly boss fights, streaks, challenge sessions.
