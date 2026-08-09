<script lang="ts">
	import type {
		PageProps
	} from './$types';

	let {
		data
	}: PageProps = $props();
</script>

<svelte:head>
	<title>管理後台 | Quiz</title>
</svelte:head>

<div
	class="mx-auto w-full max-w-6xl p-4 md:p-6"
>
	<header
		class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
	>
		<div>
			<p
				class="text-sm font-medium uppercase tracking-wide opacity-60"
			>
				Admin
			</p>

			<h1 class="mt-1 text-3xl font-bold">
				管理後台
			</h1>

			<p class="mt-2 opacity-60">
				管理題庫與題目內容。
			</p>
		</div>

		<a
			href="/admin/banks/new"
			class="btn preset-filled-primary-500"
		>
			新增題庫
		</a>
	</header>

	<section
		class="grid gap-4 sm:grid-cols-2"
		aria-label="系統統計"
	>
		<article
			class="card preset-outlined p-5"
		>
			<p class="text-sm opacity-60">
				題庫數量
			</p>

			<p class="mt-2 text-3xl font-bold">
				{data.stats.bankCount}
			</p>
		</article>

		<article
			class="card preset-outlined p-5"
		>
			<p class="text-sm opacity-60">
				題目總數
			</p>

			<p class="mt-2 text-3xl font-bold">
				{data.stats.questionCount}
			</p>
		</article>
	</section>

	<section
		class="card preset-outlined mt-6 p-6"
	>
		<div
			class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
		>
			<div>
				<h2 class="text-xl font-semibold">
					題庫管理
				</h2>

				<p class="mt-2 opacity-60">
					建立、編輯與刪除題庫；下一階段會從這裡進入題目管理。
				</p>
			</div>

			<a
				href="/admin/banks"
				class="btn preset-tonal-primary"
			>
				管理題庫
			</a>
		</div>
	</section>
</div>
