# My Diary — Setup & Deployment Guide

Everything you need to get your diary live on the internet with persistent data.

---

## What you'll set up

1. **Supabase** — free database to store your entries and goals
2. **GitHub** — to hold your code
3. **Vercel** — to host and publish your app

Total time: ~20 minutes. No coding required beyond copy-pasting.

---

## Step 1: Set up Supabase (your database)

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click **"New Project"** — name it `my-diary`, set a password, choose a region close to you
3. Wait ~2 minutes for it to spin up
4. Once ready, go to **SQL Editor** in the left sidebar
5. Paste this SQL and click **Run**:

```sql
-- Create entries table
CREATE TABLE entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mood_emoji TEXT,
  mood_label TEXT,
  journal TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  reflection TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create goals table
CREATE TABLE goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  icon TEXT DEFAULT '🎯',
  progress INTEGER DEFAULT 0,
  milestones JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow public read/write (since this is a personal app)
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on entries" ON entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on goals" ON goals FOR ALL USING (true) WITH CHECK (true);
```

6. Go to **Settings → API** in the left sidebar
7. Copy your **Project URL** and **anon public key** — you'll need these in Step 3

---

## Step 2: Get your Anthropic API key (for AI reflections)

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Go to **API Keys** and create a new key
4. Copy the key — you'll need this in Step 3

> Note: The AI reflection feature uses the Claude API which has usage-based pricing.
> Each diary entry reflection costs roughly $0.01-0.02.

---

## Step 3: Push to GitHub

1. Go to [github.com](https://github.com) and sign up/log in
2. Click **"New Repository"** (the + icon top right)
3. Name it `my-diary`, set to **Private**, click **Create**
4. Upload all the files from the `my-diary` folder to this repo:
   - You can drag and drop files directly on the GitHub page
   - Or use GitHub Desktop (easier for non-coders)

The file structure should look like:

```
my-diary/
├── index.html
├── package.json
├── vite.config.js
├── .gitignore
├── .env.example
└── src/
    ├── main.jsx
    ├── App.jsx
    └── supabase.js
```

> ⚠️ Do NOT upload a `.env` file — your keys go in Vercel (next step).

---

## Step 4: Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign up with your GitHub account
2. Click **"Add New → Project"**
3. Select your `my-diary` repository
4. Before clicking Deploy, expand **"Environment Variables"** and add these three:

| Variable Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase Project URL from Step 1 |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key from Step 1 |
| `VITE_ANTHROPIC_API_KEY` | Your Anthropic API key from Step 2 |

5. Click **Deploy**
6. Wait ~1 minute — Vercel will give you a URL like `my-diary.vercel.app`

**That's it — your diary is live!**

---

## Using your diary

- Visit your Vercel URL from any device
- Write entries, set goals, get AI reflections
- Everything saves to Supabase automatically
- Your data persists across sessions, devices, and browsers

---

## Optional: Custom domain

If you want a nicer URL like `diary.yourdomain.com`:

1. In Vercel, go to your project → **Settings → Domains**
2. Add your custom domain
3. Follow Vercel's DNS instructions

---

## Security note

This setup uses Supabase's anon key with open policies, which means anyone with your URL
could technically read/write data. For a personal diary, you may want to add authentication.

To add a simple password gate later, you can:
- Add Supabase Auth (email/password login)
- Or add a simple PIN screen in the app

Let me know if you'd like help setting up authentication.

---

## Troubleshooting

**"Loading your diary..." never finishes**
→ Check your Supabase URL and anon key are correct in Vercel environment variables.
→ Make sure you ran the SQL in Step 1.

**AI reflections aren't working**
→ Check your Anthropic API key is correct and has credits.

**Changes not showing after update**
→ Vercel auto-deploys when you push to GitHub. Give it ~1 minute.
