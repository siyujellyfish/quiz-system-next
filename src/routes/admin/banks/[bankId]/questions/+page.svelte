<script lang="ts">
	import {
		onMount
	} from 'svelte';

	import type {
		PageProps
	} from './$types';

	import { toaster } from '$lib/ui/toaster';

	let {
		data
	}: PageProps = $props();

	onMount(() => {
		if (!data.updated && !data.imported) {
			return;
		}

		if (data.imported) {
			toaster.success({
				title: '題庫已匯入',
				description:
					`共新增 ${data.importedCount} 道題目。`
			});
		} else if (data.updated) {
			toaster.success({
				title: '題目已更新',
				description:
					data.practiceProgressReset
						? '因選項數量改變，此題庫進行中的 Practice 已重置。'
						: '題目內容已成功儲存。'
			});
		}

		const url = new URL(window.location.href);
		url.searchParams.delete('updated');
		url.searchParams.delete('practiceProgressReset');
		url.searchParams.delete('imported');
		url.searchParams.delete('importedCount');

		window.history.replaceState(
			window.history.state,
			'',
			`${url.pathname}${url.search}${url.hash}`
		);
	});
</script>

<svelte:head>
	<title>{data.bank.name} | 題目管理 | Quiz</title>
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
		<a href="/admin/banks">題庫管理</a>
		<span class="mx-2">/</span>
		<a href={`/admin/banks/${data.bank.id}`}>
			{data.bank.name}
		</a>
		<span class="mx-2">/</span>
		<span>題目管理</span>
	</nav>

	<header
		class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
	>
		<div>
			<h1 class="text-3xl font-bold">
				題目管理
			</h1>

			<p class="mt-2 opacity-60">
				{data.bank.name} · 共 {data.questions.length} 題
			</p>
		</div>

		<a
			href={`/admin/banks/${data.bank.id}/questions/new`}
			class="btn preset-filled-primary-500"
		>
			新增題目
		</a>
	</header>

	{#if data.questions.length === 0}
		<section
			class="card preset-outlined p-8 text-center"
		>
			<h2 class="text-xl font-semibold">
				尚未建立題目
			</h2>

			<p class="mt-2 opacity-60">
				新增第一道題目後即可在 Practice 與 Exam 使用。
			</p>

			<a
				href={`/admin/banks/${data.bank.id}/questions/new`}
				class="btn preset-filled-primary-500 mt-5"
			>
				新增題目
			</a>
		</section>
	{:else}
		<div class="grid gap-4">
			{#each data.questions as question, index}
				<article
					class="card preset-outlined p-5"
				>
					<div
						class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
					>
						<div class="min-w-0 flex-1">
							<div
								class="flex flex-wrap items-center gap-2"
							>
								<span
									class="badge preset-tonal"
								>
									#{index + 1}
								</span>

								<span
									class="badge preset-tonal"
								>
									{question.optionCount} 選項
								</span>

								{#if question.correctOptionCount === 1}
									<span
										class="badge preset-tonal-success-500"
									>
										正解設定正常
									</span>
								{:else}
									<span
										class="badge preset-tonal-error-500"
									>
										正解 {question.correctOptionCount} 個
									</span>
								{/if}
							</div>

							<h2
								class="mt-3 whitespace-pre-wrap text-lg font-semibold"
							>
								{question.prompt}
							</h2>

							<p
								class="mt-2 font-mono text-xs opacity-50"
							>
								{question.id}
							</p>
						</div>

						<a
							href={`/admin/banks/${data.bank.id}/questions/${question.id}`}
							class="btn preset-tonal-primary shrink-0"
						>
							編輯
						</a>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</div>
