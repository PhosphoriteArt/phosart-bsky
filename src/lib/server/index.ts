import { MongoCache, type MongoDbCacheConfig } from './cache.ts';
import { PostsClient, type Post } from '../util/posts.ts';
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

function makeClient(config: Configuration): PostsClient {
	return new PostsClient({
		bskyPassword: config.bskyPassword,
		bskyDid: config.bskyDid,
		bskyUsername: config.bskyUser,
		cache: {
			backend: makeCache(config.cache),
			maxAgeMs: config.cache?.refreshPeriodMs
		}
	});
}

export class PostHandler {
	#client: PostsClient;
	#config: Configuration;

	constructor(config: Configuration) {
		this.#config = config;
		this.#client = makeClient(config);
	}

	get handler(): RequestHandler {
		return this.#handler;
	}

	async getPosts(): Promise<Post[]> {
		return await this.#client.getPosts(this.#config.maxPosts ?? 9);
	}

	#handler: RequestHandler = async () => {
		return json(await this.getPosts(), {
			headers: {
				'Cache-Control': `public, max-age=${this.#config.cacheControl?.maxAge ?? 600}, stale-while-revalidate=${this.#config.cacheControl?.staleWhileRevalidate ?? 86400}, stale-if-error=${this.#config.cacheControl?.staleIfError ?? 86400}`
			}
		});
	};
}
