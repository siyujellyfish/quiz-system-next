<script lang="ts">
	import type {
		PublicQuizQuestion,
		QuizAnswerResult
	} from '$lib/types/quiz';


	type Props = {
		question: PublicQuizQuestion;
		answerResult?: QuizAnswerResult | null;
		selectedOptionId?: string | null;
		submitting?: boolean;
		onSelect?: (
			optionId: string
		) => void;
	};


	let {
		question,
		answerResult = null,
		selectedOptionId = null,
		submitting = false,
		onSelect = () => {}
	}: Props = $props();


	let disabled =
		$derived(
			submitting ||
			answerResult !== null
		);


	function getOptionLabel(
		index: number
	): string {
		return String.fromCharCode(
			65 + index
		);
	}


	function isCorrectOption(
		optionId: string
	): boolean {
		return (
			answerResult
				?.correctOptionIds
				.includes(optionId) ??
			false
		);
	}


	function isIncorrectSelection(
		optionId: string
	): boolean {
		return Boolean(
			answerResult &&
			!answerResult.correct &&
			answerResult.selectedOptionId ===
				optionId
		);
	}


	function getOptionClass(
		optionId: string
	): string {
		const classes = [
			'card',
			'preset-outlined',
			'flex',
			'w-full',
			'items-center',
			'gap-3',
			'p-4',
			'text-left',
			'transition',
			'disabled:cursor-not-allowed'
		];

		if (isCorrectOption(optionId)) {
			classes.push(
				'border-success-500',
				'bg-success-500/20',
				'ring-1',
				'ring-success-500/40'
			);
		} else if (
			isIncorrectSelection(optionId)
		) {
			classes.push(
				'border-error-500',
				'bg-error-500/20',
				'ring-1',
				'ring-error-500/40'
			);
		} else if (
			submitting &&
			selectedOptionId === optionId
		) {
			classes.push(
				'border-primary-500',
				'bg-primary-500/10'
			);
		} else if (!disabled) {
			classes.push(
				'hover:border-primary-500',
				'hover:bg-primary-500/5'
			);
		}

		return classes.join(' ');
	}


	function getResultLabel(
		optionId: string
	): string | null {
		if (isCorrectOption(optionId)) {
			return answerResult?.selectedOptionId ===
				optionId
				? '✓ 正確'
				: '✓ 正確答案';
		}

		if (isIncorrectSelection(optionId)) {
			return '✕ 你的答案';
		}

		return null;
	}
</script>


<section
	class="card preset-outlined p-5 md:p-7"
>
	<h2
		class="text-lg font-semibold leading-relaxed md:text-xl"
	>
		{question.prompt}
	</h2>


	<div class="mt-6 space-y-3">
		{#each
			question.options as option, index
			(option.id)
		}
			{@const resultLabel =
				getResultLabel(option.id)}

			<button
				type="button"
				class={getOptionClass(
					option.id
				)}
				{disabled}
				onclick={() =>
					onSelect(
						option.id
					)}
			>
				<span
					class="flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold"
				>
					{getOptionLabel(index)}
				</span>

				<span
					class="min-w-0 flex-1 leading-relaxed"
				>
					{option.content}
				</span>

				{#if resultLabel}
					<span
						class="shrink-0 text-sm font-semibold"
						class:text-success-700-300={
							isCorrectOption(
								option.id
							)
						}
						class:text-error-700-300={
							isIncorrectSelection(
								option.id
							)
						}
					>
						{resultLabel}
					</span>
				{/if}
			</button>
		{/each}
	</div>
</section>
