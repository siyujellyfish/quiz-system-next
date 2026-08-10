<script lang="ts">
	import {
		goto
	} from '$app/navigation';

	import {
		Collapsible,
		Dialog,
		Portal
	} from '@skeletonlabs/skeleton-svelte';

	import {
		onDestroy,
		onMount
	} from 'svelte';

	import type {
		PageProps
	} from './$types';

	import QuestionForm
		from '$lib/components/admin/QuestionForm.svelte';

	import { toaster } from '$lib/ui/toaster';

	type PendingNavigation = {
		href: string;
		keepFocus: boolean;
		noScroll: boolean;
		replaceState: boolean;
	};

	let {
		data,
		form
	}: PageProps = $props();

	let isDirty = $state(false);
	let pendingNavigation = $state<PendingNavigation | null>(null);
	let showUnsavedDialog = $state(false);
	let searchValue = $state('');
	let syncedServerQuery = $state('');
	let healthValue = $state<'all' | 'healthy' | 'invalid'>('all');
	let selectedQuestionId = $state('');
	let searchTimer: ReturnType<typeof setTimeout> | null = null;

	let currentQuestion = $derived(
		data.workspace.currentQuestion
	);

	let currentValues = $derived(
		form?.questionId === currentQuestion?.id &&
		form?.values
			? form.values
			: currentQuestion
				? {
					prompt: currentQuestion.prompt,
					options:
						currentQuestion.options.map(
							(option) => ({
								id: option.id,
								content: option.content,
								isCorrect:
									option.isCorrect
							})
						)
				}
				: null
	);

	$effect(() => {
		const serverQuery = data.filters.query;

		if (searchValue === syncedServerQuery) {
			searchValue = serverQuery;
		}

		syncedServerQuery = serverQuery;
		healthValue = data.filters.health;
		selectedQuestionId =
			data.workspace.currentQuestion?.id ?? '';
	});

	function normalizeSearch(
		value: string
	): string {
		return value
			.trim()
			.slice(0, 200);
	}

	function buildWorkspaceHref(
		input: {
			query?: string;
			health?: 'all' | 'healthy' | 'invalid';
			questionId?: string | null;
		}
	): string {
		const params = new URLSearchParams();
		const query = normalizeSearch(
			input.query ?? data.filters.query
		);
		const health =
			input.health ?? data.filters.health;

		if (query) {
			params.set('q', query);
		}

		if (health !== 'all') {
			params.set('health', health);
		}

		if (input.questionId) {
			params.set(
				'question',
				input.questionId
			);
		}

		const queryString = params.toString();

		return `/admin/banks/${data.bank.id}/questions${
			queryString ? `?${queryString}` : ''
		}`;
	}

	function performNavigation(
		navigation: PendingNavigation
	): void {
		void goto(
			navigation.href,
			{
				keepFocus: navigation.keepFocus,
				noScroll: navigation.noScroll,
				replaceState: navigation.replaceState
			}
		);
	}

	function requestNavigation(
		href: string,
		options: {
			keepFocus?: boolean;
			noScroll?: boolean;
			replaceState?: boolean;
		} = {}
	): void {
		const navigation: PendingNavigation = {
			href,
			keepFocus: options.keepFocus ?? false,
			noScroll: options.noScroll ?? false,
			replaceState: options.replaceState ?? false
		};

		if (isDirty) {
			pendingNavigation = navigation;
			showUnsavedDialog = true;
			return;
		}

		performNavigation(navigation);
	}

	function discardAndNavigate(): void {
		const navigation = pendingNavigation;

		showUnsavedDialog = false;
		pendingNavigation = null;
		isDirty = false;

		if (navigation) {
			performNavigation(navigation);
		}
	}

	function continueEditing(): void {
		showUnsavedDialog = false;
		pendingNavigation = null;
		searchValue = data.filters.query;
		syncedServerQuery = data.filters.query;
		healthValue = data.filters.health;
		selectedQuestionId =
			data.workspace.currentQuestion?.id ?? '';
	}

	function scheduleSearch(): void {
		if (searchTimer) {
			clearTimeout(searchTimer);
		}

		searchTimer = setTimeout(() => {
			const normalized = normalizeSearch(
				searchValue
			);

			if (normalized === data.filters.query) {
				return;
			}

			requestNavigation(
				buildWorkspaceHref({
					query: normalized,
					health: healthValue,
					questionId: null
				}),
				{
					keepFocus: true,
					noScroll: true,
					replaceState: true
				}
			);
		}, 300);
	}

	function handleHealthChange(
		event: Event
	): void {
		const value =
			(event.currentTarget as HTMLSelectElement)
				.value;

		if (
			value !== 'all' &&
			value !== 'healthy' &&
			value !== 'invalid'
		) {
			return;
		}

		healthValue = value;

		requestNavigation(
			buildWorkspaceHref({
				query: searchValue,
				health: value,
				questionId: null
			}),
			{
				keepFocus: true,
				noScroll: true,
				replaceState: true
			}
		);
	}

	function handleQuestionChange(
		event: Event
	): void {
		const questionId =
			(event.currentTarget as HTMLSelectElement)
				.value;

		selectedQuestionId = questionId;

		requestNavigation(
			buildWorkspaceHref({
				query: searchValue,
				health: healthValue,
				questionId
			}),
			{
				keepFocus: true,
				noScroll: true
			}
		);
	}

	function handleBeforeUnload(
		event: BeforeUnloadEvent
	): void {
		if (!isDirty) {
			return;
		}

		event.preventDefault();
		event.returnValue = '';
	}

	onMount(() => {
		window.addEventListener(
			'beforeunload',
			handleBeforeUnload
		);

		if (
			data.updated ||
			data.created ||
			data.imported
		) {
			if (data.imported) {
				toaster.success({
					title: '題庫已匯入',
					description:
						`共新增 ${data.importedCount} 道題目。`
				});
			} else if (data.created) {
				toaster.success({
					title: '題目已新增',
					description:
						'新題目已建立並載入編輯器。'
				});
			} else {
				toaster.success({
					title: '題目已更新',
					description:
						data.practiceProgressReset
							? '因選項數量改變，此題庫進行中的 Practice 已重置。'
							: '題目內容已成功儲存。'
				});
			}

			const url = new URL(
				window.location.href
			);
			url.searchParams.delete('updated');
			url.searchParams.delete('created');
			url.searchParams.delete(
				'practiceProgressReset'
			);
			url.searchParams.delete('imported');
			url.searchParams.delete(
				'importedCount'
			);

			window.history.replaceState(
				window.history.state,
				'',
				`${url.pathname}${url.search}${url.hash}`
			);
		}

		return () => {
			window.removeEventListener(
				'beforeunload',
				handleBeforeUnload
			);
		};
	});

	onDestroy(() => {
		if (searchTimer) {
			clearTimeout(searchTimer);
		}
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
			<p class="quiz-eyebrow">QUESTION WORKBENCH</p>
			<h1 class="mt-1 text-3xl font-bold">
				題目管理
			</h1>
			<p class="mt-2 opacity-60">
				{data.bank.name} · {data.workspace.total} 題符合目前條件
			</p>
		</div>

		<a
			href={`/admin/banks/${data.bank.id}/questions/new`}
			class="btn preset-filled-primary-500"
		>
			新增題目
		</a>
	</header>

	<section
		class="app-panel mb-5 grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(14rem,20rem)_auto] lg:items-end"
	>
		<label class="label">
			<span class="label-text">搜尋題目</span>
			<input
				type="search"
				class="input"
				placeholder="題目文字或 UUID"
				maxlength="200"
				bind:value={searchValue}
				oninput={scheduleSearch}
			/>
		</label>

		<label class="label min-w-36">
			<span class="label-text">健康狀態</span>
			<select
				class="select"
				bind:value={healthValue}
				onchange={handleHealthChange}
			>
				<option value="all">全部</option>
				<option value="healthy">設定正常</option>
				<option value="invalid">需要修正</option>
			</select>
		</label>

		<label class="label min-w-0">
			<span class="label-text">選擇題目</span>
			<select
				class="select min-w-0"
				bind:value={selectedQuestionId}
				disabled={data.workspace.items.length === 0}
				onchange={handleQuestionChange}
			>
				{#if data.workspace.items.length === 0}
					<option value="">沒有符合題目</option>
				{:else}
					{#each data.workspace.items as item, index}
						<option value={item.id}>
							#{index + 1} · {item.prompt.replace(/\s+/g, ' ').slice(0, 80)}
						</option>
					{/each}
				{/if}
			</select>
		</label>

		{#if data.filters.query || data.filters.health !== 'all'}
			<button
				type="button"
				class="btn preset-tonal"
				onclick={() =>
					requestNavigation(
						`/admin/banks/${data.bank.id}/questions`,
						{
							keepFocus: true,
							noScroll: true,
							replaceState: true
						}
					)}
			>
				清除篩選
			</button>
		{/if}
	</section>

	{#if !currentQuestion || !currentValues}
		<section class="app-panel p-8 text-center">
			<h2 class="text-xl font-semibold">
				{data.filters.query || data.filters.health !== 'all'
					? '找不到符合條件的題目'
					: '尚未建立題目'}
			</h2>

			<p class="mt-2 opacity-60">
				{data.filters.query || data.filters.health !== 'all'
					? '搜尋與篩選會即時套用，請調整條件後再試一次。'
					: '新增第一道題目後即可在此直接編輯。'}
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
		<div
			class="mb-4 flex flex-wrap items-center justify-between gap-3"
		>
			<div class="flex flex-wrap items-center gap-2">
				<span class="badge preset-tonal">
					Question {data.workspace.position} / {data.workspace.total}
				</span>
				<span class="badge preset-tonal">
					{data.workspace.currentSummary?.optionCount ?? 0} 選項
				</span>
				{#if (data.workspace.currentSummary?.optionCount ?? 0) >= 2 && data.workspace.currentSummary?.correctOptionCount === 1}
					<span class="badge preset-tonal-success-500">
						設定正常
					</span>
				{:else}
					<span class="badge preset-tonal-error-500">
						需要修正
					</span>
				{/if}
			</div>

			<p
				class="max-w-full truncate font-mono text-[11px] opacity-40"
				title={currentQuestion.id}
			>
				{currentQuestion.id}
			</p>
		</div>

		<section class="app-panel p-5 md:p-6">
			<QuestionForm
				values={currentValues}
				errors={
					form?.questionId === currentQuestion.id
						? form?.errors
						: undefined
				}
				message={
					form?.questionId === currentQuestion.id
						? form?.message
						: undefined
				}
				submitLabel="儲存變更"
				formAction="?/update"
				hiddenFields={{
					questionId: currentQuestion.id,
					query: data.filters.query,
					health: data.filters.health
				}}
				onDirtyChange={(dirty) => {
					isDirty = dirty;
				}}
			/>
		</section>

		<nav
			class="mt-5 flex items-center justify-between gap-3"
			aria-label="題目導覽"
		>
			<button
				type="button"
				class="btn preset-tonal"
				disabled={!data.workspace.previousQuestionId}
				onclick={() => {
					if (data.workspace.previousQuestionId) {
						requestNavigation(
							buildWorkspaceHref({
								questionId:
									data.workspace.previousQuestionId
							})
						);
					}
				}}
			>
				← 上一題
			</button>

			<span class="text-sm opacity-60">
				{data.workspace.position} / {data.workspace.total}
			</span>

			<button
				type="button"
				class="btn preset-filled-primary-500"
				disabled={!data.workspace.nextQuestionId}
				onclick={() => {
					if (data.workspace.nextQuestionId) {
						requestNavigation(
							buildWorkspaceHref({
								questionId:
									data.workspace.nextQuestionId
							})
						);
					}
				}}
			>
				下一題 →
			</button>
		</nav>

		<section
			class="app-panel mt-8 border-error-500/50 p-5 md:p-6"
		>
			<h2 class="text-xl font-semibold text-error-700-300">
				危險區域
			</h2>

			<p class="mt-2 text-sm opacity-70">
				刪除題目會同步刪除其選項與相關錯題紀錄，並重置此題庫所有進行中的 Practice。
			</p>

			<Collapsible class="mt-5">
				<Collapsible.Trigger
					class="btn preset-tonal-error"
				>
					我要刪除這道題目
				</Collapsible.Trigger>

				<Collapsible.Content class="mt-4">
					<Dialog role="alertdialog">
						<Dialog.Trigger
							class="btn preset-filled-error-500"
						>
							確認刪除題目
						</Dialog.Trigger>

						<Portal>
							<Dialog.Backdrop
								class="fixed inset-0 z-50 bg-black/60"
							/>
							<Dialog.Positioner
								class="fixed inset-0 z-50 flex items-center justify-center p-4"
							>
								<Dialog.Content
									class="card w-full max-w-lg bg-surface-50-950 p-6 shadow-xl"
								>
									<Dialog.Title
										class="text-xl font-bold text-error-700-300"
									>
										永久刪除這道題目？
									</Dialog.Title>

									<Dialog.Description
										class="mt-3 text-sm opacity-70"
									>
										此操作無法復原，選項與相關錯題紀錄會一併刪除。
									</Dialog.Description>

									<div
										class="card preset-tonal-error-500 mt-4 max-h-40 overflow-y-auto p-4 text-sm whitespace-pre-wrap"
									>
										{currentQuestion.prompt}
									</div>

									<form
										method="POST"
										action="?/delete"
										class="mt-6 flex justify-end gap-3"
									>
										<input
											type="hidden"
											name="questionId"
											value={currentQuestion.id}
										/>
										<input
											type="hidden"
											name="nextQuestionId"
											value={data.workspace.nextQuestionId ?? data.workspace.previousQuestionId ?? ''}
										/>
										<input
											type="hidden"
											name="query"
											value={data.filters.query}
										/>
										<input
											type="hidden"
											name="health"
											value={data.filters.health}
										/>

										<Dialog.CloseTrigger
											type="button"
											class="btn preset-tonal"
										>
											取消
										</Dialog.CloseTrigger>

										<button
											type="submit"
											class="btn preset-filled-error-500"
										>
											永久刪除題目
										</button>
									</form>
								</Dialog.Content>
							</Dialog.Positioner>
						</Portal>
					</Dialog>
				</Collapsible.Content>
			</Collapsible>
		</section>
	{/if}
</div>

<Dialog
	role="alertdialog"
	open={showUnsavedDialog}
	onOpenChange={(details) => {
		showUnsavedDialog = details.open;
		if (!details.open && pendingNavigation) {
			continueEditing();
		}
	}}
>
	<Portal>
		<Dialog.Backdrop
			class="fixed inset-0 z-60 bg-black/60"
		/>
		<Dialog.Positioner
			class="fixed inset-0 z-60 flex items-center justify-center p-4"
		>
			<Dialog.Content
				class="card w-full max-w-md bg-surface-50-950 p-6 shadow-xl"
			>
				<Dialog.Title class="text-xl font-bold">
					目前有尚未儲存的變更
				</Dialog.Title>
				<Dialog.Description class="mt-3 text-sm opacity-70">
					切換題目、搜尋或篩選會放棄目前編輯內容。
				</Dialog.Description>

				<div class="mt-6 flex justify-end gap-3">
					<button
						type="button"
						class="btn preset-tonal"
						onclick={continueEditing}
					>
						繼續編輯
					</button>
					<button
						type="button"
						class="btn preset-filled-error-500"
						onclick={discardAndNavigate}
					>
						放棄變更
					</button>
				</div>
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog>