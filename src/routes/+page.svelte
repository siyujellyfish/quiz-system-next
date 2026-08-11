<script lang="ts">
	import {
		applyAction,
		enhance
	} from '$app/forms';
	import {
		goto,
		invalidateAll
	} from '$app/navigation';

	import {
		Dialog,
		Portal,
		SegmentedControl,
		Tabs
	} from '@skeletonlabs/skeleton-svelte';
	import type {
		SubmitFunction
	} from '@sveltejs/kit';
	import {
		BookOpen,
		CircleAlert,
		ListChecks,
		LogIn,
		Play,
		RefreshCcw,
		RotateCcw,
		Shuffle,
		Target,
		Timer,
		Trash2
	} from '@lucide/svelte';

	import QuestionBankPicker
		from '$lib/components/quiz/QuestionBankPicker.svelte';
	import {
		getGuestPracticeStorageKey
	} from '$lib/quiz/storage';
	import { toaster } from '$lib/ui/toaster';
	import type {
		PracticeQuestionsState
	} from '$lib/types/quiz';

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
	let clearingWrong =
		$state(false);

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
		index: number
	): void {
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

	async function clearWrongSet(): Promise<void> {
		if (
			!selectedBank ||
			clearingWrong
		) {
			return;
		}

		clearingWrong = true;

		try {
			const response = await fetch(
				`/wrong/${encodeURIComponent(
					selectedBank.slug
				)}/clear`,
				{
					method: 'POST'
				}
			);

			if (!response.ok) {
				throw new Error(
					'Failed to clear wrong questions'
				);
			}

			const result = await response.json() as {
				clearedCount: number;
			};

			toaster.success({
				title: '錯題已清除',
				description:
					`已清除 ${selectedBank.name} 的 ${result.clearedCount} 道錯題。`
			});

			await invalidateAll();
		} catch {
			toaster.error({
				title: '無法清除錯題',
				description:
					'請稍後再試一次。'
			});
		} finally {
			clearingWrong = false;
		}
	}
</script>

<svelte:head>
	<title>Quiz</title>
</svelte:head>

<div class="app-page">
	{#if data.banks.length === 0}
		<section class="app-panel p-8 text-center">
			<BookOpen
				size={32}
				class="mx-auto opacity-45"
				aria-hidden="true"
			/>
			<h1 class="mt-3 text-2xl font-bold">目前沒有可用題庫</h1>
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
			<section class="app-panel overflow-hidden">
				<header
					class="flex flex-col gap-4 px-4 pt-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between"
				>
					<Tabs.List
						class="relative flex w-fit max-w-full border-b border-surface-300-700"
					>
						<Tabs.Trigger
							value="practice"
							class="flex items-center gap-2 px-3 py-3 font-bold sm:px-4"
						>
							<ListChecks size={17} aria-hidden="true" />
							練習模式
						</Tabs.Trigger>
						<Tabs.Trigger
							value="wrong"
							class="flex items-center gap-2 px-3 py-3 font-bold sm:px-4"
						>
							<CircleAlert size={17} aria-hidden="true" />
							錯題模式
						</Tabs.Trigger>
						<Tabs.Trigger
							value="exam"
							class="flex items-center gap-2 px-3 py-3 font-bold sm:px-4"
						>
							<Timer size={17} aria-hidden="true" />
							模擬測驗
						</Tabs.Trigger>
						<Tabs.Indicator class="h-0.5 bg-primary-500" />
					</Tabs.List>

					{#if selectedBank}
						<div class="w-full lg:w-auto">
							<QuestionBankPicker
								banks={data.banks}
								selectedIndex={selectedBankIndex}
								onSelect={setSelectedBank}
							/>
						</div>
					{/if}
				</header>

				{#if selectedBank}
					<div class="mt-3 border-t border-surface-300-700">
						<Tabs.Content value="practice">
							<div class="p-5 md:p-6">
								<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
									<div>
										<div class="flex items-center gap-2">
											<ListChecks
												size={20}
												class="text-primary-700-300"
												aria-hidden="true"
											/>
											<h1 class="text-2xl font-bold">練習模式</h1>
										</div>
										<p class="mt-2 text-sm opacity-60">
											{selectedBank.description || '點擊選項立即判定；登入後會保存進度與即時正確率。'}
										</p>
									</div>
									<span class="text-sm font-semibold opacity-60">
										{selectedBank.questionCount} 題
									</span>
								</div>

								{#if selectedBank.progress}
									<section class="mt-6 border-t border-surface-300-700 pt-5">
										<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
											<div>
												<div class="flex items-center gap-2 text-sm font-semibold">
													<Target size={17} aria-hidden="true" />
													目前練習進度
												</div>
												<p class="mt-1 text-sm opacity-60">
													{selectedBank.progress.completedQuestions} / {selectedBank.progress.totalQuestions} 題
												</p>
											</div>
											<a
												href={`/practice/${selectedBank.slug}`}
												class="btn preset-filled-primary-500"
											>
												<Play size={16} aria-hidden="true" />
												繼續練習
											</a>
										</div>

										<progress
											class="progress mt-4 w-full"
											value={selectedBank.progress.completedQuestions}
											max={selectedBank.progress.totalQuestions}
										></progress>
									</section>
								{/if}

								{#key selectedBank.id}
									<form
										id="practice-start-form"
										method="POST"
										action="?/startPractice"
										use:enhance={enhanceStart}
										class="mt-6 border-t border-surface-300-700 pt-5"
									>
										<input
											type="hidden"
											name="bankId"
											value={selectedBank.id}
										/>

										<div class="space-y-5">
											<SegmentedControl
												name="coverage"
												defaultValue={String(selectedBank.progress?.coverage ?? 30)}
											>
												<SegmentedControl.Label class="mb-2 flex items-center gap-2 text-sm font-semibold">
													<Target size={17} aria-hidden="true" />
													題目數量
												</SegmentedControl.Label>
												<SegmentedControl.Control class="grid w-full grid-cols-3 sm:flex sm:w-fit">
													<SegmentedControl.Indicator />
													{#each [30, 50, 100] as coverage}
														<SegmentedControl.Item value={String(coverage)}>
															<SegmentedControl.ItemText>
																<span class="whitespace-nowrap font-semibold">
																	{coverage === 100 ? '全部' : `${coverage}%`}
																	<span class="ml-1 text-xs font-normal opacity-60">
																		· {coverage === 100
																			? selectedBank.questionCount
																			: Math.ceil(selectedBank.questionCount * coverage / 100)} 題
																	</span>
																</span>
															</SegmentedControl.ItemText>
															<SegmentedControl.ItemHiddenInput />
														</SegmentedControl.Item>
													{/each}
												</SegmentedControl.Control>
											</SegmentedControl>

											<SegmentedControl
												name="optionOrder"
												defaultValue={selectedBank.progress?.shuffleOptions === false ? 'fixed' : 'random'}
											>
												<SegmentedControl.Label class="mb-2 flex items-center gap-2 text-sm font-semibold">
													<Shuffle size={17} aria-hidden="true" />
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

										<div class="mt-6 flex flex-wrap items-center justify-end gap-3">
											{#if selectedBank.progress}
												<Dialog role="alertdialog">
													<Dialog.Trigger class="btn preset-tonal">
														<RotateCcw size={16} aria-hidden="true" />
														重新開始
													</Dialog.Trigger>
													<Portal>
														<Dialog.Backdrop class="fixed inset-0 z-50 bg-black/60" />
														<Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
															<Dialog.Content class="card w-full max-w-lg bg-surface-50-950 p-6 shadow-xl">
																<Dialog.Title class="text-xl font-bold">重新開始練習？</Dialog.Title>
																<Dialog.Description class="mt-3 text-sm opacity-70">
																	目前進度會被重置，並依上方設定建立全新一輪；既有錯題不受影響。
																</Dialog.Description>
																<div class="mt-6 flex justify-end gap-3">
																	<Dialog.CloseTrigger type="button" class="btn preset-tonal">取消</Dialog.CloseTrigger>
																	<Dialog.CloseTrigger
																		type="submit"
																		form="practice-start-form"
																		class="btn preset-filled-primary-500"
																	>
																		<RefreshCcw size={16} aria-hidden="true" />
																		建立新一輪
																	</Dialog.CloseTrigger>
																</div>
															</Dialog.Content>
														</Dialog.Positioner>
													</Portal>
												</Dialog>
											{:else}
												<button
													type="submit"
													class="btn preset-filled-primary-500"
													disabled={selectedBank.questionCount === 0}
												>
													<Play size={16} aria-hidden="true" />
													開始練習
												</button>
											{/if}
										</div>
									</form>
								{/key}
							</div>
						</Tabs.Content>

						<Tabs.Content value="wrong">
							<div class="p-5 md:p-6">
								<div class="flex items-center gap-2">
									<CircleAlert
										size={20}
										class="text-error-700-300"
										aria-hidden="true"
									/>
									<h1 class="text-2xl font-bold">錯題模式</h1>
								</div>
								<p class="mt-2 text-sm opacity-60">
									答對會立即從錯題中移除；答錯會保留，直到真正答對為止。
								</p>

								{#if !data.user}
									<div class="mt-6 border-t border-surface-300-700 py-8 text-center">
										<LogIn size={28} class="mx-auto opacity-45" aria-hidden="true" />
										<h2 class="mt-3 text-xl font-semibold">登入後才能使用錯題模式</h2>
										<p class="mt-2 opacity-60">
											錯題會依帳號保存，因此訪客模式無法建立個人錯題集合。
										</p>
										<a
											href="/login?redirectTo=%2F"
											class="btn preset-filled-primary-500 mt-5"
										>
											<LogIn size={16} aria-hidden="true" />
											登入
										</a>
									</div>
								{:else}
									<section class="mt-6 border-t border-surface-300-700 pt-5">
										<div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
											<div>
												<p class="text-sm font-semibold opacity-60">剩餘錯題</p>
												<p
													class="mt-1 text-4xl font-bold"
													class:text-error-700-300={(selectedBank.wrongCount ?? 0) > 0}
												>
													{selectedBank.wrongCount ?? 0}
												</p>
											</div>

											<div class="flex flex-wrap gap-3">
												{#if (selectedBank.wrongCount ?? 0) > 0}
													<Dialog role="alertdialog">
														<Dialog.Trigger class="btn preset-tonal-error">
															<Trash2 size={16} aria-hidden="true" />
															清除錯題
														</Dialog.Trigger>
														<Portal>
															<Dialog.Backdrop class="fixed inset-0 z-50 bg-black/60" />
															<Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
																<Dialog.Content class="card w-full max-w-lg bg-surface-50-950 p-6 shadow-xl">
																	<Dialog.Title class="text-xl font-bold text-error-700-300">
																		清除 {selectedBank.name} 的錯題？
																	</Dialog.Title>
																	<Dialog.Description class="mt-3 text-sm opacity-70">
																		將移除目前題庫的 {selectedBank.wrongCount ?? 0} 道錯題。此操作無法復原，但不會刪除原始題目或 Practice 進度。
																	</Dialog.Description>
																	<div class="mt-6 flex justify-end gap-3">
																		<Dialog.CloseTrigger type="button" class="btn preset-tonal">取消</Dialog.CloseTrigger>
																		<Dialog.CloseTrigger
																			type="button"
																			class="btn preset-filled-error-500"
																			disabled={clearingWrong}
																			onclick={clearWrongSet}
																		>
																			<Trash2 size={16} aria-hidden="true" />
																			{clearingWrong ? '清除中...' : `清除 ${selectedBank.wrongCount ?? 0} 道錯題`}
																		</Dialog.CloseTrigger>
																	</div>
																</Dialog.Content>
															</Dialog.Positioner>
														</Portal>
													</Dialog>

													<a
														href={`/wrong/${selectedBank.slug}`}
														class="btn preset-filled-primary-500"
													>
														<Play size={16} aria-hidden="true" />
														開始複習
													</a>
												{:else}
													<span class="text-sm opacity-60">目前沒有待複習的錯題</span>
												{/if}
											</div>
										</div>
									</section>
								{/if}
							</div>
						</Tabs.Content>

						<Tabs.Content value="exam">
							<div class="p-5 md:p-6">
								<div class="flex items-center gap-2">
									<Timer
										size={20}
										class="text-primary-700-300"
										aria-hidden="true"
									/>
									<h1 class="text-2xl font-bold">模擬測驗</h1>
								</div>
								<p class="mt-2 text-sm opacity-60">
									完整題庫模擬作答，交卷前不顯示正確答案。
								</p>

								<section class="mt-6 border-t border-surface-300-700 pt-5">
									<div class="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
										<ul class="grid gap-3 text-sm opacity-70 sm:grid-cols-2">
											<li class="flex items-center gap-2">
												<BookOpen size={16} aria-hidden="true" />
												全部 {selectedBank.questionCount} 題
											</li>
											<li class="flex items-center gap-2">
												<Shuffle size={16} aria-hidden="true" />
												題目順序隨機
											</li>
											<li class="flex items-center gap-2">
												<Shuffle size={16} aria-hidden="true" />
												選項順序隨機
											</li>
											<li class="flex items-center gap-2">
												<Timer size={16} aria-hidden="true" />
												正數計時，交卷後公布答案
											</li>
										</ul>

										{#if selectedBank.questionCount > 0}
											<a
												href={`/exam/${selectedBank.slug}`}
												class="btn preset-filled-primary-500"
											>
												<Play size={16} aria-hidden="true" />
												開始測驗
											</a>
										{:else}
											<button
												type="button"
												class="btn preset-tonal"
												disabled
											>
												沒有可用題目
											</button>
										{/if}
									</div>
								</section>
							</div>
						</Tabs.Content>
					</div>
				{/if}
			</section>
		</Tabs>
	{/if}
</div>
