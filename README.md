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

Import the repository in Vercel and deploy. No environment variables, database or extra configuration are needed.

## How it works

- **Your data stays on your device.** Everything is saved in the browser's local storage. Settings has a backup download and restore, which is also how you move to another device. Install the app to your home screen so the phone does not clear the data after a period of not visiting.
- **The character** is drawn in code (`src/lib/sprite.ts`), not from image files, so every combination of six body stages and six outfits exists. The rules that decide his look are in `src/lib/game.ts`:
  - Body: gym and sport sessions earn training XP. Stages unlock at 600, 2.000, 4.500, 8.000 and 13.000 XP. Fourteen days without training costs a stage until you train again.
  - Money: cash plus savings, measured against the "Rich means" amount in settings. Outfits unlock at 2%, 10%, 25%, 50% and 100% of it. The stack in his hands grows continuously.
  - Energy: your average sleep over the last seven days decides whether he looks rested or tired.
  - Level: total XP from all trackers.
- **Groceries:** items you still need are on top, items you have are below. Untick an item and it moves to the top.
- **Wishlist:** `src/app/api/preview/route.ts` fetches the pasted page on the server and reads its title, picture and price. Some shops block automated requests; in that case you type the price once.
- **Trips:** `npm run build:map` regenerates the dot map (`src/data/world-dots.json`) from Natural Earth country shapes. The generated file is committed.
