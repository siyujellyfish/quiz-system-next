<script lang="ts">
	import {
		goto,
		invalidateAll
	} from '$app/navigation';

	import {
		Dialog,
		Portal,
		Progress
	} from '@skeletonlabs/skeleton-svelte';
	import { RotateCcw } from 'lucide-svelte';
	import {
		onMount
	} from 'svelte';

	import type {
		PageProps
	} from './$types';

	import type {
		GuestPracticeSession,
		PracticeCoverage,
		PracticeQuestionsState,
		PublicQuizQuestion,
		QuizAnswerResult
	} from '$lib/types/quiz';

	import QuestionCard
		from '$lib/components/quiz/QuestionCard.svelte';

	import {
		getGuestPracticeStorageKey
	} from '$lib/quiz/storage';

	import {
		parseGuestPracticeSession
	} from '$lib/quiz/practice-state';

	type PracticeView = {
		currentIndex: number;
		totalQuestions: number;
		coverage: PracticeCoverage;
		shuffleOptions: boolean;
		question: PublicQuizQuestion;
	};

	let {
		data
	}: PageProps = $props();

	let localPractice =
		$state<PracticeView | null>(null);
	let localAnsweredCount =
		$state<number | null>(null);
	let localCorrectCount =
		$state<number | null>(null);
	let guestInitialized =
		$state(false);
	let errorMessage =
		$state<string | null>(null);
	let selectedOptionId =
		$state<string | null>(null);
	let answerResult =
		$state<QuizAnswerResult | null>(null);
	let submitting =
		$state(false);
	let loadingNext =
		$state(false);
	let restarting =
		$state(false);
	let practiceCompleted =
		$state(false);

	let practice =
		$derived(
			localPractice ??
				data.practice
		);
	let question =
		$derived(
			practice?.question ?? null
		);
	let currentIndex =
		$derived(
			practice?.currentIndex ?? 0
		);
	let totalQuestions =
		$derived(
			practice?.totalQuestions ?? 0
		);
	let coverage =
		$derived(
			practice?.coverage ?? 30
		);
	let shuffleOptions =
		$derived(
			practice?.shuffleOptions ?? true
		);
	let answeredCount =
		$derived(
			localAnsweredCount ??
				data.practice?.answeredCount ??
				0
		);
	let correctCount =
		$derived(
			localCorrectCount ??
				data.practice?.correctCount ??
				0
		);
	let incorrectCount =
		$derived(
			Math.max(
				0,
				answeredCount - correctCount
			)
		);
	let unansweredCount =
		$derived(
			Math.max(
				0,
				totalQuestions - answeredCount
			)
		);
	let accuracy =
		$derived(
			answeredCount === 0
				? null
				: correctCount /
					answeredCount *
					100
		);
	let accuracyText =
		$derived(
			accuracy === null
				? '—'
				: Number.isInteger(accuracy)
					? `${accuracy}%`
					: `${accuracy.toFixed(1)}%`
		);
	let progressValue =
		$derived(
			totalQuestions === 0
				? 0
				: answeredCount /
					totalQuestions *
					100
		);
	let loading =
		$derived(
			data.practice === null &&
			!guestInitialized
		);
	let isGuest =
		$derived(
			data.practice === null
		);
	let restartSettingText =
		$derived(
			`${coverage === 100 ? '全部題目' : `${coverage}% 題目`} · 選項${shuffleOptions ? '隨機' : '固定'}`
		);

	onMount(async () => {
		if (data.practice) {
			return;
		}

		await loadGuestPractice();
	});

	function getGuestStorageKey(): string {
		return getGuestPracticeStorageKey(
			data.bank.slug
		);
	}

	function readGuestSession():
		GuestPracticeSession | null {
		const raw =
			sessionStorage.getItem(
				getGuestStorageKey()
			);

		if (!raw) {
			return null;
		}

		try {
			return parseGuestPracticeSession(
				JSON.parse(raw)
			);
		} catch {
			return null;
		}
	}

	function writeGuestSession(
		session: GuestPracticeSession
	): void {
		sessionStorage.setItem(
			getGuestStorageKey(),
			JSON.stringify(session)
		);
	}

	async function loadGuestPractice() {
		const session =
			readGuestSession();

		if (!session) {
			setGuestError(
				'找不到進行中的練習，請重新開始。'
			);
			return;
		}

		localAnsweredCount =
			session.answeredCount;
		localCorrectCount =
			session.correctCount;

		if (
			session.questionsState
				.questions.length === 0
		) {
			setGuestError(
				'這份練習沒有可顯示的題目。'
			);
			return;
		}

		try {
			const loaded =
				await loadGuestQuestion(
					session
				);

			if (!loaded) {
				practiceCompleted = true;
			}
		} catch {
			errorMessage =
				'無法載入題目，請重新開始練習。';
		} finally {
			guestInitialized = true;
		}
	}

	async function loadGuestQuestion(
		session: GuestPracticeSession
	): Promise<boolean> {
		for (
			let index = session.currentIndex;
			index <
				session.questionsState
					.questions.length;
			index++
		) {
			const questionState =
				session.questionsState
					.questions[index];

			if (!questionState) {
				continue;
			}

			const response =
				await fetch(
					`/practice/${encodeURIComponent(
						data.bank.slug
					)}/question`,
					{
						method: 'POST',
						headers: {
							'content-type':
								'application/json'
						},
						body:
							JSON.stringify({
								questionId:
									questionState.questionId,
								optionIds:
									questionState.optionIds
							})
					}
				);

			if (response.status === 404) {
				continue;
			}

			if (!response.ok) {
				throw new Error(
					'Failed to load question'
				);
			}

			const result =
				await response.json() as {
					question:
						PublicQuizQuestion;
				};

			const nextSession = {
				...session,
				currentIndex: index
			};

			writeGuestSession(
				nextSession
			);

			localAnsweredCount =
				nextSession.answeredCount;
			localCorrectCount =
				nextSession.correctCount;

			localPractice = {
				currentIndex: index,
				totalQuestions:
					session.questionsState
						.questions.length,
				coverage:
					session.questionsState.coverage,
				shuffleOptions:
					session.questionsState.shuffleOptions,
				question:
					result.question
			};

			return true;
		}

		return false;
	}

	async function submitAnswer(
		optionId: string
	) {
		if (
			submitting ||
			answerResult ||
			!question
		) {
			return;
		}

		selectedOptionId = optionId;
		submitting = true;
		errorMessage = null;

		try {
			const response =
				await fetch(
					`/practice/${encodeURIComponent(
						data.bank.slug
					)}/answer`,
					{
						method: 'POST',
						headers: {
							'content-type':
								'application/json'
						},
						body:
							JSON.stringify({
								questionId:
									question.id,
								selectedOptionId:
									optionId
							})
					}
				);

			if (!response.ok) {
				throw new Error(
					'Failed to submit answer'
				);
			}

			const result =
				await response.json() as
					QuizAnswerResult;

			const nextAnsweredCount =
				answeredCount + 1;
			const nextCorrectCount =
				correctCount +
				(result.correct ? 1 : 0);

			localAnsweredCount =
				nextAnsweredCount;
			localCorrectCount =
				nextCorrectCount;

			if (isGuest) {
				const session =
					readGuestSession();

				if (!session) {
					throw new Error(
						'Guest practice state missing'
					);
				}

				const nextIndex =
					currentIndex + 1;
				const completed =
					nextIndex >=
					session.questionsState
						.questions.length;

				writeGuestSession({
					...session,
					currentIndex:
						nextIndex,
					answeredCount:
						nextAnsweredCount,
					correctCount:
						nextCorrectCount
				});

				answerResult = {
					...result,
					completed
				};
			} else {
				answerResult = result;
			}
		} catch {
			selectedOptionId = null;
			errorMessage =
				'答案送出失敗，請再試一次。';
		} finally {
			submitting = false;
		}
	}

	async function nextQuestion() {
		if (
			!answerResult ||
			answerResult.completed ||
			loadingNext
		) {
			return;
		}

		loadingNext = true;
		errorMessage = null;

		try {
			if (isGuest) {
				const session =
					readGuestSession();

				if (!session) {
					setGuestError(
						'找不到進行中的練習，請重新開始。'
					);
					return;
				}

				const loaded =
					await loadGuestQuestion(
						session
					);

				if (!loaded) {
					practiceCompleted = true;
				}
			} else {
				localPractice = null;
				await invalidateAll();
				localAnsweredCount = null;
				localCorrectCount = null;
			}

			selectedOptionId = null;
			answerResult = null;
		} catch {
			errorMessage =
				'無法載入下一題，請再試一次。';
		} finally {
			loadingNext = false;
		}
	}

	async function restartPractice() {
		if (
			restarting ||
			!practice
		) {
			return;
		}

		restarting = true;
		errorMessage = null;

		try {
			const response = await fetch(
				`/practice/${encodeURIComponent(
					data.bank.slug
				)}/restart`,
				{
					method: 'POST',
					headers: {
						'content-type':
							'application/json'
					},
					body: JSON.stringify({
						coverage,
						shuffleOptions
					})
				}
			);

			if (!response.ok) {
				throw new Error(
					'Failed to restart practice'
				);
			}

			const result = await response.json() as {
				questionsState:
					PracticeQuestionsState;
			};

			selectedOptionId = null;
			answerResult = null;
			practiceCompleted = false;
			localAnsweredCount = 0;
			localCorrectCount = 0;

			if (isGuest) {
				const nextSession: GuestPracticeSession = {
					questionsState:
						result.questionsState,
					currentIndex: 0,
					answeredCount: 0,
					correctCount: 0
				};

				writeGuestSession(
					nextSession
				);

				const loaded =
					await loadGuestQuestion(
						nextSession
					);

				if (!loaded) {
					throw new Error(
						'Restarted practice has no question'
					);
				}
			} else {
				localPractice = null;
				localAnsweredCount = null;
				localCorrectCount = null;
				await invalidateAll();
			}
		} catch {
			errorMessage =
				'無法重新開始練習，請再試一次。';
		} finally {
			restarting = false;
		}
	}

	async function finishPractice() {
		if (isGuest) {
			sessionStorage.removeItem(
				getGuestStorageKey()
			);
		}

		await goto('/');
	}

	function setGuestError(
		message: string
	) {
		errorMessage = message;
		guestInitialized = true;
	}
