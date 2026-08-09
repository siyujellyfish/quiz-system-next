<script lang="ts">
	import {
		onMount
	} from 'svelte';


	import type {
		PageProps
	} from './$types';


	import type {
		PracticeQuestionsState,
		PublicQuizQuestion
	} from '$lib/types/quiz';


	import QuestionCard
		from '$lib/components/quiz/QuestionCard.svelte';


	import {
		getGuestPracticeStorageKey
	} from '$lib/quiz/storage';


	import {
		isPracticeQuestionsState
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


	let guestInitialized =
		$state(false);


	let errorMessage =
		$state<string | null>(
			null
		);


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


	let loading =
		$derived(
			data.practice === null &&
			!guestInitialized
		);


	onMount(async () => {
		if (data.practice) {
			return;
		}

		await loadGuestPractice();
	});


	async function loadGuestPractice() {
		const key =
			getGuestPracticeStorageKey(
				data.bank.slug
			);

		const raw =
			sessionStorage.getItem(
				key
			);

		if (!raw) {
			setGuestError(
				'找不到進行中的練習，請重新開始。'
			);

			return;
		}

		let parsed: unknown;

		try {
			parsed =
				JSON.parse(raw);
		} catch {
			setGuestError(
				'練習資料格式錯誤，請重新開始。'
			);

			return;
		}

		if (
			!isPracticeQuestionsState(
				parsed
			)
		) {
			setGuestError(
				'練習資料已失效，請重新開始。'
			);

			return;
		}

		const state:
			PracticeQuestionsState =
				parsed;

		if (
			state.questions.length ===
			0
		) {
			setGuestError(
				'這份練習沒有可顯示的題目。'
			);

			return;
		}

		try {
			for (
				let index = 0;
				index < state.questions.length;
				index++
			) {
				const questionState =
					state.questions[index];

				if (!questionState) {
					continue;
				}

				const response =
					await fetch(
						`/practice/${encodeURIComponent(
							data.bank.slug
						)}/question`,
						{
							method:
								'POST',

							headers: {
								'content-type':
									'application/json'
							},

							body:
								JSON.stringify({
									questionId:
										questionState
											.questionId,

									optionIds:
										questionState
											.optionIds
								})
						}
					);

				if (
					response.status === 404
				) {
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

				localPractice = {
					currentIndex:
						index,
					totalQuestions:
						state.questions.length,
					question:
						result.question
				};

				return;
			}

			setGuestError(
				'這份練習的題目已全部失效，請重新開始。'
			);
		} catch {
			errorMessage =
				'無法載入題目，請重新開始練習。';
		} finally {
			guestInitialized =
				true;
		}
	}


	function setGuestError(
		message: string
	) {
		errorMessage =
			message;

		guestInitialized =
			true;
	}
</script>


<svelte:head>
	<title>
		{data.bank.name} | 練習
	</title>
</svelte:head>


<div
	class="
		mx-auto
		w-full
		max-w-3xl
		p-4
		md:p-6
	"
>
	<header
		class="
			mb-6
			flex
			items-start
			justify-between
			gap-4
		"
	>
		<div>
			<p
				class="
					text-sm
					opacity-60
				"
			>
				練習模式
			</p>

			<h1
				class="
					mt-1
					text-2xl
					font-bold
				"
			>
				{data.bank.name}
			</h1>
		</div>

		<a
			href="/"
			class="
				btn
				preset-tonal
			"
		>
			結束練習
		</a>
	</header>


	{#if loading}
		<section
			class="
				card
				preset-outlined
				p-8
				text-center
			"
		>
			<p class="opacity-60">
				正在載入題目...
			</p>
		</section>

	{:else if errorMessage}
		<section
			class="
				card
				preset-outlined
				p-8
				text-center
			"
		>
			<h2
				class="
					text-lg
					font-semibold
				"
			>
				無法繼續練習
			</h2>

			<p
				class="
					mt-2
					opacity-60
				"
			>
				{errorMessage}
			</p>

			<a
				href="/"
				class="
					btn
					preset-filled-primary-500
					mt-6
				"
			>
				返回首頁
			</a>
		</section>

	{:else if question}
		<div
			class="
				mb-4
				flex
				items-center
				justify-between
				text-sm
			"
		>
			<span class="opacity-60">
				題目
			</span>

			<strong>
				{currentIndex + 1}
				/
				{totalQuestions}
			</strong>
		</div>


		<div
			class="
				mb-6
				h-2
				overflow-hidden
				rounded-full
				bg-surface-200-800
			"
		>
			<div
				class="
					h-full
					bg-primary-500
					transition-[width]
				"
				style:width={`${(
					(
						currentIndex +
						1
					) /
					totalQuestions
				) * 100}%`}
			></div>
		</div>


		<QuestionCard
			{question}
		/>
	{/if}
</div>
