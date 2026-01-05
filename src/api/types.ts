/**
 * Bluesky API types
 */

// Session types
export interface BskySession {
  accessJwt: string;
  refreshJwt?: string;
  did: string;
  handle: string;
  pdsUrl: string;
}

export interface BskyAccount {
  did: string;
  handle?: string;
  accessJwt?: string;
  refreshJwt?: string;
  service?: string;
  pdsUrl?: string;
}

export interface BskyStorageStructure {
  session?: {
    currentAccount?: BskyAccount;
    accounts?: BskyAccount[];
  };
  currentAccount?: BskyAccount;
  accounts?: BskyAccount[];
  accessJwt?: string;
  did?: string;
  handle?: string;
  service?: string;
  pdsUrl?: string;
}

// API Response types
export interface ProfileView {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  description?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  indexedAt?: string;
  viewer?: {
    muted?: boolean;
    blockedBy?: boolean;
    blocking?: string;
    following?: string;
    followedBy?: string;
  };
}

export interface PostView {
  uri: string;
  cid: string;
  author: ProfileView;
  record: {
    $type: string;
    text?: string;
    createdAt: string;
    reply?: {
      parent: { uri: string; cid: string };
      root: { uri: string; cid: string };
    };
    embed?: {
      $type: string;
      record?: { uri: string; cid: string };
    };
  };
  embed?: {
    $type: string;
    record?: {
      uri: string;
      cid: string;
      author: ProfileView;
      value: { text?: string; createdAt: string };
    };
  };
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
  quoteCount?: number;
  indexedAt: string;
  viewer?: {
    like?: string;
    repost?: string;
  };
}

export interface FeedViewPost {
  post: PostView;
  reply?: {
    root: PostView;
    parent: PostView;
  };
  reason?: {
    $type: string;
    by: ProfileView;
    indexedAt: string;
  };
}

// API Response wrappers
export interface GetFollowsResponse {
  subject: ProfileView;
  follows: ProfileView[];
  cursor?: string;
}

export interface GetFollowersResponse {
  subject: ProfileView;
  followers: ProfileView[];
  cursor?: string;
}

export interface GetTimelineResponse {
  feed: FeedViewPost[];
  cursor?: string;
}

export interface GetAuthorFeedResponse {
  feed: FeedViewPost[];
  cursor?: string;
}

export interface GetLikesResponse {
  uri: string;
  likes: Array<{
    actor: ProfileView;
    createdAt: string;
    indexedAt: string;
  }>;
  cursor?: string;
}

export interface GetRepostedByResponse {
  uri: string;
  repostedBy: ProfileView[];
  cursor?: string;
}

export interface GetQuotesResponse {
  uri: string;
  posts: PostView[];
  cursor?: string;
}

export interface GetPostThreadResponse {
  thread: ThreadViewPost;
}

export interface ThreadViewPost {
  $type: 'app.bsky.feed.defs#threadViewPost';
  post: PostView;
  parent?: ThreadViewPost | { $type: 'app.bsky.feed.defs#notFoundPost' };
  replies?: Array<ThreadViewPost | { $type: 'app.bsky.feed.defs#notFoundPost' }>;
}

// Error types
export interface BskyApiError {
  error: string;
  message: string;
}
