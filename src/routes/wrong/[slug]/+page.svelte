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
		$state<WrongView | null>(
			null
		);

	let selectedOptionId =
		$state<string | null>(
			null
		);

	let answerResult =
		$state<WrongAnswerResult | null>(
			null
		);

	let submitting =
		$state(false);

	let loadingNext =
		$state(false);

	let errorMessage =
		$state<string | null>(
			null
		);

	let completed =
		$state(false);


	let wrong =
		$derived(
			localWrong ??
				data.wrong
		);

	let question =
		$derived(
			wrong.question
		);

	let remainingCount =
		$derived(
			wrong.remainingCount
		);


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
	<title>
		{data.bank.name} | 錯題複習
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
				錯題模式
			</p>

			<h1 class="mt-1 text-2xl font-bold">
				{data.bank.name}
			</h1>
		</div>

		<a
			href="/"
			class="btn preset-tonal"
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
		<section
			class="card preset-outlined p-8 text-center"
		>
			<h2 class="text-2xl font-bold">
				錯題已全部完成
			</h2>

			<p class="mt-2 opacity-60">
				目前沒有待複習的錯題。
			</p>

			<button
				type="button"
				class="btn preset-filled-primary-500 mt-6"
				onclick={backHome}
			>
				返回首頁
			</button>
		</section>

	{:else if !question}
		<section
			class="card preset-outlined p-8 text-center"
		>
			<h2 class="text-lg font-semibold">
				無法載入錯題
			</h2>

			<p class="mt-2 opacity-60">
				請返回首頁後再試一次。
			</p>
		</section>

	{:else}
		<div
			class="mb-5 flex items-center justify-between gap-4"
		>
			<div>
				<span class="text-sm opacity-60">
					剩餘錯題
				</span>

				<strong
					class="ml-2 text-lg"
				>
					{remainingCount}
				</strong>
			</div>

			<span
				class="badge preset-tonal-error"
			>
				錯題複習
			</span>
		</div>


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
						onclick={completeReview}
					>
						完成複習
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
