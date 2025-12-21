// Reexport your entry components here

import { onMount } from 'svelte';
import { type Post } from './util/posts.ts';

async function fetchPosts(): Promise<Post[]> {
	const res = await fetch('/api/posts/recent');
	const json = await res.json();
	return json as Post[];
}

type PostTuple = [Post[], /* loading = */ boolean, /* refetch = */ () => void];

export function usePosts(): PostTuple {
	const posts: PostTuple = $state([
		[],
		true,
		() => {
			fetchPosts().then((res) => {
				posts[0] = res;
				posts[1] = false;
			});
		}
	]);

	onMount(() => {
		posts[2]();
	});

	return posts;
}
