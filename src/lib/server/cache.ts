import { Db, MongoClient } from 'mongodb';
import type { Post } from '../util/posts.ts';
import type { ICache } from '../util/cache.ts';



export interface MongoDbCacheConfig {
	type: 'mongodb';
	uri: string;
	dbname?: string;
}

function setupCollections(db: Db) {
	return {
		cache: db.collection<Post & { _id: string; version: number }>('cache'),
		_info: db.collection<{
			_id: '_info';
			last_checked_at: Date;
			cache_version: number;
		}>('_info')
	};
}

type Collections = ReturnType<typeof setupCollections>

export class MongoCache implements ICache {
	#collections: Collections;

	constructor(private config: MongoDbCacheConfig) {
		const client = new MongoClient(config.uri);

		const db = client.db(config.dbname ?? 'phosart-bsky-cache');

		this.#collections = setupCollections(db);

	}

	async cachePosts(posts: Post[]): Promise<void> {
		const settings = await this.#collections._info.findOneAndUpdate(
			{ _id: '_info' },
			{ $set: { last_checked_at: new Date(), cache_version: CACHE_VERSION } },
			{ upsert: true, returnDocument: 'before' }
		);
		if (settings?.cache_version != CACHE_VERSION) {
			await this.#collections.cache.deleteMany({ version: { $ne: CACHE_VERSION } });
		}
		if (posts.length > 0) {
			await this.#collections.cache.insertMany(
				posts.map((post) => ({ ...post, _id: post.uri, version: CACHE_VERSION }))
			);
		}
	}

	async getCachedPosts(limit?: number): Promise<Post[]> {
		return await this.#collections.cache
			.find({ version: CACHE_VERSION }, { sort: { date: -1 }, limit })
			.toArray();
	}

	async postsLastCachedAt(): Promise<Date> {
		return (await this.#collections._info.findOne({ _id: '_info' }))?.last_checked_at ?? new Date(0);
	}
}

export const CACHE_VERSION = 3;
