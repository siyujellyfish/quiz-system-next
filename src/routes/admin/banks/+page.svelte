<script lang="ts">
	import type {
		PageProps
	} from './$types';

	let {
		data
	}: PageProps = $props();
</script>

<svelte:head>
	<title>題庫管理 | Quiz</title>
</svelte:head>

<div
	class="mx-auto w-full max-w-6xl p-4 md:p-6"
>
	<nav
		class="mb-4 text-sm opacity-60"
		aria-label="麵包屑"
	>
		<a href="/admin">管理後台</a>
		<span class="mx-2">/</span>
		<span>題庫管理</span>
	</nav>

	<header
		class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
	>
		<div>
			<h1 class="text-3xl font-bold">
				題庫管理
			</h1>

			<p class="mt-2 opacity-60">
				共 {data.banks.length} 個題庫。
			</p>
		</div>

		<div class="flex flex-wrap gap-2">
			<a
				href="/admin/banks/import"
				class="btn preset-tonal-primary"
			>
				匯入 JSON
			</a>

			<a
				href="/admin/banks/new"
				class="btn preset-filled-primary-500"
			>
				新增題庫
			</a>
		</div>
	</header>

	{#if data.banks.length === 0}
		<section
			class="card preset-outlined p-8 text-center"
		>
			<h2 class="text-xl font-semibold">
				尚未建立題庫
			</h2>

			<p class="mt-2 opacity-60">
				可以建立空題庫，或直接匯入既有 JSON 題庫。
			</p>

			<div
				class="mt-5 flex flex-wrap justify-center gap-2"
			>
				<a
					href="/admin/banks/import"
					class="btn preset-tonal-primary"
				>
					匯入 JSON
				</a>

				<a
					href="/admin/banks/new"
					class="btn preset-filled-primary-500"
				>
					建立題庫
				</a>
			</div>
		</section>
	{:else}
		<div class="grid gap-4">
			{#each data.banks as bank}
				<article
					class="card preset-outlined p-5"
				>
					<div
						class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
					>
						<div class="min-w-0">
							<div
								class="flex flex-wrap items-center gap-2"
							>
								<h2
									class="truncate text-xl font-semibold"
								>
									{bank.name}
								</h2>

								<span
									class="badge preset-tonal"
								>
									{bank.questionCount} 題
								</span>
							</div>

							<p
								class="mt-1 text-sm font-mono opacity-60"
							>
								{bank.slug}
							</p>

							{#if bank.description}
								<p
									class="mt-3 max-w-3xl text-sm opacity-70"
								>
									{bank.description}
								</p>
							{/if}
						</div>

						<div class="flex shrink-0 flex-wrap gap-2">
							<a
								href={`/admin/banks/${bank.id}/questions`}
								class="btn preset-filled-primary-500"
							>
								管理題目
							</a>

							<a
								href={`/admin/banks/${bank.id}/export`}
								class="btn preset-tonal"
							>
								匯出 JSON
							</a>

							<a
								href={`/admin/banks/${bank.id}`}
								class="btn preset-tonal-primary"
							>
								編輯題庫
							</a>
						</div>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</div>
