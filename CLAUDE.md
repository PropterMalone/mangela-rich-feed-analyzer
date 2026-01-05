# MangeLa Rich Feed Analyzer

Analytics extension to understand your Bluesky "Universe" - who contributes to your feed and engagement patterns.

## What is "Universe"

1. All posts from people you follow
2. All reposts from people you follow
3. All replies from people you follow (to anyone)
4. All quote posts of YOUR posts
5. All replies to YOUR posts

## Development

```bash
npm install        # Install dependencies
npm run build      # Build extension to dist/
npm run watch      # Watch mode for development
npm run test       # Run tests
npm run lint       # Lint code
npm run format     # Format code
```

## Loading in Chrome

1. Run `npm run build`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist/` folder

## Architecture

- **IndexedDB** for data storage (profiles, posts, interactions, engagements)
- **Background service worker** for syncing and alarms
- **Content script** for tracking likes on bsky.app
- **Popup** for quick analytics view
- **Dashboard** for full analytics (opens in new tab)

## Key Files

- `src/db/` - IndexedDB schema and CRUD operations
- `src/api/` - Bluesky API client with rate limiting
- `src/background/` - Service worker for sync
- `src/popup/` - Quick popup UI
- `src/dashboard/` - Full analytics dashboard

## API Notes

- Rate limit: 3000 requests per 5 minutes (we use 2500 to be safe)
- Session extracted from Bluesky's localStorage
- No impression/serve data available from API
- Likes must be tracked locally via content script

## Status

Phase 1 (Foundation) complete:
- [x] Project scaffolding
- [x] IndexedDB schema
- [x] API client with session extraction
- [x] Rate limiter
- [x] Placeholder UI

## Next Steps (Phase 2: Data Collection)

1. Implement sync jobs in `src/background/`:
   - `sync-follows.ts` - Fetch follows/followers via `getAllFollows()` and `getAllFollowers()`
   - `sync-posts.ts` - Fetch posts from follows via `getAuthorFeed()`
   - `sync-engagements.ts` - Fetch likes/reposts/quotes on your posts
   - `sync-manager.ts` - Orchestrate sync jobs with alarms

2. Key API functions already implemented in `src/api/client.ts`:
   - `getAllFollows(actor)` - Get all accounts a user follows
   - `getAllFollowers(actor)` - Get all followers
   - `getAuthorFeed(actor)` - Get posts from a user
   - `getTimeline()` - Get authenticated user's home feed
   - `getLikes(uri)` / `getAllLikes(uri)` - Get who liked a post
   - `getQuotes(uri)` - Get quote posts
   - `getPostThread(uri)` - Get replies

3. Store synced data using `src/db/` functions:
   - `saveProfiles()` - Store follow/follower profiles
   - `savePosts()` - Store posts from universe
   - `recordLikeReceived()`, `recordReplyReceived()`, etc. - Store engagements

4. Track sync state with `src/db/sync-state.ts`:
   - `startSync(key)`, `completeSync(key, cursor)`, `failSync(key, error)`
   - Use cursor for incremental syncing

5. After sync, implement analytics in `src/analytics/`:
   - Noise score algorithm (high volume + low engagement = noise)
   - Reciprocity score (balance of give/take)
   - User contribution aggregation
