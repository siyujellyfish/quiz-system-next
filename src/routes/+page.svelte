<script lang="ts">
	import {
		applyAction,
		enhance
	} from '$app/forms';

	import {
		goto
	} from '$app/navigation';

	import {
		SegmentedControl,
		Tabs
	} from '@skeletonlabs/skeleton-svelte';
	import type {
		SubmitFunction
	} from '@sveltejs/kit';

	import type {
		PracticeQuestionsState
	} from '$lib/types/quiz';

	import {
		getGuestPracticeStorageKey
	} from '$lib/quiz/storage';

	type QuizMode =
		| 'practice'
		| 'wrong'
		| 'exam';

	type GuestPracticeResult = {
		guestPractice: {
			slug: string;
			questionsState:
				PracticeQuestionsState;
		};
	};

	let {
		data,
		form
	} = $props();

	let activeMode =
		$state<QuizMode>('practice');
	let selectedBankIndex =
		$state(0);

	let selectedBank =
		$derived(
			data.banks[selectedBankIndex] ??
				data.banks[0] ??
				null
		);

	function isGuestPracticeResult(
		value: unknown
	): value is GuestPracticeResult {
		if (
			typeof value !== 'object' ||
			value === null
		) {
			return false;
		}

		return (
			'guestPractice' in value &&
			typeof value.guestPractice ===
				'object' &&
			value.guestPractice !== null
		);
	}

	function setActiveMode(
		value: string
	): void {
		if (
			value === 'practice' ||
			value === 'wrong' ||
			value === 'exam'
		) {
			activeMode = value;
		}
	}

	function setSelectedBank(
		value: string
	): void {
		const index = Number(value);

		if (
			Number.isInteger(index) &&
			index >= 0 &&
			index < data.banks.length
		) {
			selectedBankIndex = index;
		}
	}

	const enhanceStart: SubmitFunction =
		() => {
			return async ({ result }) => {
				if (
					result.type === 'success' &&
					isGuestPracticeResult(
						result.data
					)
				) {
					const {
						slug,
						questionsState
					} = result.data.guestPractice;

					sessionStorage.setItem(
						getGuestPracticeStorageKey(
							slug
						),
						JSON.stringify({
							questionsState,
							currentIndex: 0,
							answeredCount: 0,
							correctCount: 0
						})
					);

					await goto(
						`/practice/${slug}`
					);

					return;
				}

				await applyAction(result);
			};
		};
</script>

<svelte:head>
	<title>刷題模式 | Quiz</title>
</svelte:head>

