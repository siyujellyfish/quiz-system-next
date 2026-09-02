<script lang="ts">
	type Props = {
		explanation: string | null;
	};

	let {
		explanation
	}: Props = $props();
</script>

<section
	class="mt-6 rounded-container border border-surface-300-700 bg-surface-100-900 p-4 md:p-5"
	aria-label="題目解析"
>
	<div class="flex items-center gap-2">
		<span class="badge preset-tonal-primary">解析</span>
		<span class="text-xs opacity-60">靜態題解</span>
	</div>

	{#if explanation}
		<p class="mt-3 whitespace-pre-wrap leading-relaxed">
			{explanation}
		</p>
	{:else}
		<p class="mt-3 text-sm opacity-60">
			此題目前尚無解析。
		</p>
	{/if}
</section>
