<script lang="ts">
	import {
		Popover,
		Portal
	} from '@skeletonlabs/skeleton-svelte';
	import {
		onDestroy
	} from 'svelte';

	import type {
		ExamSession
	} from '$lib/types/quiz';

	import {
		getExamNavigatorPage,
		getExamNavigatorPageCount,
		getExamNavigatorRange
	} from '$lib/quiz/exam-navigator';

	type Props = {
		session: ExamSession;
		reviewMode: boolean;
		onSelect: (index: number) => void;
		getButtonClass: (index: number) => string;
		compact?: boolean;
	};

	const PREVIEW_OPEN_DELAY_MS = 180;
	const PREVIEW_CLOSE_DELAY_MS = 140;

	let {
		session,
		reviewMode,
		onSelect,
		getButtonClass,
		compact = false
	}: Props = $props();

	let page = $state(0);
	let previewIndex = $state<number | null>(null);
	let pendingPreviewIndex = $state<number | null>(null);
	let previewOpenTimer:
		ReturnType<typeof setTimeout> | null = null;
	let previewCloseTimer:
		ReturnType<typeof setTimeout> | null = null;

	let answeredCount = $derived(
		Object.values(session.answers).filter(
			(optionId) => optionId !== null
		).length
	);
	let pageCount = $derived(
		getExamNavigatorPageCount(
			session.questions.length
		)
	);
	let range = $derived(
		getExamNavigatorRange(
			session.questions.length,
			page
		)
	);
	let visibleQuestions = $derived(
		session.questions.slice(
			range.start,
			range.end
		)
	);

	$effect(() => {
		page = getExamNavigatorPage(
			session.currentIndex
		);
	});

	function clearPreviewOpenTimer(): void {
		if (previewOpenTimer) {
			clearTimeout(previewOpenTimer);
			previewOpenTimer = null;
		}

		pendingPreviewIndex = null;
	}

	function clearPreviewCloseTimer(): void {
		if (!previewCloseTimer) {
			return;
		}

		clearTimeout(previewCloseTimer);
		previewCloseTimer = null;
	}

	function openPreviewImmediately(
		index: number
	): void {
		clearPreviewOpenTimer();
		clearPreviewCloseTimer();
		previewIndex = index;
	}

	function schedulePreviewOpen(
		index: number
	): void {
		if (previewIndex === index) {
			clearPreviewOpenTimer();
			clearPreviewCloseTimer();
			return;
		}

		clearPreviewOpenTimer();
		pendingPreviewIndex = index;

		previewOpenTimer = setTimeout(() => {
			if (pendingPreviewIndex === index) {
				previewIndex = index;
				pendingPreviewIndex = null;
			}

			previewOpenTimer = null;
		}, PREVIEW_OPEN_DELAY_MS);
	}

	function cancelPreviewOpen(
		index: number
	): void {
		if (pendingPreviewIndex !== index) {
			return;
		}

		clearPreviewOpenTimer();
	}

	function schedulePreviewClose(
		index: number
	): void {
		cancelPreviewOpen(index);

		if (previewIndex !== index) {
			return;
		}

		clearPreviewCloseTimer();

		previewCloseTimer = setTimeout(() => {
			if (previewIndex === index) {
				previewIndex = null;
			}

			previewCloseTimer = null;
		}, PREVIEW_CLOSE_DELAY_MS);
	}

	function keepPreviewOpen(
		index: number
	): void {
		clearPreviewOpenTimer();

		if (previewIndex === index) {
			clearPreviewCloseTimer();
		}
	}

	function closePreview(): void {
		clearPreviewOpenTimer();
		clearPreviewCloseTimer();
		previewIndex = null;
	}

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

	function getPreviewOptionClass(
		questionId: string,
		optionId: string,
		selectedId: string | null
	): string {
		const classes = [
			'rounded-base',
			'border',
			'border-surface-300-700',
			'px-3',
			'py-2',
			'text-xs',
			'leading-relaxed'
		];

		if (
			selectedId === optionId &&
			!reviewMode
		) {
			classes.push(
				'border-primary-500',
				'bg-primary-500/20',
				'ring-1',
				'ring-primary-500/35'
			);
		}

		if (
			isCorrectOption(
				questionId,
				optionId
			)
		) {
			classes.push(
				'border-success-500',
				'bg-success-500/15'
			);
		}

		return classes.join(' ');
	}

	function goToPage(nextPage: number): void {
		page = Math.min(
			Math.max(0, nextPage),
			pageCount - 1
		);
		closePreview();
	}

	onDestroy(() => {
		clearPreviewOpenTimer();
		clearPreviewCloseTimer();
	});
</script>

<div>
	<div
		class="flex items-center justify-between gap-3"
	>
		<div>
			<h2 class="font-semibold">題號</h2>
			<p class="mt-1 text-xs opacity-55">
				{range.start + 1}–{range.end} / {session.questions.length}
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
			{@const index = range.start + localIndex}
			{@const selectedId = getSelectedOptionId(item.id)}
			<Popover
				open={previewIndex === index}
				autoFocus={false}
				onOpenChange={(details) => {
					if (!details.open && previewIndex === index) {
						closePreview();
					}
				}}
				positioning={{
					placement: compact ? 'top' : 'left',
					gutter: 8
				}}
			>
				<Popover.Trigger
					type="button"
					class={getButtonClass(index)}
					onmouseenter={() => {
						schedulePreviewOpen(index);
					}}
					onmouseleave={() => {
						schedulePreviewClose(index);
					}}
					onfocus={() => {
						openPreviewImmediately(index);
					}}
					onblur={() => {
						schedulePreviewClose(index);
					}}
					onclick={() => {
						closePreview();
						onSelect(index);
					}}
				>
					{index + 1}
				</Popover.Trigger>

				<Portal>
					<Popover.Positioner class="z-[90]">
						<Popover.Content
							class="card w-[min(24rem,calc(100vw-2rem))] border border-surface-300-700 bg-surface-50-950 p-4 shadow-xl"
							onmouseenter={() => {
								keepPreviewOpen(index);
							}}
							onmouseleave={() => {
								schedulePreviewClose(index);
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
										class={getPreviewOptionClass(
											item.id,
											option.id,
											selectedId
										)}
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
								class="[--arrow-size:--spacing(2)]"
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
