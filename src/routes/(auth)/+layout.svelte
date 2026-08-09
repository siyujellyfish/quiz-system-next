<script lang="ts">
	import Lightswitch from '$lib/components/global/LightSwitch.svelte';

	let { children } = $props();
</script>

<div class="relative flex min-h-dvh items-center justify-center p-4 md:p-6">
	<div class="absolute right-4 top-4 md:right-6 md:top-6">
		<Lightswitch />
	</div>

	<main class="w-full max-w-md">
		<header class="mb-8 text-center select-none">
			<a 
				href="/"
				class="inline-block no-underline"
			>
				<h1 class="h2">Quiz</h1>
			</a>

			<p class="mt-2 text-sm opacity-60">
				簡潔、快速的刷題系統
			</p>
		</header>

		{@render children()}
	</main>
</div>