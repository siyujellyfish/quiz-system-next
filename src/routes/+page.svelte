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
		$state<QuizMode>(
			'practice'
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


<div
	class="mx-auto w-full max-w-5xl p-4 md:p-6"
>
	<p class="mb-5 opacity-60">
		選擇模式與題庫開始作答。
	</p>


	<Tabs
		value={activeMode}
		onValueChange={(details) =>
			setActiveMode(details.value)}
	>
		<Tabs.List class="mb-8 w-fit">
			<Tabs.Trigger value="practice">
				練習
			</Tabs.Trigger>
			<Tabs.Trigger value="wrong">
				錯題
			</Tabs.Trigger>
			<Tabs.Trigger value="exam">
				考試練習
			</Tabs.Trigger>
			<Tabs.Indicator />
		</Tabs.List>

		<Tabs.Content value="practice">
			<section class="mb-6">
				<h2 class="text-2xl font-semibold">
					練習模式
				</h2>

				<p class="mt-2 opacity-60">
					題目順序固定隨機，點擊選項立即判定；登入狀態下進度與即時正確率會自動保存。
				</p>
			</section>

			<div class="space-y-6">
				{#each data.banks as bank}
					<section
						class="card preset-outlined p-6"
					>
						<header
							class="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
						>
							<div>
								<h3 class="text-xl font-semibold">
									{bank.name}
								</h3>

								{#if bank.description}
									<p class="mt-1 text-sm opacity-60">
										{bank.description}
									</p>
								{/if}
							</div>

							<span class="text-sm opacity-60">
								{bank.questionCount} 題
							</span>
						</header>

						{#if bank.progress}
							<div
								class="mb-6 rounded-container bg-surface-100-900 p-4"
							>
								<div
									class="flex items-center justify-between gap-4"
								>
									<div>
										<p class="text-sm font-medium">
											目前練習進度
										</p>

										<p class="mt-1 text-sm opacity-60">
											{bank.progress.completedQuestions}
											/
											{bank.progress.totalQuestions}
											題
										</p>
									</div>

									<a
										href={`/practice/${bank.slug}`}
										class="btn preset-tonal-primary"
									>
										繼續練習
									</a>
								</div>

								<progress
									class="progress mt-4 w-full"
									value={bank.progress.completedQuestions}
									max={bank.progress.totalQuestions}
								></progress>
							</div>
						{/if}

						<form
							method="POST"
							action="?/startPractice"
							use:enhance={enhanceStart}
							class="space-y-6"
						>
							<input
								type="hidden"
								name="bankId"
								value={bank.id}
							/>

							<SegmentedControl
								name="coverage"
								defaultValue="30"
								class="w-full"
							>
								<SegmentedControl.Label
									class="mb-3 text-sm font-semibold"
								>
									題目數量
								</SegmentedControl.Label>
								<SegmentedControl.Control
									class="grid w-full grid-cols-3"
								>
									<SegmentedControl.Indicator />
									{#each [30, 50, 100] as coverage}
										<SegmentedControl.Item
											value={String(coverage)}
										>
											<SegmentedControl.ItemText>
												<strong>{coverage}%</strong>
												<span class="ml-1 text-xs opacity-60">
													· {coverage === 100
														? bank.questionCount
														: Math.ceil(
															bank.questionCount * coverage / 100
														)} 題
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
								<SegmentedControl.Label
									class="mb-3 text-sm font-semibold"
								>
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

							{#if
								form?.bankId === bank.id &&
								form?.message
							}
								<div
									class="preset-tonal-error rounded-container p-3 text-sm"
									role="alert"
								>
									{form.message}
								</div>
							{/if}

							<div class="flex justify-end">
								<button
									type="submit"
									class="btn preset-filled-primary-500"
									disabled={bank.questionCount === 0}
								>
									{bank.progress
										? '重新開始'
										: '開始練習'}
								</button>
							</div>
						</form>
					</section>
				{/each}
			</div>
		</Tabs.Content>

		<Tabs.Content value="wrong">
			<section class="mb-6">
				<h2 class="text-2xl font-semibold">
					錯題模式
				</h2>

				<p class="mt-2 opacity-60">
					答對會立即從錯題中移除；答錯則保留，直到真正答對為止。
				</p>
			</section>

			{#if !data.user}
				<section
					class="card preset-outlined p-8 text-center"
				>
					<h3 class="text-xl font-semibold">
						登入後才能使用錯題模式
					</h3>

					<p class="mt-2 opacity-60">
						錯題會依帳號保存，因此訪客模式無法建立個人錯題集合。
					</p>

					<a
						href="/login?redirectTo=%2F"
						class="btn preset-filled-primary-500 mt-6"
					>
						登入
					</a>
				</section>
			{:else}
				<div class="grid gap-5 md:grid-cols-2">
					{#each data.banks as bank}
						<section
							class="card preset-outlined p-6"
						>
							<div
								class="flex items-start justify-between gap-4"
							>
								<div>
									<h3 class="text-xl font-semibold">
										{bank.name}
									</h3>

									<p class="mt-2 text-sm opacity-60">
										剩餘錯題
									</p>

									<p
										class="mt-1 text-3xl font-bold"
										class:text-error-700-300={
											(bank.wrongCount ?? 0) > 0
										}
									>
										{bank.wrongCount ?? 0}
									</p>
								</div>

								<span
									class="badge preset-tonal-error"
								>
									錯題
								</span>
							</div>

							<div class="mt-6 flex justify-end">
								{#if (bank.wrongCount ?? 0) > 0}
									<a
										href={`/wrong/${bank.slug}`}
										class="btn preset-filled-primary-500"
									>
										開始複習
									</a>
								{:else}
									<span class="text-sm opacity-60">
										目前沒有待複習的錯題
									</span>
								{/if}
							</div>
						</section>
					{/each}
				</div>
			{/if}
		</Tabs.Content>

		<Tabs.Content value="exam">
			<section class="mb-6">
				<h2 class="text-2xl font-semibold">
					考試練習
				</h2>

				<p class="mt-2 opacity-60">
					完整題庫模擬作答，交卷前不顯示正確答案。
				</p>
			</section>

			<div class="grid gap-5 md:grid-cols-2">
				{#each data.banks as bank}
					<section
						class="card preset-outlined p-6"
					>
						<div
							class="flex items-start justify-between gap-4"
						>
							<div>
								<h3 class="text-xl font-semibold">
									{bank.name}
								</h3>

								<p class="mt-1 text-sm opacity-60">
									共 {bank.questionCount} 題
								</p>
							</div>

							<span
								class="badge preset-tonal-primary"
							>
								Exam
							</span>
						</div>

						<ul
							class="mt-5 space-y-2 text-sm opacity-70"
						>
							<li>全部題目</li>
							<li>題目順序隨機</li>
							<li>選項順序隨機</li>
							<li>交卷後公布答案</li>
							<li>正數計時</li>
						</ul>

						<div class="mt-6 flex justify-end">
							{#if bank.questionCount > 0}
								<a
									href={`/exam/${bank.slug}`}
									class="btn preset-filled-primary-500"
								>
									開始考試
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
				{/each}
			</div>
		</Tabs.Content>
	</Tabs>
</div>
