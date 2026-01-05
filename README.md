# MangeLa Rich Feed Analyzer

A Chrome extension that analyzes your Bluesky social media feed to understand who contributes to it and identify optimization opportunities.

## Features

### 📊 Feed Analysis
- **Contributors**: See who posts to your feed, sorted by volume
- **Noise Detection**: Identify accounts that post frequently but you rarely engage with
- **Engagement Tracking**: Understand the balance of engagement between you and other users
- **Relationship Insights**: Discover one-way relationships and mutual friends

### 🧮 Scoring System

#### Noise Score (0.0 - 1.0)
Identifies low-engagement accounts you might want to unfollow.
```
Noise = volumePercentile × (1 - engagementRate)
Boosted 20% for non-mutual accounts
```

- **0.0-0.3**: Low noise (healthy followers)
- **0.3-0.7**: Medium noise (occasional contributors)
- **0.7-1.0**: High noise (potential unfollows)

#### Reciprocity Score (0.0 - 1.0)
Measures balance of engagement between you and another user.
```
Reciprocity = theirEngagement / totalEngagement
0.0 = you engage, they don't
0.5 = balanced engagement
1.0+ = they engage more
```

### 🔄 Sync Strategy
- **Full Sync** (hourly by default): Refreshes all follows, followers, recent posts, and engagements
- **Incremental Sync** (every 15 min): Checks for new posts and engagement activity
- **Rate Limiting**: Conservative 2500 requests/5min to avoid API limits
- **Batch Processing**: Follows/posts synced in parallel batches for efficiency

## Installation

### From Source

1. Clone the repository:
   ```bash
   git clone https://github.com/PropterMalone/mangela-rich-feed-analyzer.git
   cd mangela-rich-feed-analyzer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `dist/` folder

## Development

### Running Tests
```bash
npm run test                 # Run all tests
npm run test -- --watch     # Watch mode
npm run test -- --coverage  # Coverage report (95%+ target)
```

### Building
```bash
npm run build     # Bundle and minify
npm run lint      # ESLint check
npm run format    # Prettier formatting
```

### Project Structure

```
src/
├── api/              # Bluesky API client + rate limiting
├── background/       # Service worker + sync jobs
├── db/              # IndexedDB schema and operations
├── analytics/       # Score computation and caching
├── popup/           # Quick-view popup UI
├── dashboard/       # Full analytics dashboard
├── options/         # Settings page
├── content/         # Content script for like tracking
└── __tests__/       # Unit tests (55 tests, 95%+ coverage)
```

## Database Schema

**IndexedDB** stores all data locally with 6 main stores:

### profiles
```typescript
{
  did: string
  handle: string
  displayName?: string
  avatar?: string
  youFollow: boolean
  followsYou: boolean
  isMutual: boolean
  lastUpdated: number
}
```

### posts
```typescript
{
  uri: string           // at:// URI
  cid: string
  authorDid: string
  authorHandle: string
  createdAt: string
  postType: 'post' | 'repost' | 'quote' | 'reply'
  metadata: {
    textPreview: string
    likeCount: number
    repostCount: number
    replyCount: number
    quoteCount: number
    indexedAt: string
  }
  repostedByDid?: string
  quotedUri?: string
}
```

### interactions
```typescript
{
  uri: string
  targetDid: string
  targetHandle: string
  interactionType: 'like' | 'reply' | 'quote'
  timestamp: number
}
```

### engagements
```typescript
{
  postUri: string
  actorDid: string
  actorHandle: string
  engagementType: 'like' | 'reply' | 'quote'
  timestamp: number
}
```

### syncState
Tracks sync progress with cursors for pagination

### cachedAnalytics
15-minute TTL cache of computed scores

## API Integration

Uses Bluesky AT Protocol (no authentication required for public data):

- `getProfile(actor)` - Profile information
- `getFollows(actor, limit, cursor)` - Following list
- `getFollowers(actor, limit, cursor)` - Followers list
- `getAuthorFeed(actor, limit, cursor)` - Posts from account
- `getLikes(uri)` - Likes on a post
- `getQuotes(uri)` - Quotes of a post
- `getPostThread(uri, depth, parentHeight)` - Reply threads

**Note**: Impression/serve data is not available via AT Protocol.

## UI Components

### Popup (360x480px)
- Quick statistics: Following, Followers, Mutuals, Posts
- Sync status and last sync time
- 3 tabs:
  - **Top Contributors**: Sorted by post count
  - **Noise**: Flagged accounts (>70% noise by default)
  - **Engagement**: Sorted by reciprocal engagement

### Dashboard
- Full analytics with pagination (20 users/page)
- Insights section with key statistics
- User table with columns: Handle | Type | Posts | Engagement % | Your Interactions | Noise % | Reciprocity %
- Unfollow candidates (high-noise, non-mutual accounts)
- CSV export for external analysis

### Options Page
- **Sync Settings**: Full sync interval (1-24 hours), incremental interval (5-60 min)
- **Data Retention**: Posts (7-90 days), engagements (30-365 days)
- **Analytics Thresholds**: Noise score (0-100%), reciprocity threshold (0-100%)
- **Notifications**: On sync/errors
- **Data Management**: Export as JSON, clear all data

## Test Coverage

**55 tests, 95%+ coverage** across:
- Rate limiter: 11 tests
- Database operations: 15 tests
- Profile queries: 14 tests
- Analytics computation: 10 tests
- Analytics caching: 5 tests

Run coverage report:
```bash
npm run test:coverage
```

## Performance

- **Efficient pagination**: 100 items/request from Bluesky API
- **Batch processing**: 10 concurrent requests for profiles/posts
- **Caching**: 15-minute TTL on computed scores
- **Cleanup job**: Deletes posts older than 30 days
- **Moderate rate limit**: 2500/5min to avoid throttling

### Extension Size
- `popup.js`: 9.6kb
- `dashboard.js`: 11.4kb
- `background.js`: 15.3kb
- `options.js`: 4.0kb
- Total: ~50kb bundled

## Known Limitations

1. **No Impression Data**: Bluesky API doesn't expose which posts were served to you
2. **No Current Likes API**: Content script required to track your likes (future enhancement)
3. **Pagination Limits**: Max 100 items per request from API
4. **30-Day Post Window**: Data older than 30 days is deleted to manage storage

## Future Enhancements

- [ ] Content script to track your likes in real-time
- [ ] Time-windowed analysis (7, 30, 90 day periods)
- [ ] "Feed Share" metric (% of feed per user)
- [ ] Engagement rate per user breakdown
- [ ] Auto-unfollow with confirmation for noise candidates
- [ ] Custom scoring algorithms
- [ ] Network analysis (follower graphs)

## Technologies

- **TypeScript** (strict mode)
- **Chrome MV3 Extensions** (service worker + content script)
- **IndexedDB** (offline-first storage)
- **Vitest** (unit testing)
- **esbuild** (bundling)
- **ESLint + Prettier** (code quality)

## Contributing

Pull requests welcome! Please:

1. Maintain test coverage (95%+)
2. Run `npm run format && npm run lint` before committing
3. Add tests for new features
4. Follow TypeScript strict mode

## License

MIT

## Author

Created with [Claude Code](https://claude.com/claude-code)

---

**Made with 🌌 for Bluesky Analytics**
