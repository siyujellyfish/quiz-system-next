<script lang="ts">
	import type {
		PublicQuizQuestion,
		QuizAnswerResult
	} from '$lib/types/quiz';

	import QuestionExplanation
		from './QuestionExplanation.svelte';

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

	function isPendingSelection(
		optionId: string
	): boolean {
		return (
			!answerResult &&
			selectedOptionId === optionId
		);
	}

	function getOptionClass(
		optionId: string
	): string {
		const classes = [
			'flex',
			'w-full',
			'items-center',
			'gap-3',
			'rounded-container',
			'border',
			'border-surface-300-700',
			'bg-surface-100-900',
			'p-3.5',
			'text-left',
			'transition',
			'disabled:cursor-not-allowed'
		];

		if (isCorrectOption(optionId)) {
			classes.push(
				'border-2',
				'border-success-500',
				'bg-success-500/20',
				'ring-2',
				'ring-success-500/30'
			);
		} else if (
			isIncorrectSelection(optionId)
		) {
			classes.push(
				'border-2',
				'border-error-500',
				'bg-error-500/20',
				'ring-2',
				'ring-error-500/30'
			);
		} else if (
			isPendingSelection(optionId)
		) {
			classes.push(
				'border-2',
				'border-primary-500',
				'bg-primary-500/20',
				'ring-2',
				'ring-primary-500/35',
				'shadow-sm'
			);
		} else if (!disabled) {
			classes.push(
				'hover:border-primary-500',
				'hover:bg-surface-200-800'
			);
		}

		return classes.join(' ');
	}

	function getOptionMarkerClass(
		optionId: string
	): string {
		const classes = [
			'flex',
			'size-7',
			'shrink-0',
			'items-center',
			'justify-center',
			'rounded-base',
			'border',
			'font-mono',
			'text-xs',
			'font-bold',
			'transition'
		];

		if (isCorrectOption(optionId)) {
			classes.push(
				'border-success-500',
				'bg-success-500',
				'text-white'
			);
		} else if (
			isIncorrectSelection(optionId)
		) {
			classes.push(
				'border-error-500',
				'bg-error-500',
				'text-white'
			);
		} else if (
			isPendingSelection(optionId)
		) {
			classes.push(
				'border-primary-500',
				'bg-primary-500',
				'text-white'
			);
		} else {
			classes.push(
				'border-surface-400-600',
				'bg-surface-50-950'
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

<section class="app-panel p-5 md:p-6">
	<h2
		class="whitespace-pre-wrap text-lg font-bold leading-relaxed md:text-xl"
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
					class={getOptionMarkerClass(
						option.id
					)}
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
						class="badge shrink-0 text-sm font-semibold"
						class:preset-tonal-success={
							isCorrectOption(
								option.id
							)
						}
						class:preset-tonal-error={
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

	{#if answerResult}
		<QuestionExplanation
			explanation={answerResult.explanation}
		/>
	{/if}
</section>
