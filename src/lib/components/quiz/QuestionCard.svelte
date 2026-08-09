<script lang="ts">
	import type {
		PublicQuizQuestion
	} from '$lib/types/quiz';


	type Props = {
		question: PublicQuizQuestion;

		onSelect?: (
			optionId: string
		) => void;

		disabled?: boolean;
	};


	let {
		question,
		onSelect = () => {},
		disabled = false
	}: Props = $props();


	function getOptionLabel(
		index: number
	): string {
		return String.fromCharCode(
			65 + index
		);
	}
</script>


<section
	class="
		card
		preset-outlined
		p-5
		md:p-7
	"
>
	<h2
		class="
			text-lg
			font-semibold
			leading-relaxed
			md:text-xl
		"
	>
		{question.prompt}
	</h2>


	<div
		class="
			mt-6
			space-y-3
		"
	>
		{#each
			question.options as option, index
			(option.id)
		}
			<button
				type="button"
				class="
					card
					preset-outlined
					flex
					w-full
					items-start
					gap-3
					p-4
					text-left
					transition
					hover:preset-tonal-primary
					disabled:cursor-not-allowed
					disabled:opacity-60
				"
				{disabled}
				onclick={() =>
					onSelect(
						option.id
					)}
			>
				<span
					class="
						flex
						size-7
						shrink-0
						items-center
						justify-center
						rounded-full
						border
						text-sm
						font-semibold
					"
				>
					{getOptionLabel(index)}
				</span>

				<span
					class="
						min-w-0
						flex-1
						leading-relaxed
					"
				>
					{option.content}
				</span>
			</button>
		{/each}
	</div>
</section>