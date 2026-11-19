# Life

A gamified life tracker. You log gym, sport, sleep, work and money; a pixel character gets more muscular as you train and better dressed as your money grows, with a stack of cash in his hands that thickens with your balance. The same app holds a groceries list, a wishlist that turns pasted links into bookmarks with prices, and a dotted world map of the countries you have visited.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests for the game rules and parsers
npm run build    # production build
```

## Deploy

Import the repository in Vercel and deploy. Without further setup the app runs without accounts and keeps everything on the device.

## Accounts and sync (Supabase)

With two environment variables the app asks people to log in and keeps their data in a database, so it follows them across devices. Each person only ever sees their own data.

1. Create a Supabase project. In its SQL Editor, run `supabase/migrations/20261119000000_accounts_and_entries.sql`. It creates one `entries` table with row level security, plus the "delete my account" function.
2. In Vercel, Project settings, Environment Variables, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (see `.env.example`). Redeploy: these values are baked in at build time.
3. In Supabase, Authentication, URL Configuration: set Site URL to your Vercel address and add it to the redirect URLs, so password reset links come back to the app.
4. Decide on email confirmation (Authentication, Sign In / Providers, Email). Supabase's built-in email sender is heavily rate limited, so for a small group it is easier to switch "Confirm email" off, and to connect your own sender before opening it up widely.

How it works: the app always reads and writes a local copy first (fast, and it works offline). `src/lib/sync.ts` holds the rules for merging, `src/lib/cloud.ts` runs them in the background. Every logged item is one row; a change made on a device that has not been uploaded yet wins over the server's copy. Deleting an item uploads a tombstone so other devices remove it too.

Data on a device from before accounts existed is offered to the first person who logs in there. Logging out removes that person's copy from the device, unless some changes were never uploaded.

## How it works

- **Where the data lives.** Without accounts, in the browser's local storage on that device (install the app to your home screen so a phone does not clear it). With accounts, in your Supabase database, with a local copy on each device. Settings has a backup download and restore either way.
- **The character** is drawn in code (`src/lib/sprite.ts`), not from image files, so every combination of six body stages and six outfits exists. The rules that decide his look are in `src/lib/game.ts`:
  - Body: gym and sport sessions earn training XP. Stages unlock at 600, 2.000, 4.500, 8.000 and 13.000 XP. Fourteen days without training costs a stage until you train again.
  - Money: cash plus savings, measured against the "Rich means" amount in settings. Outfits unlock at 2%, 10%, 25%, 50% and 100% of it. The stack in his hands grows continuously.
  - Energy: your average sleep over the last seven days decides whether he looks rested or tired.
  - Level: total XP from all trackers.
- **Groceries:** items you still need are on top, items you have are below. Untick an item and it moves to the top.
- **Wishlist:** `src/app/api/preview/route.ts` fetches the pasted page on the server and reads its title, picture and price. Some shops block automated requests; in that case you type the price once.
- **Trips:** `npm run build:map` regenerates the dot map (`src/data/world-dots.json`) from Natural Earth country shapes. The generated file is committed.
