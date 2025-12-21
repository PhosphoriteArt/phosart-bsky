import type { Post } from "./posts.ts";

export interface ICache {
	getCachedPosts(limit?: number): Promise<Post[]>;
	postsLastCachedAt(): Promise<Date>;
	cachePosts(posts: Post[]): Promise<void>;
}