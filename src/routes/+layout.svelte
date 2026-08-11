<script lang="ts">
	import './layout.css';

	import type {
		LayoutProps
	} from './$types';

	import AppHeader
		from '$lib/components/global/AppHeader.svelte';
	import AppToaster
		from '$lib/components/global/AppToaster.svelte';

	let {
		data,
		children
	}: LayoutProps = $props();
</script>

<div class="flex min-h-dvh flex-col">
	<AppHeader user={data.user ?? null} />

	<main class="flex flex-1 flex-col">
		{@render children()}
	</main>
</div>

<AppToaster />
