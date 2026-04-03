# STEP1 — USMLE Flashcard App

A spaced-repetition flashcard app built for USMLE Step 1 prep with cloud sync, conversation import, and 24 medical subjects.

## Features

- **24 USMLE Categories** — Cardiology, Neurology, Pharmacology, Biochemistry, and 20 more
- **Spaced Repetition** — Hard (1h), Good (1d), Easy (1w) with exponential interval scaling
- **Cloud Sync** — Supabase integration for cross-device syncing
- **Conversation Import** — Import tagged flashcards from Claude study sessions (JSON)
- **Analytics** — Retention rate, weak topic analysis, mastery tracking, streaks
- **Mobile-First** — Optimized for phone use with fast card flipping

## Quick Start

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages

```bash
# 1. Create repo on github.com
# 2. Then:
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/usmle-step1-app.git
git push -u origin main
```

### Deploy with Vercel (recommended)
1. Push to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repo
4. It auto-detects Vite — click Deploy
5. Live in ~30 seconds

### Deploy with Netlify
1. Push to GitHub
2. Go to [netlify.com](https://app.netlify.com)
3. "Add new site" → Import from Git → Select repo
4. Build command: `npm run build`
5. Publish directory: `dist`

### Deploy with GitHub Pages
```bash
npm install gh-pages --save-dev
```
Add to package.json scripts:
```json
"deploy": "vite build && gh-pages -d dist"
```
Then: `npm run deploy`

## Cloud Sync Setup (Supabase)

1. Create free account at [supabase.com](https://supabase.com)
2. New Project → run this SQL:

```sql
create table flashcard_state (
  user_id text primary key,
  data jsonb default '{}',
  updated_at timestamptz default now()
);

alter table flashcard_state enable row level security;

create policy "Allow all" on flashcard_state
  for all using (true) with check (true);
```

3. Settings → API → copy Project URL & anon key
4. In app → Cloud button → paste credentials → Connect

## Importing Flashcards from Claude

At the end of any study session, ask Claude to "generate flashcards" and it will produce a `.json` file like:

```json
{
  "source": "Claude Conversation",
  "topic": "Renal Physiology",
  "cards": [
    {
      "front": "How do you calculate FeNa?",
      "back": "FeNa = (UNa × PCr)/(PNa × UCr) × 100...",
      "category": "nephrology",
      "tags": ["AKI", "formulas", "high-yield"],
      "difficulty": "hard"
    }
  ]
}
```

Tap Import → select file → cards auto-tagged and sorted into subjects.

## Tech Stack

- React 18 + Vite
- Supabase (Postgres) for cloud sync
- localStorage for offline persistence
- Pure CSS (no dependencies)

## License

MIT
