<script lang="ts">
	import {
		goto
	} from '$app/navigation';

	import {
		Dialog,
		Portal
	} from '@skeletonlabs/skeleton-svelte';

	import {
		onMount
	} from 'svelte';

	import type {
		PageProps
	} from './$types';

	import type {
		ExamResult,
		ExamSession,
		PublicQuizQuestion,
		QuizAnswerResult
	} from '$lib/types/quiz';

	import ExamQuestionNavigator
		from '$lib/components/quiz/ExamQuestionNavigator.svelte';

	import QuestionCard
		from '$lib/components/quiz/QuestionCard.svelte';

	import {
		parseExamSession
	} from '$lib/quiz/exam-state';

	import {
		getExamStorageKey
	} from '$lib/quiz/storage';

	let {
		data
	}: PageProps = $props();

	let session =
		$state<ExamSession | null>(null);
	let initialized = $state(false);
	let starting = $state(false);
	let submitting = $state(false);
	let reviewMode = $state(false);
	let showSubmitConfirm = $state(false);
	let showQuestionGrid = $state(false);
	let errorMessage =
		$state<string | null>(null);
	let now = $state(Date.now());

	let question = $derived(
		session?.questions[
			session.currentIndex
		] ?? null
	);
	let selectedOptionId = $derived(
		question && session
			? session.answers[
				question.id
			] ?? null
			: null
	);
	let answeredCount = $derived(
		session
			? Object.values(
				session.answers
			).filter(
				(optionId) =>
					optionId !== null
			).length
			: 0
	);
	let totalQuestions = $derived(
		session?.questions.length ??
			data.bank.questionCount
	);
	let unansweredCount = $derived(
		Math.max(
			0,
			totalQuestions - answeredCount
		)
	);
	let elapsedSeconds = $derived(
		session
			? session.result
				? session.result.elapsedSeconds
				: Math.max(
					0,
					Math.floor(
						(now - session.startedAt) /
							1000
					)
				)
			: 0
	);

	onMount(() => {
		const raw =
			sessionStorage.getItem(
				getStorageKey()
			);

		if (raw) {
			try {
				const parsed =
					parseExamSession(
						JSON.parse(raw)
					);

				if (parsed) {
					session = parsed;
				} else {
					sessionStorage.removeItem(
						getStorageKey()
					);
				}
			} catch {
				sessionStorage.removeItem(
					getStorageKey()
				);
			}
		}

		initialized = true;

		const timer =
			window.setInterval(
				() => {
					now = Date.now();
				},
				1000
			);

		return () => {
			window.clearInterval(timer);
		};
	});

	function getStorageKey(): string {
		return getExamStorageKey(
			data.bank.slug
		);
	}

	function saveSession(
		next: ExamSession
	): void {
		session = next;
		sessionStorage.setItem(
			getStorageKey(),
			JSON.stringify(next)
		);
	}

	function formatDuration(
		seconds: number
	): string {
		const hours =
			Math.floor(seconds / 3600);
		const minutes =
			Math.floor(
				(seconds % 3600) / 60
			);
		const remainingSeconds =
			seconds % 60;

		return [
			hours,
			minutes,
			remainingSeconds
		]
			.map(
				(value) =>
					String(value)
						.padStart(2, '0')
			)
			.join(':');
	}

	async function startExam() {
		if (starting) {
			return;
		}

		starting = true;
		errorMessage = null;

		try {
			const response =
				await fetch(
					`/exam/${encodeURIComponent(
						data.bank.slug
					)}/start`,
					{
						method: 'POST'
					}
				);

			if (!response.ok) {
				throw new Error(
					'Failed to start exam'
				);
			}

			const payload =
				await response.json() as {
					questions:
						PublicQuizQuestion[];
				};
			const answers =
				Object.fromEntries(
					payload.questions.map(
						(item) => [
							item.id,
							null
						]
					)
				);
			const startedAt = Date.now();

			now = startedAt;
			saveSession({
				version: 1,
				startedAt,
				currentIndex: 0,
				questions:
					payload.questions,
				answers,
				result: null
			});
		} catch {
			errorMessage =
				'無法開始考試，請稍後再試。';
		} finally {
			starting = false;
		}
	}

	function selectOption(
		optionId: string
	): void {
		if (
			!session ||
			!question ||
			session.result ||
			reviewMode
		) {
			return;
		}

		saveSession({
			...session,
			answers: {
				...session.answers,
				[question.id]: optionId
			}
		});
	}

	function goToQuestion(
		index: number
	): void {
		if (
			!session ||
			index < 0 ||
			index >= session.questions.length
		) {
			return;
		}

		if (session.result) {
			session = {
				...session,
				currentIndex: index
			};
		} else {
			saveSession({
				...session,
				currentIndex: index
			});
		}

		showQuestionGrid = false;
	}

	function previousQuestion(): void {
		if (session) {
			goToQuestion(
				session.currentIndex - 1
			);
		}
	}

	function nextQuestion(): void {
		if (session) {
			goToQuestion(
				session.currentIndex + 1
			);
		}
	}

	async function submitExam() {
		if (
			!session ||
			session.result ||
			submitting
		) {
			return;
		}

		submitting = true;
		errorMessage = null;

		try {
			const response =
				await fetch(
					`/exam/${encodeURIComponent(
						data.bank.slug
					)}/submit`,
					{
						method: 'POST',
						headers: {
							'content-type':
								'application/json'
						},
						body: JSON.stringify({
							answers:
								session.answers,
							startedAt:
								session.startedAt
						})
					}
				);

			if (!response.ok) {
				throw new Error(
					'Failed to submit exam'
				);
			}

			const payload =
				await response.json() as {
					result: ExamResult;
				};

			session = {
				...session,
				result: payload.result
			};
			sessionStorage.removeItem(
				getStorageKey()
			);
			showSubmitConfirm = false;
			reviewMode = false;
		} catch {
			errorMessage =
				'交卷失敗，請再試一次。';
		} finally {
			submitting = false;
		}
	}

	function getReviewAnswerResult():
		QuizAnswerResult | null {
		if (
			!reviewMode ||
			!session?.result ||
			!question
		) {
			return null;
		}

		const result =
			session.result.questions.find(
				(item) =>
					item.questionId === question.id
			);

		if (!result) {
			return null;
		}

		return {
			selectedOptionId:
				result.selectedOptionId,
			correct: result.correct,
			correctOptionIds:
				result.correctOptionIds,
			explanation: result.explanation,
			completed: false
		};
	}

	function getQuestionButtonClass(
		index: number
	): string {
		if (!session) {
			return 'btn preset-tonal min-w-10 justify-center';
		}

		if (index === session.currentIndex) {
			return 'btn preset-filled-primary-500 min-w-10 justify-center';
		}

		const item = session.questions[index];

		if (!item) {
			return 'btn preset-tonal min-w-10 justify-center';
		}

		if (reviewMode && session.result) {
			const result =
				session.result.questions.find(
					(entry) =>
						entry.questionId === item.id
				);

			return result?.correct
				? 'btn preset-tonal-success min-w-10 justify-center'
				: 'btn preset-tonal-error min-w-10 justify-center';
		}

		return session.answers[item.id]
			? 'btn preset-tonal-primary min-w-10 justify-center'
			: 'btn preset-tonal min-w-10 justify-center';
	}

	function viewAnswers(): void {
		if (!session?.result) {
			return;
		}

		reviewMode = true;
		goToQuestion(0);
	}

	function backToResult(): void {
		reviewMode = false;
		showQuestionGrid = false;
	}

	async function restartExam() {
		sessionStorage.removeItem(
			getStorageKey()
		);
		session = null;
		reviewMode = false;
		errorMessage = null;
		await startExam();
	}

	async function backHome() {
		await goto('/');
	}
