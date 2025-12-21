import { MongoCache, type MongoDbCacheConfig } from './cache.ts';
import { PostsClient } from '../util/posts.ts';
import { json, type RequestHandler } from '@sveltejs/kit';
import type { ICache } from '../util/cache.ts';

type Backend = MongoDbCacheConfig;

export interface CacheOptions {
	backend: Backend;
	refreshPeriodMs?: number;
}

export interface CacheControlOptions {
	maxAge?: number;
	staleWhileRevalidate?: number;
	staleIfError?: number;
}

export interface Configuration {
	maxPosts?: number;
	cache?: CacheOptions;
	bskyUser: string;
	bskyDid: string;
	bskyPassword: string;
	cacheControl?: CacheControlOptions;
}

function makeCache(opts: CacheOptions | undefined): ICache | null {
	if (!opts) {
		return null;
	}

	switch (opts.backend.type) {
		case 'mongodb':
			return new MongoCache(opts.backend);
	}
}

export function configure(config: Configuration): RequestHandler {
	const client = new PostsClient({
		bskyPassword: config.bskyPassword,
		bskyDid: config.bskyDid,
		bskyUsername: config.bskyUser,
		cache: {
			backend: makeCache(config.cache),
			maxAgeMs: config.cache?.refreshPeriodMs
		}
	});

	return async () => {
		return json(await client.getPosts(config.maxPosts ?? 9), {
			headers: {
				'Cache-Control': `public, max-age=${config.cacheControl?.maxAge ?? 600}, stale-while-revalidate=${config.cacheControl?.staleWhileRevalidate ?? 86400}, stale-if-error=${config.cacheControl?.staleIfError ?? 86400}`
			}
		});
	};
}
