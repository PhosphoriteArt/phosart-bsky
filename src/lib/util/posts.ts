import { AppBskyEmbedImages, AppBskyEmbedVideo, AppBskyFeedPost, AtpAgent } from '@atproto/api';
import type { ICache } from './cache.ts';
import type { FeedViewPost } from '@atproto/api/dist/client/types/app/bsky/feed/defs.js';

export interface PostsConfiguration {
	bskyPassword: string;
	bskyUsername: string;
	bskyDid: string;
	cache?: {
		backend: ICache | null;
		maxAgeMs?: number;
	};
}

const DEFAULT_AGE_MS = 1000 * 60 * 10; // 10 minutes
const DEFAULT_MAX_POSTS_FROM_BSKY = 50;

export class PostsClient {
	#agent: AtpAgent;
	#backend: ICache | null;
	#maxAgeMs: number;
	#did: string;
	#didLogIn: boolean = false;
	#config: PostsConfiguration;

	constructor(config: PostsConfiguration) {
		this.#agent = new AtpAgent({
			service: 'https://bsky.social'
		});
		this.#config = config;

		this.#backend = config.cache?.backend ?? null;
		this.#maxAgeMs = config.cache?.maxAgeMs ?? DEFAULT_AGE_MS;
		this.#did = config.bskyDid;
	}

	async getPosts(limit: number = DEFAULT_MAX_POSTS_FROM_BSKY) {
		if (!this.#didLogIn) {
			await this.#agent.login({
				identifier: this.#config.bskyUsername,
				password: this.#config.bskyPassword
			});
		}
		let cached: Post[] = [];
		if (this.#backend) {
			cached = await this.#backend.getCachedPosts(limit);
			const lastCachedAt = await this.#backend.postsLastCachedAt();

			// Only update once every 10 minutes
			if (Date.now() - lastCachedAt.getTime() < this.#maxAgeMs) {
				return cached;
			}
		}

		const out: Post[] = [];

		const mostRecent = cached[0] ?? null;

		let cursor: string | undefined = undefined;
		do {
			const resp = await this.#agent.getAuthorFeed({
				actor: this.#did,
				filter: 'posts_no_replies',
				limit: 50,
				cursor: cursor
			});
			cursor = resp.data.cursor ?? undefined;
			console.log(resp.data.feed[0]);
			const next = this.#transformFeed(resp.data.feed);
			const toAdd = next.filter((nx) => !mostRecent || nx.date.localeCompare(mostRecent.date) > 0);
			out.splice(0, 0, ...toAdd);
			if (next.length !== toAdd.length) {
				break;
			}
		} while (cursor);

		if (this.#backend) {
			await this.#backend.cachePosts(out);
		}
		return [...out, ...cached].sort((p1, p2) => p2.date.localeCompare(p1.date)).slice(0, limit);
	}

	#transformFeed(fvps: FeedViewPost[]): Post[] {
		return fvps
			.filter(
				(fvp) =>
					fvp.post.author.did === this.#did &&
					fvp.reason?.$type !== 'app.bsky.feed.defs#reasonRepost' &&
					!fvp.reply &&
					(fvp.post.embed?.$type?.startsWith('app.bsky.embed.images#view') ||
						fvp.post.embed?.$type.startsWith('app.bsky.embed.video#view'))
			)
			.map(
				(fvp) =>
					({
						uri: fvp.post.uri,
						date: fvp.post.indexedAt,
						text: (fvp.post.record as AppBskyFeedPost.Record).text,
						likes: fvp.post.likeCount || 0,
						reposts: fvp.post.repostCount || 0,
						image_details:
							(fvp.post.embed as AppBskyEmbedImages.View)?.images?.map((img) => ({
								full_url: img.fullsize,
								alt_text: img.alt,
								thumb_url: img.thumb
							})) ?? [],
						video_thumb_url: (fvp.post.embed as AppBskyEmbedVideo.View)?.thumbnail ?? null
					}) satisfies Post
			);
	}
}

export interface ImageDetails {
	alt_text: string;
	thumb_url: string;
	full_url: string;
}

export interface Post {
	uri: string;
	date: string;
	text: string;
	likes: number;
	reposts: number;
	image_details: ImageDetails[];
	video_thumb_url: string | null;
}