</script>

<svelte:head>
	<title>{data.bank.name} | 考試練習</title>
</svelte:head>

{#if !initialized}
	<div class="app-page max-w-3xl">
		<section class="app-panel p-8 text-center">
			<p class="opacity-60">
				正在載入考試狀態...
			</p>
		</section>
	</div>
{:else if !session}
	<div class="app-page max-w-3xl">
		<section class="app-panel p-6 md:p-8">
			<p class="quiz-eyebrow">EXAM MODE</p>
			<h1 class="mt-1 text-3xl font-bold">
				{data.bank.name}
			</h1>

			<h2 class="mt-8 text-xl font-semibold">
				準備開始考試？
			</h2>

			<div class="mt-5 grid gap-3 sm:grid-cols-2">
				<div class="quiz-stat-tile text-left">
					<p class="text-sm opacity-60">題目數量</p>
					<p class="mt-1 font-semibold">全部 {data.bank.questionCount} 題</p>
				</div>
				<div class="quiz-stat-tile text-left">
					<p class="text-sm opacity-60">計時方式</p>
					<p class="mt-1 font-semibold">正數計時</p>
				</div>
				<div class="quiz-stat-tile text-left">
					<p class="text-sm opacity-60">題目與選項</p>
					<p class="mt-1 font-semibold">全部隨機排列</p>
				</div>
				<div class="quiz-stat-tile text-left">
					<p class="text-sm opacity-60">答案公布</p>
					<p class="mt-1 font-semibold">交卷後顯示</p>
				</div>
			</div>

			<p class="mt-5 text-sm opacity-60">
				開始後會啟動計時；作答期間可自由切換題目與修改答案。
			</p>

			{#if errorMessage}
				<p
					class="mt-4 text-sm text-error-700-300"
					role="alert"
				>
					{errorMessage}
				</p>
			{/if}

			<div class="mt-8 flex flex-wrap justify-end gap-3">
				<a href="/" class="btn preset-tonal">取消</a>
				<button
					type="button"
					class="btn preset-filled-primary-500"
					disabled={
					starting ||
					data.bank.questionCount === 0
				}
					onclick={startExam}
				>
					{starting ? '準備中...' : '開始考試'}
				</button>
			</div>
		</section>
	</div>
{:else if session.result && !reviewMode}
	<div class="app-page max-w-4xl">
		<section class="app-panel p-6 md:p-8">
			<p class="quiz-eyebrow">{data.bank.name}</p>
			<h1 class="mt-1 text-3xl font-bold">考試結果</h1>

			<div class="mt-8 text-center">
				<p class="text-5xl font-bold">
					{session.result.correctCount} / {session.result.totalQuestions}
				</p>
				<p class="mt-3 text-xl font-semibold">
					正確率 {session.result.accuracy.toFixed(1)}%
				</p>
				<p class="mt-2 opacity-60">
					作答時間 {formatDuration(session.result.elapsedSeconds)}
				</p>
			</div>

			<div class="mt-8 grid gap-4 sm:grid-cols-4">
				<div class="quiz-stat-tile">
					<p class="text-sm opacity-60">正確</p>
					<p class="mt-1 text-2xl font-bold text-success-700-300">
						{session.result.correctCount}
					</p>
				</div>
				<div class="quiz-stat-tile">
					<p class="text-sm opacity-60">錯誤</p>
					<p class="mt-1 text-2xl font-bold text-error-700-300">
						{session.result.incorrectCount}
					</p>
				</div>
				<div class="quiz-stat-tile">
					<p class="text-sm opacity-60">已答</p>
					<p class="mt-1 text-2xl font-bold">
						{session.result.answeredCount}
					</p>
				</div>
				<div class="quiz-stat-tile">
					<p class="text-sm opacity-60">未答</p>
					<p class="mt-1 text-2xl font-bold">
						{session.result.unansweredCount}
					</p>
				</div>
			</div>

			<div class="mt-8 flex flex-wrap justify-center gap-3">
				<button
					type="button"
					class="btn preset-filled-primary-500"
					onclick={viewAnswers}
				>
					查看答案
				</button>
				<button
					type="button"
					class="btn preset-tonal"
					onclick={restartExam}
				>
					再考一次
				</button>
				<button
					type="button"
					class="btn preset-tonal"
					onclick={backHome}
				>
					返回首頁
				</button>
			</div>
		</section>
	</div>
{:else}
	<div class="app-page">
		<section class="app-panel overflow-hidden">
			<header
				class="flex flex-wrap items-center justify-between gap-4 border-b border-surface-300-700 px-5 py-4 md:px-6"
			>
				<div>
					<p class="quiz-eyebrow">
						{reviewMode ? 'ANSWER REVIEW' : 'EXAM MODE'}
					</p>
					<h1 class="mt-1 text-2xl font-bold">
						{data.bank.name}
					</h1>
				</div>

				<div class="flex items-center gap-3">
					<div class="font-mono text-lg font-semibold tabular-nums">
						{formatDuration(elapsedSeconds)}
					</div>

					{#if reviewMode}
						<button
							type="button"
							class="btn preset-tonal"
							onclick={backToResult}
						>
							返回成績
						</button>
					{:else}
						<button
							type="button"
							class="btn preset-filled-primary-500"
							onclick={() => {
								showSubmitConfirm = true;
							}}
						>
							交卷
						</button>
					{/if}
				</div>
			</header>

			<div
				class="grid gap-5 p-4 md:p-5 lg:grid-cols-[minmax(0,1fr)_18rem]"
			>
				<main class="min-w-0">
					<div class="mb-3 flex items-center justify-between gap-3">
						<p class="quiz-eyebrow">
							QUESTION {session.currentIndex + 1}
						</p>
						<strong class="text-sm">
							{session.currentIndex + 1} / {session.questions.length}
						</strong>
					</div>

					{#if question}
						<QuestionCard
							{question}
							{selectedOptionId}
							answerResult={
								reviewMode
									? getReviewAnswerResult()
									: null
							}
							onSelect={selectOption}
						/>
					{/if}

					{#if errorMessage}
						<p
							class="mt-4 text-sm text-error-700-300"
							role="alert"
						>
							{errorMessage}
						</p>
					{/if}

					<div class="mt-5 flex items-center justify-between gap-3">
						<button
							type="button"
							class="btn preset-tonal"
							disabled={session.currentIndex === 0}
							onclick={previousQuestion}
						>
							上一題
						</button>

						<button
							type="button"
							class="btn preset-tonal lg:hidden"
							onclick={() => {
								showQuestionGrid = true;
							}}
						>
							題號
						</button>

						<button
							type="button"
							class="btn preset-filled-primary-500"
							disabled={
								session.currentIndex >=
									session.questions.length - 1
							}
							onclick={nextQuestion}
						>
							下一題
						</button>
					</div>
				</main>

				<aside class="hidden lg:block">
					<section class="quiz-side-panel sticky top-14">
						<ExamQuestionNavigator
							{session}
							{reviewMode}
							onSelect={goToQuestion}
							getButtonClass={getQuestionButtonClass}
						/>
					</section>
				</aside>
			</div>
		</section>
	</div>
{/if}

<Dialog
	role="alertdialog"
	open={
		showSubmitConfirm &&
		Boolean(session) &&
		!session?.result
	}
	onOpenChange={(details) => {
		showSubmitConfirm = details.open;
	}}
>
	<Portal>
		<Dialog.Backdrop
			class="fixed inset-0 z-50 bg-black/60"
		/>
		<Dialog.Positioner
			class="fixed inset-0 z-50 flex items-center justify-center p-4"
		>
			<Dialog.Content
				class="card w-full max-w-md bg-surface-50-950 p-6 shadow-xl"
			>
				<Dialog.Title class="text-xl font-bold">
					確認交卷？
				</Dialog.Title>

				<div class="mt-5 grid grid-cols-2 gap-4">
					<div class="quiz-stat-tile">
						<p class="text-sm opacity-60">已答</p>
						<p class="mt-1 text-2xl font-bold">
							{answeredCount}
						</p>
					</div>
					<div class="quiz-stat-tile">
						<p class="text-sm opacity-60">未答</p>
						<p
							class="mt-1 text-2xl font-bold"
							class:text-error-700-300={
								unansweredCount > 0
							}
						>
							{unansweredCount}
						</p>
					</div>
				</div>

				{#if unansweredCount > 0}
					<Dialog.Description
						class="mt-4 text-sm text-error-700-300"
					>
						未作答題目在交卷後會視為答錯。
					</Dialog.Description>
				{/if}

				<div class="mt-6 flex justify-end gap-3">
					<Dialog.CloseTrigger
						type="button"
						class="btn preset-tonal"
						disabled={submitting}
					>
						繼續作答
					</Dialog.CloseTrigger>
					<button
						type="button"
						class="btn preset-filled-primary-500"
						disabled={submitting}
						onclick={submitExam}
					>
						{submitting ? '交卷中...' : '確認交卷'}
					</button>
				</div>
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog>

<Dialog
	open={showQuestionGrid && Boolean(session)}
	onOpenChange={(details) => {
		showQuestionGrid = details.open;
	}}
>
	<Portal>
		<Dialog.Backdrop
			class="fixed inset-0 z-50 bg-black/60 lg:hidden"
		/>
		<Dialog.Positioner
			class="fixed inset-0 z-50 flex items-end p-4 lg:hidden"
		>
			<Dialog.Content
				class="card max-h-[85vh] w-full overflow-y-auto bg-surface-50-950 p-5 shadow-xl"
			>
				<div class="mb-4 flex items-center justify-between gap-3">
					<Dialog.Title class="text-lg font-bold">
						題號
					</Dialog.Title>
					<Dialog.CloseTrigger
						type="button"
						class="btn preset-tonal"
					>
						關閉
					</Dialog.CloseTrigger>
				</div>

				{#if session}
					<ExamQuestionNavigator
						{session}
						{reviewMode}
						compact
						onSelect={goToQuestion}
						getButtonClass={getQuestionButtonClass}
					/>
				{/if}
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog>
