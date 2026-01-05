import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  openDatabase,
  closeDatabase,
  deleteDatabase,
  getByKey,
  put,
  putBatch,
  deleteByKey,
  getAll,
  getByIndex,
  count,
  clearStore,
  STORE_NAMES,
  type StoredProfile,
} from '../../db/index.js';

describe('Database', () => {
  beforeEach(async () => {
    await deleteDatabase();
  });

  afterEach(async () => {
    closeDatabase();
  });

  describe('openDatabase', () => {
    it('should open the database successfully', async () => {
      const db = await openDatabase();
      expect(db).toBeDefined();
      expect(db.name).toBe('bluesky-universe-db');
    });

    it('should return the same instance on multiple calls', async () => {
      const db1 = await openDatabase();
      const db2 = await openDatabase();
      expect(db1).toBe(db2);
    });

    it('should create all object stores', async () => {
      const db = await openDatabase();
      const storeNames = Array.from(db.objectStoreNames);

      expect(storeNames).toContain(STORE_NAMES.PROFILES);
      expect(storeNames).toContain(STORE_NAMES.POSTS);
      expect(storeNames).toContain(STORE_NAMES.INTERACTIONS);
      expect(storeNames).toContain(STORE_NAMES.ENGAGEMENTS);
      expect(storeNames).toContain(STORE_NAMES.SYNC_STATE);
      expect(storeNames).toContain(STORE_NAMES.CACHED_ANALYTICS);
    });
  });

  describe('CRUD operations', () => {
    const testProfile: StoredProfile = {
      did: 'did:plc:test123',
      handle: 'test.bsky.social',
      displayName: 'Test User',
      followsYou: true,
      youFollow: true,
      isMutual: true,
      lastUpdated: Date.now(),
    };

    it('should put and get an item', async () => {
      await openDatabase();
      await put(STORE_NAMES.PROFILES, testProfile);

      const retrieved = await getByKey<StoredProfile>(STORE_NAMES.PROFILES, testProfile.did);
      expect(retrieved).toEqual(testProfile);
    });

    it('should return undefined for non-existent key', async () => {
      await openDatabase();
      const retrieved = await getByKey<StoredProfile>(STORE_NAMES.PROFILES, 'non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should update an existing item', async () => {
      await openDatabase();
      await put(STORE_NAMES.PROFILES, testProfile);

      const updated = { ...testProfile, displayName: 'Updated Name' };
      await put(STORE_NAMES.PROFILES, updated);

      const retrieved = await getByKey<StoredProfile>(STORE_NAMES.PROFILES, testProfile.did);
      expect(retrieved?.displayName).toBe('Updated Name');
    });

    it('should delete an item', async () => {
      await openDatabase();
      await put(STORE_NAMES.PROFILES, testProfile);
      await deleteByKey(STORE_NAMES.PROFILES, testProfile.did);

      const retrieved = await getByKey<StoredProfile>(STORE_NAMES.PROFILES, testProfile.did);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('putBatch', () => {
    it('should insert multiple items', async () => {
      await openDatabase();

      const profiles: StoredProfile[] = [
        {
          did: 'did:plc:user1',
          handle: 'user1.bsky.social',
          followsYou: false,
          youFollow: true,
          isMutual: false,
          lastUpdated: Date.now(),
        },
        {
          did: 'did:plc:user2',
          handle: 'user2.bsky.social',
          followsYou: true,
          youFollow: true,
          isMutual: true,
          lastUpdated: Date.now(),
        },
        {
          did: 'did:plc:user3',
          handle: 'user3.bsky.social',
          followsYou: true,
          youFollow: false,
          isMutual: false,
          lastUpdated: Date.now(),
        },
      ];

      await putBatch(STORE_NAMES.PROFILES, profiles);

      const allProfiles = await getAll<StoredProfile>(STORE_NAMES.PROFILES);
      expect(allProfiles).toHaveLength(3);
    });

    it('should handle empty array', async () => {
      await openDatabase();
      await putBatch(STORE_NAMES.PROFILES, []);
      const allProfiles = await getAll<StoredProfile>(STORE_NAMES.PROFILES);
      expect(allProfiles).toHaveLength(0);
    });
  });

  describe('getAll', () => {
    it('should return all items in a store', async () => {
      await openDatabase();

      const profiles: StoredProfile[] = [
        {
          did: 'did:plc:a',
          handle: 'a.bsky.social',
          followsYou: false,
          youFollow: true,
          isMutual: false,
          lastUpdated: Date.now(),
        },
        {
          did: 'did:plc:b',
          handle: 'b.bsky.social',
          followsYou: false,
          youFollow: true,
          isMutual: false,
          lastUpdated: Date.now(),
        },
      ];

      await putBatch(STORE_NAMES.PROFILES, profiles);
      const allProfiles = await getAll<StoredProfile>(STORE_NAMES.PROFILES);

      expect(allProfiles).toHaveLength(2);
      expect(allProfiles.map((p) => p.did).sort()).toEqual(['did:plc:a', 'did:plc:b']);
    });

    it('should return empty array for empty store', async () => {
      await openDatabase();
      const allProfiles = await getAll<StoredProfile>(STORE_NAMES.PROFILES);
      expect(allProfiles).toEqual([]);
    });
  });

  describe('getByIndex', () => {
    it('should return items matching index value (string index)', async () => {
      await openDatabase();

      const profiles: StoredProfile[] = [
        {
          did: 'did:plc:user1',
          handle: 'user1.bsky.social',
          followsYou: true,
          youFollow: true,
          isMutual: true,
          lastUpdated: Date.now(),
        },
        {
          did: 'did:plc:user2',
          handle: 'user2.bsky.social',
          followsYou: false,
          youFollow: true,
          isMutual: false,
          lastUpdated: Date.now(),
        },
      ];

      await putBatch(STORE_NAMES.PROFILES, profiles);

      // Test string index (by-handle)
      const byHandle = await getByIndex<StoredProfile>(
        STORE_NAMES.PROFILES,
        'by-handle',
        'user1.bsky.social'
      );
      expect(byHandle).toHaveLength(1);
      expect(byHandle[0].did).toBe('did:plc:user1');
    });
  });

  describe('count', () => {
    it('should return correct count', async () => {
      await openDatabase();

      expect(await count(STORE_NAMES.PROFILES)).toBe(0);

      await put(STORE_NAMES.PROFILES, {
        did: 'did:plc:test',
        handle: 'test.bsky.social',
        followsYou: false,
        youFollow: true,
        isMutual: false,
        lastUpdated: Date.now(),
      });

      expect(await count(STORE_NAMES.PROFILES)).toBe(1);
    });
  });

  describe('clearStore', () => {
    it('should remove all items from store', async () => {
      await openDatabase();

      await putBatch(STORE_NAMES.PROFILES, [
        {
          did: 'did:plc:1',
          handle: '1.bsky.social',
          followsYou: false,
          youFollow: true,
          isMutual: false,
          lastUpdated: Date.now(),
        },
        {
          did: 'did:plc:2',
          handle: '2.bsky.social',
          followsYou: false,
          youFollow: true,
          isMutual: false,
          lastUpdated: Date.now(),
        },
      ]);

      expect(await count(STORE_NAMES.PROFILES)).toBe(2);

      await clearStore(STORE_NAMES.PROFILES);

      expect(await count(STORE_NAMES.PROFILES)).toBe(0);
    });
  });

  describe('deleteDatabase', () => {
    it('should delete the entire database', async () => {
      await openDatabase();
      await put(STORE_NAMES.PROFILES, {
        did: 'did:plc:test',
        handle: 'test.bsky.social',
        followsYou: false,
        youFollow: true,
        isMutual: false,
        lastUpdated: Date.now(),
      });

      await deleteDatabase();

      // Re-open and verify it's empty
      await openDatabase();
      const allProfiles = await getAll<StoredProfile>(STORE_NAMES.PROFILES);
      expect(allProfiles).toHaveLength(0);
    });
  });
});
