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
		const base = [
			'card',
			'preset-outlined',
			'flex',
			'w-full',
			'items-start',
			'gap-3',
			'p-4',
			'text-left',
			'transition',
			'disabled:cursor-not-allowed'
		];

		if (isCorrectOption(optionId)) {
			base.push(
				'border-success-500',
				'bg-success-500/10'
			);
		} else if (
			isIncorrectSelection(optionId)
		) {
			base.push(
				'border-error-500',
				'bg-error-500/10'
			);
		} else if (
			submitting &&
			selectedOptionId === optionId
		) {
			base.push(
				'border-primary-500',
				'bg-primary-500/10'
			);
		} else if (!disabled) {
			base.push(
				'hover:border-primary-500',
				'hover:bg-primary-500/5'
			);
		}

		return base.join(' ');
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

				{#if isCorrectOption(option.id)}
					<span
						class="shrink-0 font-semibold text-success-700-300"
						aria-label="正確答案"
					>
						✓
					</span>
				{:else if isIncorrectSelection(option.id)}
					<span
						class="shrink-0 font-semibold text-error-700-300"
						aria-label="你的答案錯誤"
					>
						✕
					</span>
				{/if}
			</button>
		{/each}
	</div>
</section>
