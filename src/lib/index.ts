// Reexport your entry components here

import { onMount } from 'svelte';
import { type Post } from './util/posts.ts';

async function fetchPosts(): Promise<Post[]> {
	const res = await fetch('/api/posts/recent');
	const json = await res.json();
	return json as Post[];
}

export function usePosts(): [Post[], /* loading = */ boolean, /* refetch = */ () => void] {
	let postsLoading = $state(true);
	let posts: Post[] = $state([]);

	const refetch = () => {
		fetchPosts().then((res) => {
			posts = res;
			postsLoading = false;
		});
	};

	onMount(() => {
		refetch();
	});

	return [posts, postsLoading, refetch];
}
