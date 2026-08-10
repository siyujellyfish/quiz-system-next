<script lang="ts">
	import {
		Popover,
		Portal
	} from '@skeletonlabs/skeleton-svelte';

	import type {
		ExamSession
	} from '$lib/types/quiz';

	const PAGE_SIZE = 50;

	type Props = {
		session: ExamSession;
		reviewMode: boolean;
		onSelect: (index: number) => void;
		getButtonClass: (index: number) => string;
		compact?: boolean;
	};

	let {
		session,
		reviewMode,
		onSelect,
		getButtonClass,
		compact = false
	}: Props = $props();

	let page = $state(0);
	let previewIndex = $state<number | null>(null);

	let answeredCount = $derived(
		Object.values(session.answers).filter(
			(optionId) => optionId !== null
		).length
	);
	let pageCount = $derived(
		Math.max(
			1,
			Math.ceil(
				session.questions.length /
					PAGE_SIZE
			)
		)
	);
	let pageStart = $derived(
		page * PAGE_SIZE
	);
	let pageEnd = $derived(
		Math.min(
			session.questions.length,
			pageStart + PAGE_SIZE
		)
	);
	let visibleQuestions = $derived(
		session.questions.slice(
			pageStart,
			pageEnd
		)
	);

	$effect(() => {
		page = Math.floor(
			session.currentIndex / PAGE_SIZE
		);
	});

	function getSelectedOptionId(
		questionId: string
	): string | null {
		return session.answers[questionId] ?? null;
	}

	function getReviewResult(
		questionId: string
	) {
		return session.result?.questions.find(
			(result) =>
				result.questionId === questionId
		) ?? null;
	}

	function isCorrectOption(
		questionId: string,
		optionId: string
	): boolean {
		if (!reviewMode) {
			return false;
		}

		return getReviewResult(questionId)
			?.correctOptionIds.includes(optionId) ?? false;
	}

	function goToPage(nextPage: number): void {
		page = Math.min(
			Math.max(0, nextPage),
			pageCount - 1
		);
		previewIndex = null;
	}
</script>

<div>
	<div
		class="flex items-center justify-between gap-3"
	>
		<div>
			<h2 class="font-semibold">題號</h2>
			<p class="mt-1 text-xs opacity-55">
				{pageStart + 1}–{pageEnd} / {session.questions.length}
			</p>
		</div>

		{#if !reviewMode}
			<span class="text-sm opacity-60">
				已答 {answeredCount}
			</span>
		{/if}
	</div>

	<div
		class={compact
			? 'mt-4 grid grid-cols-5 gap-2 sm:grid-cols-8'
			: 'mt-4 grid grid-cols-5 gap-2'}
	>
		{#each visibleQuestions as item, localIndex (item.id)}
			{@const index = pageStart + localIndex}
			{@const selectedId = getSelectedOptionId(item.id)}
			<Popover
				open={previewIndex === index}
				autoFocus={false}
				onOpenChange={(details) => {
					if (!details.open && previewIndex === index) {
						previewIndex = null;
					}
				}}
				positioning={{
					placement: compact ? 'top' : 'left',
					gutter: 10
				}}
			>
				<Popover.Trigger
					type="button"
					class={getButtonClass(index)}
					onmouseenter={() => {
						previewIndex = index;
					}}
					onmouseleave={() => {
						previewIndex = null;
					}}
					onfocus={() => {
						previewIndex = index;
					}}
					onblur={() => {
						previewIndex = null;
					}}
					onclick={() => onSelect(index)}
				>
					{index + 1}
				</Popover.Trigger>

				<Portal>
					<Popover.Positioner class="z-[90]">
						<Popover.Content
							class="card w-[min(24rem,calc(100vw-2rem))] border border-surface-300-700 bg-surface-50-950 p-4 shadow-xl"
							onmouseenter={() => {
								previewIndex = index;
							}}
							onmouseleave={() => {
								previewIndex = null;
							}}
						>
							<div
								class="mb-3 flex items-center justify-between gap-3"
							>
								<Popover.Title class="font-bold">
									Question {index + 1}
								</Popover.Title>
								{#if selectedId}
									<span class="badge preset-tonal-primary">
										已作答
									</span>
								{/if}
							</div>

							<Popover.Description
								class="line-clamp-4 whitespace-pre-wrap text-sm font-semibold leading-relaxed"
							>
								{item.prompt}
							</Popover.Description>

							<div class="mt-4 space-y-2">
								{#each item.options as option, optionIndex}
									<div
										class="rounded-base border border-surface-300-700 px-3 py-2 text-xs leading-relaxed"
										class:border-primary-500={selectedId === option.id && !reviewMode}
										class:bg-primary-500/10={selectedId === option.id && !reviewMode}
										class:border-success-500={isCorrectOption(item.id, option.id)}
										class:bg-success-500/10={isCorrectOption(item.id, option.id)}
									>
										<div class="flex gap-2">
											<strong>{String.fromCharCode(65 + optionIndex)}.</strong>
											<span class="min-w-0 flex-1">
												{option.content}
											</span>
										</div>

										{#if selectedId === option.id}
											<p
												class="mt-1 font-semibold text-primary-700-300"
											>
												你的答案
											</p>
										{/if}
									</div>
								{/each}
							</div>

							<Popover.Arrow
								class="[--arrow-background:var(--color-surface-50-950)] [--arrow-size:--spacing(2)]"
							>
								<Popover.ArrowTip />
							</Popover.Arrow>
						</Popover.Content>
					</Popover.Positioner>
				</Portal>
			</Popover>
		{/each}
	</div>

	{#if pageCount > 1}
		<div
			class="mt-4 flex items-center justify-between gap-2 border-t border-surface-300-700 pt-4"
		>
			<button
				type="button"
				class="btn preset-tonal"
				disabled={page === 0}
				onclick={() => goToPage(page - 1)}
			>
				‹ 前 50 題
			</button>

			<span class="text-xs font-semibold opacity-60">
				{page + 1} / {pageCount}
			</span>

			<button
				type="button"
				class="btn preset-tonal"
				disabled={page >= pageCount - 1}
				onclick={() => goToPage(page + 1)}
			>
				後 50 題 ›
			</button>
		</div>
	{/if}
</div>
