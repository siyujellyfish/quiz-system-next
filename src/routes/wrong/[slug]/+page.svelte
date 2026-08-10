<script lang="ts">
	import {
		goto
	} from '$app/navigation';

	import type {
		PageProps
	} from './$types';

	import type {
		PublicQuizQuestion,
		WrongAnswerResult
	} from '$lib/types/quiz';

	import QuestionCard
		from '$lib/components/quiz/QuestionCard.svelte';

	type WrongView = {
		remainingCount: number;
		question: PublicQuizQuestion | null;
	};

	let {
		data
	}: PageProps = $props();

	let localWrong =
		$state<WrongView | null>(null);
	let selectedOptionId =
		$state<string | null>(null);
	let answerResult =
		$state<WrongAnswerResult | null>(null);
	let submitting =
		$state(false);
	let loadingNext =
		$state(false);
	let errorMessage =
		$state<string | null>(null);
	let completed =
		$state(false);

	let wrong =
		$derived(
			localWrong ?? data.wrong
		);
	let question =
		$derived(wrong.question);
	let remainingCount =
		$derived(wrong.remainingCount);

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
					`/wrong/${encodeURIComponent(
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
					WrongAnswerResult;

			answerResult = result;
			localWrong = {
				remainingCount:
					result.remainingCount,
				question
			};
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
			loadingNext ||
			!question
		) {
			return;
		}

		loadingNext = true;
		errorMessage = null;

		try {
			const response =
				await fetch(
					`/wrong/${encodeURIComponent(
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
								excludeQuestionId:
									question.id
							})
					}
				);

			if (!response.ok) {
				throw new Error(
					'Failed to load next question'
				);
			}

			const next =
				await response.json() as
					WrongView;

			localWrong = next;
			selectedOptionId = null;
			answerResult = null;

			if (!next.question) {
				completed = true;
			}
		} catch {
			errorMessage =
				'無法載入下一題，請再試一次。';
		} finally {
			loadingNext = false;
		}
	}

	function completeReview() {
		completed = true;
	}

	async function backHome() {
		await goto('/');
	}
</script>

<svelte:head>
	<title>{data.bank.name} | 錯題複習</title>
</svelte:head>

<div class="app-page">
	<section class="app-panel overflow-hidden">
		<header
			class="flex flex-col gap-3 border-b border-surface-300-700 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6"
		>
			<div>
				<p class="quiz-eyebrow">WRONG ANSWER REVIEW</p>
				<h1 class="mt-1 text-2xl font-bold">錯題模式</h1>
				<p class="mt-1 text-sm opacity-60">
					{data.bank.name} · 答對後會立即從錯題集合移除。
				</p>
			</div>

			<a
				href="/"
				class="btn preset-tonal shrink-0"
			>
				結束複習
			</a>
		</header>

		{#if
			completed ||
			(
				remainingCount === 0 &&
				!question
			)
		}
			<div class="p-8 text-center">
				<p class="quiz-eyebrow">REVIEW COMPLETE</p>
				<h2 class="mt-2 text-3xl font-bold">錯題已全部完成</h2>
				<p class="mt-2 opacity-60">目前沒有待複習的錯題。</p>
				<button
					type="button"
					class="btn preset-filled-primary-500 mt-6"
					onclick={backHome}
				>
					返回首頁
				</button>
			</div>

		{:else if !question}
			<div class="p-8 text-center">
				<h2 class="text-lg font-semibold">無法載入錯題</h2>
				<p class="mt-2 opacity-60">請返回首頁後再試一次。</p>
			</div>

		{:else}
			<div
				class="grid gap-5 p-4 md:p-5 lg:grid-cols-[minmax(0,1fr)_18rem]"
			>
				<main class="min-w-0">
					<div class="mb-3 flex items-center justify-between gap-3">
						<p class="quiz-eyebrow">WRONG QUESTION</p>
						<span class="badge preset-tonal-error">錯題複習</span>
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
						<h2 class="font-bold">錯題進度</h2>

						<div class="mt-4 quiz-stat-tile border-error-500/50">
							<p class="text-sm font-semibold text-error-700-300">剩餘錯題</p>
							<p class="mt-1 text-4xl font-bold text-error-700-300">
								{remainingCount}
							</p>
						</div>

						{#if answerResult}
							<div
								class="mt-4 rounded-container border p-3 text-center"
								class:border-success-500={answerResult.correct}
								class:border-error-500={!answerResult.correct}
							>
								<p
									class="font-bold"
									class:text-success-700-300={answerResult.correct}
									class:text-error-700-300={!answerResult.correct}
								>
									{answerResult.correct
										? '本題已移除錯題集合'
										: '本題仍保留在錯題集合'}
								</p>
							</div>
						{/if}

						<p class="mt-5 text-sm leading-relaxed opacity-65">
							答錯不會改變錯題數；只有真正答對後才會移除。
						</p>

						<div class="mt-6 text-center">
							{#if answerResult}
								{#if answerResult.completed}
									<button
										type="button"
										class="btn preset-filled-primary-500 w-full"
										onclick={completeReview}
									>
										完成複習
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
