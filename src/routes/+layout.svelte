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
	<div class="app-header-shell fixed inset-x-0 top-0 z-[60] h-16 overflow-visible">
		<AppHeader user={data.user ?? null} />
	</div>

	<main class="app-page-shell flex min-w-0 flex-1 flex-col pt-16">
		{@render children()}
	</main>
</div>

<AppToaster />
