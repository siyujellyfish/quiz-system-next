<script lang="ts">
	import {
		goto,
		invalidateAll
	} from '$app/navigation';

	import { Progress } from '@skeletonlabs/skeleton-svelte';
	import {
		onMount
	} from 'svelte';


	import type {
		PageProps
	} from './$types';


	import type {
		GuestPracticeSession,
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
		question: PublicQuizQuestion;
	};


	let {
		data
	}: PageProps = $props();


	let localPractice =
		$state<PracticeView | null>(
			null
		);

	let localAnsweredCount =
		$state<number | null>(
			null
		);

	let localCorrectCount =
		$state<number | null>(
			null
		);

	let guestInitialized =
		$state(false);

	let errorMessage =
		$state<string | null>(
			null
		);

	let selectedOptionId =
		$state<string | null>(
			null
		);

	let answerResult =
		$state<QuizAnswerResult | null>(
			null
		);

	let submitting =
		$state(false);

	let loadingNext =
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
			practice?.question ??
				null
		);

	let currentIndex =
		$derived(
			practice?.currentIndex ??
				0
		);

	let totalQuestions =
		$derived(
			practice?.totalQuestions ??
				0
		);

	let answeredCount =
		$derived(
			localAnsweredCount ??
				data.practice
					?.answeredCount ??
				0
		);

	let correctCount =
		$derived(
			localCorrectCount ??
				data.practice
					?.correctCount ??
				0
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
				: Number.isInteger(
					accuracy
				)
					? `${accuracy}%`
					: `${accuracy.toFixed(1)}%`
		);

	let progressValue =
		$derived(
			totalQuestions === 0
				? 0
				: (currentIndex + 1) /
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
	<title>
		{data.bank.name} | 練習
	</title>
</svelte:head>


<div
	class="mx-auto w-full max-w-3xl p-4 md:p-6"
>
	<header
		class="mb-6 flex items-start justify-between gap-4"
	>
		<div>
			<p class="text-sm opacity-60">
				練習模式
			</p>

			<h1 class="mt-1 text-2xl font-bold">
				{data.bank.name}
			</h1>
		</div>

		<a
			href="/"
			class="btn preset-tonal"
		>
			結束練習
		</a>
	</header>


	{#if loading}
		<section
			class="card preset-outlined space-y-4 p-6"
			aria-label="正在載入題目"
		>
			<div
				class="placeholder h-7 w-2/3 animate-pulse"
				aria-hidden="true"
			></div>
			<div class="space-y-3" aria-hidden="true">
				<div class="placeholder h-14 animate-pulse"></div>
				<div class="placeholder h-14 animate-pulse"></div>
				<div class="placeholder h-14 animate-pulse"></div>
				<div class="placeholder h-14 animate-pulse"></div>
			</div>
			<span class="sr-only">正在載入題目...</span>
		</section>

	{:else if practiceCompleted}
		<section
			class="card preset-outlined p-8 text-center"
		>
			<h2 class="text-2xl font-bold">
				練習完成
			</h2>

			<p class="mt-3 text-lg font-semibold">
				正確率 {accuracyText}
			</p>

			<p class="mt-1 text-sm opacity-60">
				正確 {correctCount} / 已答 {answeredCount}
			</p>

			<button
				type="button"
				class="btn preset-filled-primary-500 mt-6"
				onclick={finishPractice}
			>
				返回首頁
			</button>
		</section>

	{:else if !question}
		<section
			class="card preset-outlined p-8 text-center"
		>
			<h2 class="text-lg font-semibold">
				無法繼續練習
			</h2>

			<p class="mt-2 opacity-60">
				{errorMessage ?? '找不到目前題目。'}
			</p>

			<a
				href="/"
				class="btn preset-filled-primary-500 mt-6"
			>
				返回首頁
			</a>
		</section>

	{:else}
		<div
			class="mb-4 flex items-end justify-between gap-4 text-sm"
		>
			<div>
				<span class="opacity-60">
					題目
				</span>

				<strong class="ml-2">
					{currentIndex + 1}
					/
					{totalQuestions}
				</strong>
			</div>

			<div class="text-right">
				<span class="opacity-60">
					即時正確率
				</span>

				<strong
					class="ml-2"
					class:text-success-700-300={
						answeredCount > 0
					}
				>
					{accuracyText}
				</strong>

				<span class="ml-2 opacity-60">
					{correctCount} / {answeredCount}
				</span>
			</div>
		</div>


		<Progress
			value={progressValue}
			class="mb-6"
			aria-label="練習進度"
		>
			<Progress.Track class="h-2 bg-surface-200-800">
				<Progress.Range class="bg-primary-500" />
			</Progress.Track>
		</Progress>


		<QuestionCard
			{question}
			{answerResult}
			{selectedOptionId}
			{submitting}
			onSelect={submitAnswer}
		/>


		{#if answerResult}
			<div class="mt-5 flex justify-end">
				{#if answerResult.completed}
					<button
						type="button"
						class="btn preset-filled-primary-500"
						onclick={finishPractice}
					>
						完成練習
					</button>
				{:else}
					<button
						type="button"
						class="btn preset-filled-primary-500"
						disabled={loadingNext}
						onclick={nextQuestion}
					>
						{loadingNext
							? '載入中...'
							: '下一題'}
					</button>
				{/if}
			</div>
		{:else if errorMessage}
			<p
				class="mt-4 text-sm text-error-700-300"
				role="alert"
			>
				{errorMessage}
			</p>
		{/if}
	{/if}
</div>