<div class="app-page">
	{#if data.banks.length === 0}
		<section class="app-panel p-8 text-center">
			<h1 class="text-2xl font-bold">目前沒有可用題庫</h1>
			<p class="mt-2 opacity-60">
				請先由管理後台建立或匯入題庫。
			</p>
		</section>
	{:else}
		<Tabs
			value={activeMode}
			onValueChange={(details) =>
				setActiveMode(details.value)}
		>
			<section
				class="quiz-toolbar mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
			>
				<Tabs.List
					class="w-fit rounded-container bg-surface-200-800 p-1"
				>
					<Tabs.Trigger
						value="practice"
						class="px-4 py-2 font-bold"
					>
						練習模式
					</Tabs.Trigger>
					<Tabs.Trigger
						value="wrong"
						class="px-4 py-2 font-bold"
					>
						錯題模式
					</Tabs.Trigger>
					<Tabs.Trigger
						value="exam"
						class="px-4 py-2 font-bold"
					>
						模擬測驗
					</Tabs.Trigger>
					<Tabs.Indicator />
				</Tabs.List>

				{#if selectedBank}
					<div
						class="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end"
					>
						<div class="hidden text-right sm:block">
							<p class="quiz-eyebrow">
								{activeMode === 'practice'
									? '練習模式題庫'
									: activeMode === 'wrong'
										? '錯題模式題庫'
										: '模擬測驗題庫'}
							</p>
							<p class="text-sm font-semibold">
								{selectedBank.slug.toUpperCase()} / {selectedBank.questionCount} 題
							</p>
						</div>

						<select
							class="select w-full sm:w-72"
							aria-label="選擇題庫"
							value={selectedBankIndex}
							onchange={(event) =>
								setSelectedBank(
									event.currentTarget.value
								)}
						>
							{#each data.banks as bank, index}
								<option value={index}>
									{bank.name} · {bank.questionCount} 題
								</option>
							{/each}
						</select>
					</div>
				{/if}
			</section>

			{#if selectedBank}
				<Tabs.Content value="practice">
					<section class="app-panel overflow-hidden">
						<header
							class="border-b border-surface-300-700 px-5 py-4 md:px-6"
						>
							<h1 class="text-2xl font-bold">
								練習模式
							</h1>
							<p class="mt-1 text-sm opacity-60">
								題目順序固定隨機，點擊選項立即判定；登入後會保存進度與即時正確率。
							</p>
						</header>

						<div class="p-5 md:p-6">
							<div
								class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
							>
								<div>
									<p class="quiz-eyebrow">QUESTION BANK</p>
									<h2 class="mt-1 text-xl font-bold">
										{selectedBank.name}
									</h2>
									{#if selectedBank.description}
										<p class="mt-1 text-sm opacity-60">
											{selectedBank.description}
										</p>
									{/if}
								</div>

								<span class="badge preset-tonal-primary">
									{selectedBank.questionCount} 題
								</span>
							</div>

							{#if selectedBank.progress}
								<div class="mb-5 rounded-container border border-surface-300-700 bg-surface-100-900 p-4">
									<div class="flex items-center justify-between gap-4">
										<div>
											<p class="text-sm font-semibold">目前練習進度</p>
											<p class="mt-1 text-sm opacity-60">
												{selectedBank.progress.completedQuestions} / {selectedBank.progress.totalQuestions} 題
											</p>
										</div>
										<a
											href={`/practice/${selectedBank.slug}`}
											class="btn preset-tonal-primary"
										>
											繼續練習
										</a>
									</div>

									<progress
										class="progress mt-4 w-full"
										value={selectedBank.progress.completedQuestions}
										max={selectedBank.progress.totalQuestions}
									></progress>
								</div>
							{/if}

							<form
								method="POST"
								action="?/startPractice"
								use:enhance={enhanceStart}
								class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"
							>
								<input
									type="hidden"
									name="bankId"
									value={selectedBank.id}
								/>

								<div class="space-y-5">
									<SegmentedControl
										name="coverage"
										defaultValue="30"
										class="w-full"
									>
										<SegmentedControl.Label class="mb-2 text-sm font-semibold">
											題目數量
										</SegmentedControl.Label>
										<SegmentedControl.Control class="grid w-full grid-cols-3">
											<SegmentedControl.Indicator />
											{#each [30, 50, 100] as coverage}
												<SegmentedControl.Item value={String(coverage)}>
													<SegmentedControl.ItemText>
														<strong>{coverage}%</strong>
														<span class="ml-1 text-xs opacity-60">
															· {coverage === 100
																? selectedBank.questionCount
																: Math.ceil(selectedBank.questionCount * coverage / 100)} 題
														</span>
													</SegmentedControl.ItemText>
													<SegmentedControl.ItemHiddenInput />
												</SegmentedControl.Item>
											{/each}
										</SegmentedControl.Control>
									</SegmentedControl>

									<SegmentedControl
										name="optionOrder"
										defaultValue="random"
										class="w-full"
									>
										<SegmentedControl.Label class="mb-2 text-sm font-semibold">
											選項順序
										</SegmentedControl.Label>
										<SegmentedControl.Control class="w-fit">
											<SegmentedControl.Indicator />
											<SegmentedControl.Item value="random">
												<SegmentedControl.ItemText>隨機</SegmentedControl.ItemText>
												<SegmentedControl.ItemHiddenInput />
											</SegmentedControl.Item>
											<SegmentedControl.Item value="fixed">
												<SegmentedControl.ItemText>固定</SegmentedControl.ItemText>
												<SegmentedControl.ItemHiddenInput />
											</SegmentedControl.Item>
										</SegmentedControl.Control>
									</SegmentedControl>

									{#if form?.bankId === selectedBank.id && form?.message}
										<div
											class="preset-tonal-error rounded-container p-3 text-sm"
											role="alert"
										>
											{form.message}
										</div>
									{/if}
								</div>

								<button
									type="submit"
									class="btn preset-filled-primary-500"
									disabled={selectedBank.questionCount === 0}
								>
									{selectedBank.progress ? '重新開始' : '開始練習'}
								</button>
							</form>
						</div>
					</section>
				</Tabs.Content>

				<Tabs.Content value="wrong">
					<section class="app-panel overflow-hidden">
						<header class="border-b border-surface-300-700 px-5 py-4 md:px-6">
							<h1 class="text-2xl font-bold">錯題模式</h1>
							<p class="mt-1 text-sm opacity-60">
								答對會立即從錯題中移除；答錯會保留，直到真正答對為止。
							</p>
						</header>

						<div class="p-5 md:p-6">
							{#if !data.user}
								<div class="py-8 text-center">
									<h2 class="text-xl font-semibold">登入後才能使用錯題模式</h2>
									<p class="mt-2 opacity-60">
										錯題會依帳號保存，因此訪客模式無法建立個人錯題集合。
									</p>
									<a
										href="/login?redirectTo=%2F"
										class="btn preset-filled-primary-500 mt-5"
									>
										登入
									</a>
								</div>
							{:else}
								<div class="grid gap-5 md:grid-cols-[minmax(0,1fr)_14rem] md:items-center">
									<div>
										<p class="quiz-eyebrow">QUESTION BANK</p>
										<h2 class="mt-1 text-xl font-bold">{selectedBank.name}</h2>
										<p class="mt-2 text-sm opacity-60">
											選擇後會隨機抽取目前的錯題；答對後即時從集合移除。
										</p>
									</div>

									<div class="quiz-stat-tile">
										<p class="text-sm opacity-60">剩餘錯題</p>
										<p
											class="mt-1 text-4xl font-bold"
											class:text-error-700-300={(selectedBank.wrongCount ?? 0) > 0}
										>
											{selectedBank.wrongCount ?? 0}
										</p>
										{#if (selectedBank.wrongCount ?? 0) > 0}
											<a
												href={`/wrong/${selectedBank.slug}`}
												class="btn preset-filled-primary-500 mt-4 w-full"
											>
												開始複習
											</a>
										{:else}
											<p class="mt-3 text-sm opacity-60">目前沒有待複習的錯題</p>
										{/if}
									</div>
								</div>
							{/if}
						</div>
					</section>
				</Tabs.Content>

				<Tabs.Content value="exam">
					<section class="app-panel overflow-hidden">
						<header class="border-b border-surface-300-700 px-5 py-4 md:px-6">
							<h1 class="text-2xl font-bold">模擬測驗</h1>
							<p class="mt-1 text-sm opacity-60">
								完整題庫模擬作答，交卷前不顯示正確答案。
							</p>
						</header>

						<div class="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_14rem] md:items-center md:p-6">
							<div>
								<p class="quiz-eyebrow">QUESTION BANK</p>
								<h2 class="mt-1 text-xl font-bold">{selectedBank.name}</h2>
								<ul class="mt-4 grid gap-2 text-sm opacity-70 sm:grid-cols-2">
									<li>全部 {selectedBank.questionCount} 題</li>
									<li>題目順序隨機</li>
									<li>選項順序隨機</li>
									<li>交卷後公布答案</li>
									<li>正數計時</li>
								</ul>
							</div>

							<div class="quiz-stat-tile">
								<p class="text-sm opacity-60">測驗題數</p>
								<p class="mt-1 text-4xl font-bold">{selectedBank.questionCount}</p>
								{#if selectedBank.questionCount > 0}
									<a
										href={`/exam/${selectedBank.slug}`}
										class="btn preset-filled-primary-500 mt-4 w-full"
									>
										開始考試
									</a>
								{:else}
									<button
										type="button"
										class="btn preset-tonal mt-4 w-full"
										disabled
									>
										沒有可用題目
									</button>
								{/if}
							</div>
						</div>
					</section>
				</Tabs.Content>
			{/if}
		</Tabs>
	{/if}
</div>
