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

	function getPageHref(
		page: number
	): string {
		const params = new URLSearchParams();

		if (data.filters.query) {
			params.set(
				'q',
				data.filters.query
			);
		}

		if (data.filters.health !== 'all') {
			params.set(
				'health',
				data.filters.health
			);
		}

		if (data.pagination.pageSize !== 25) {
			params.set(
				'size',
				String(data.pagination.pageSize)
			);
		}

		if (page > 1) {
			params.set(
				'page',
				String(page)
			);
		}

		const query = params.toString();

		return query
			? `?${query}`
			: '?';
	}

	function getVisiblePages(): number[] {
		const start = Math.max(
			1,
			data.pagination.page - 2
		);
		const end = Math.min(
			data.pagination.totalPages,
			start + 4
		);
		const adjustedStart = Math.max(
			1,
			end - 4
		);

		return Array.from(
			{
				length:
					end - adjustedStart + 1
			},
			(_, index) =>
				adjustedStart + index
		);
	}

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

<div class="app-page max-w-6xl">
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
		class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
	>
		<div>
			<p class="quiz-eyebrow">QUESTION BANK</p>
			<h1 class="mt-1 text-3xl font-bold">
				題目管理
			</h1>
			<p class="mt-2 opacity-60">
				{data.bank.name} · 共 {data.pagination.total} 題符合目前條件
			</p>
		</div>

		<a
			href={`/admin/banks/${data.bank.id}/questions/new`}
			class="btn preset-filled-primary-500"
		>
			新增題目
		</a>
	</header>

	<form
		method="GET"
		class="app-panel mb-5 grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-end"
	>
		<label class="label">
			<span class="label-text">搜尋題目</span>
			<input
				type="search"
				name="q"
				value={data.filters.query}
				class="input"
				placeholder="題目文字或 UUID"
				maxlength="200"
			/>
		</label>

		<label class="label min-w-36">
			<span class="label-text">健康狀態</span>
			<select
				name="health"
				class="select"
			>
				<option
					value="all"
					selected={data.filters.health === 'all'}
				>
					全部
				</option>
				<option
					value="healthy"
					selected={data.filters.health === 'healthy'}
				>
					設定正常
				</option>
				<option
					value="invalid"
					selected={data.filters.health === 'invalid'}
				>
					需要修正
				</option>
			</select>
		</label>

		<label class="label min-w-28">
			<span class="label-text">每頁</span>
			<select
				name="size"
				class="select"
			>
				{#each [25, 50, 100] as size}
					<option
						value={size}
						selected={data.pagination.pageSize === size}
					>
						{size} 題
					</option>
				{/each}
			</select>
		</label>

		<div class="flex gap-2">
			<button
				type="submit"
				class="btn preset-filled-primary-500"
			>
				套用
			</button>
			{#if data.filters.query || data.filters.health !== 'all' || data.pagination.pageSize !== 25}
				<a
					href="?"
					class="btn preset-tonal"
				>
					清除
				</a>
			{/if}
		</div>
	</form>

	<div
		class="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm"
	>
		<p class="opacity-60">
			{#if data.pagination.total === 0}
				沒有符合條件的題目
			{:else}
				顯示
				{(data.pagination.page - 1) * data.pagination.pageSize + 1}
				–
				{Math.min(
					data.pagination.total,
					data.pagination.page * data.pagination.pageSize
				)}
				，共 {data.pagination.total} 題
			{/if}
		</p>

		{#if data.pagination.totalPages > 1}
			<p class="font-medium">
				第 {data.pagination.page} / {data.pagination.totalPages} 頁
			</p>
		{/if}
	</div>

	{#if data.questions.length === 0}
		<section class="app-panel p-8 text-center">
			<h2 class="text-xl font-semibold">
				{data.pagination.total === 0 && (data.filters.query || data.filters.health !== 'all')
					? '找不到符合條件的題目'
					: '尚未建立題目'}
			</h2>

			<p class="mt-2 opacity-60">
				{data.filters.query || data.filters.health !== 'all'
					? '請調整搜尋文字或健康狀態後再試一次。'
					: '新增第一道題目後即可在 Practice 與 Exam 使用。'}
			</p>

			{#if !data.filters.query && data.filters.health === 'all'}
				<a
					href={`/admin/banks/${data.bank.id}/questions/new`}
					class="btn preset-filled-primary-500 mt-5"
				>
					新增題目
				</a>
			{/if}
		</section>
	{:else}
		<div class="grid gap-3">
			{#each data.questions as question, index}
				<article class="app-panel p-4 md:p-5">
					<div
						class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
					>
						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-2">
								<span class="badge preset-tonal">
									#{(data.pagination.page - 1) * data.pagination.pageSize + index + 1}
								</span>

								<span class="badge preset-tonal">
									{question.optionCount} 選項
								</span>

								{#if question.optionCount >= 2 && question.correctOptionCount === 1}
									<span class="badge preset-tonal-success-500">
										設定正常
									</span>
								{:else}
									<span class="badge preset-tonal-error-500">
										需要修正 · 正解 {question.correctOptionCount} 個
									</span>
								{/if}
							</div>

							<h2
								class="mt-3 line-clamp-3 whitespace-pre-wrap text-base font-semibold leading-relaxed md:text-lg"
							>
								{question.prompt}
							</h2>

							<p
								class="mt-2 truncate font-mono text-[11px] opacity-40"
								title={question.id}
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

	{#if data.pagination.totalPages > 1}
		<nav
			class="mt-6 flex flex-wrap items-center justify-center gap-2"
			aria-label="題目分頁"
		>
			<a
				href={getPageHref(Math.max(1, data.pagination.page - 1))}
				class="btn preset-tonal"
				aria-disabled={data.pagination.page === 1}
				class:pointer-events-none={data.pagination.page === 1}
				class:opacity-40={data.pagination.page === 1}
			>
				上一頁
			</a>

			{#each getVisiblePages() as page}
				<a
					href={getPageHref(page)}
					class="btn min-w-10"
					class:preset-filled-primary-500={page === data.pagination.page}
					class:preset-tonal={page !== data.pagination.page}
					aria-current={page === data.pagination.page ? 'page' : undefined}
				>
					{page}
				</a>
			{/each}

			<a
				href={getPageHref(Math.min(data.pagination.totalPages, data.pagination.page + 1))}
				class="btn preset-tonal"
				aria-disabled={data.pagination.page === data.pagination.totalPages}
				class:pointer-events-none={data.pagination.page === data.pagination.totalPages}
				class:opacity-40={data.pagination.page === data.pagination.totalPages}
			>
				下一頁
			</a>
		</nav>
	{/if}
</div>