</script>

<svelte:head>
	<title>{data.bank.name} | 練習</title>
</svelte:head>

<div class="app-page">
	<section class="app-panel overflow-hidden">
		<header
			class="flex flex-col gap-3 border-b border-surface-300-700 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6"
		>
			<div>
				<p class="quiz-eyebrow">PRACTICE MODE</p>
				<h1 class="mt-1 text-2xl font-bold">練習模式</h1>
				{#if question}
					<p class="mt-1 text-sm opacity-60">
						第 {currentIndex + 1} / {totalQuestions} 題 · 作答後立即判分。
					</p>
				{:else}
					<p class="mt-1 text-sm opacity-60">{data.bank.name}</p>
				{/if}
			</div>

			<div class="flex flex-wrap items-center gap-2">
				{#if practice}
					<Dialog role="alertdialog">
						<Dialog.Trigger
							class="btn preset-tonal shrink-0"
							disabled={restarting}
						>
							<RotateCcw size={16} aria-hidden="true" />
							重新開始
						</Dialog.Trigger>

						<Portal>
							<Dialog.Backdrop class="fixed inset-0 z-50 bg-black/60" />
							<Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
								<Dialog.Content class="card w-full max-w-lg bg-surface-50-950 p-6 shadow-xl">
									<Dialog.Title class="text-xl font-bold">重新開始本輪練習？</Dialog.Title>
									<Dialog.Description class="mt-3 text-sm leading-relaxed opacity-70">
										目前作答進度會清除，並以相同設定建立全新一輪：{restartSettingText}。題目會重新隨機抽取，既有錯題不受影響。
									</Dialog.Description>
									<div class="mt-6 flex justify-end gap-3">
										<Dialog.CloseTrigger type="button" class="btn preset-tonal">取消</Dialog.CloseTrigger>
										<Dialog.CloseTrigger
											type="button"
											class="btn preset-filled-primary-500"
											disabled={restarting}
											onclick={restartPractice}
										>
											<RotateCcw size={16} aria-hidden="true" />
											{restarting ? '重新建立中...' : '重新開始'}
										</Dialog.CloseTrigger>
									</div>
								</Dialog.Content>
							</Dialog.Positioner>
						</Portal>
					</Dialog>
				{/if}

				<a
					href="/"
					class="btn preset-tonal shrink-0"
				>
					結束練習
				</a>
			</div>
		</header>

		{#if loading}
			<div class="p-5 md:p-6">
				<section
					class="space-y-4"
					aria-label="正在載入題目"
				>
					<div class="placeholder h-7 w-2/3 animate-pulse" aria-hidden="true"></div>
					<div class="space-y-3" aria-hidden="true">
						<div class="placeholder h-14 animate-pulse"></div>
						<div class="placeholder h-14 animate-pulse"></div>
						<div class="placeholder h-14 animate-pulse"></div>
						<div class="placeholder h-14 animate-pulse"></div>
					</div>
					<span class="sr-only">正在載入題目...</span>
				</section>
			</div>

		{:else if practiceCompleted}
			<div class="p-8 text-center">
				<p class="quiz-eyebrow">ROUND COMPLETE</p>
				<h2 class="mt-2 text-3xl font-bold">練習完成</h2>
				<p class="mt-4 text-4xl font-bold text-success-700-300">
					{accuracyText}
				</p>
				<p class="mt-2 text-sm opacity-60">
					正確 {correctCount} / 已答 {answeredCount}
				</p>
				<button
					type="button"
					class="btn preset-filled-primary-500 mt-6"
					onclick={finishPractice}
				>
					返回首頁
				</button>
			</div>

		{:else if !question}
			<div class="p-8 text-center">
				<h2 class="text-lg font-semibold">無法繼續練習</h2>
				<p class="mt-2 opacity-60">
					{errorMessage ?? '找不到目前題目。'}
				</p>
				<a
					href="/"
					class="btn preset-filled-primary-500 mt-6"
				>
					返回首頁
				</a>
			</div>

		{:else}
			<div
				class="grid gap-5 p-4 md:p-5 lg:grid-cols-[minmax(0,1fr)_18rem]"
			>
				<main class="min-w-0">
					<div class="mb-3 flex items-center justify-between gap-3">
						<p class="quiz-eyebrow">QUESTION {currentIndex + 1}</p>
						<span class="badge preset-tonal-success">單選題</span>
					</div>

					<QuestionCard
						{question}
						{answerResult}
						{selectedOptionId}
						{submitting}
						onSelect={submitAnswer}
					/>

					{#if errorMessage}
						<p
							class="mt-4 text-sm text-error-700-300"
							role="alert"
						>
							{errorMessage}
						</p>
					{/if}
				</main>

				<aside>
					<section class="quiz-side-panel lg:sticky lg:top-14">
						<div class="flex items-center justify-between gap-3">
							<h2 class="font-bold">本輪進度</h2>
							<strong>{Math.round(progressValue)}%</strong>
						</div>

						<Progress
							value={progressValue}
							class="mt-3"
							aria-label="練習進度"
						>
							<Progress.Track class="h-2 bg-surface-400-600">
								<Progress.Range class="bg-primary-500" />
							</Progress.Track>
						</Progress>

						<div class="mt-4 grid grid-cols-3 gap-2">
							<div class="quiz-stat-tile border-success-500/50">
								<p class="text-xs font-semibold text-success-700-300">正確</p>
								<p class="mt-1 text-xl font-bold text-success-700-300">{correctCount}</p>
							</div>
							<div class="quiz-stat-tile border-error-500/50">
								<p class="text-xs font-semibold text-error-700-300">錯誤</p>
								<p class="mt-1 text-xl font-bold text-error-700-300">{incorrectCount}</p>
							</div>
							<div class="quiz-stat-tile">
								<p class="text-xs font-semibold">未作答</p>
								<p class="mt-1 text-xl font-bold">{unansweredCount}</p>
							</div>
						</div>

						<div class="mt-4 flex items-center justify-between border-t border-surface-400-600 pt-4">
							<span class="font-semibold">正確率</span>
							<strong
								class:text-success-700-300={answeredCount > 0}
							>
								{accuracyText}
								<span class="ml-1 text-xs font-normal opacity-60">
									({correctCount}/{answeredCount})
								</span>
							</strong>
						</div>

						<p class="mt-5 text-sm leading-relaxed opacity-65">
							選項順序會依本輪設定固定；作答後顯示正解與下一題按鈕。
						</p>

						<div class="mt-6 text-center">
							{#if answerResult}
								{#if answerResult.completed}
									<button
										type="button"
										class="btn preset-filled-primary-500 w-full"
										onclick={finishPractice}
									>
										完成練習
									</button>
								{:else}
									<button
										type="button"
										class="btn preset-filled-primary-500 w-full"
										disabled={loadingNext}
										onclick={nextQuestion}
									>
										{loadingNext ? '載入中...' : '下一題'}
									</button>
								{/if}
							{:else}
								<span class="text-sm font-semibold opacity-50">請先選擇答案</span>
							{/if}
						</div>
					</section>
				</aside>
			</div>
		{/if}
	</section>
</div>
