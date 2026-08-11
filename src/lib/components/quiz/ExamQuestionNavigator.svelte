<script lang="ts">
	import {
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
	const PREVIEW_CLOSE_DELAY_MS = 120;

	let {
		session,
		reviewMode,
		onSelect,
		getButtonClass,
		compact = false
	}: Props = $props();

	let page = $state(0);
	let previewIndex = $state<number | null>(null);
	let previewCandidateIndex = $state<number | null>(null);
	let previewAnchorX = $state(0);
	let previewAnchorY = $state(0);
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
	let previewQuestion = $derived(
		previewIndex === null
			? null
			: session.questions[previewIndex] ?? null
	);
	let previewSelectedId = $derived(
		previewQuestion
			? getSelectedOptionId(previewQuestion.id)
			: null
	);

	$effect(() => {
		page = getExamNavigatorPage(
			session.currentIndex
		);
	});

	function clearPreviewOpenTimer(): void {
		if (!previewOpenTimer) {
			return;
		}

		clearTimeout(previewOpenTimer);
		previewOpenTimer = null;
	}

	function clearPreviewCloseTimer(): void {
		if (!previewCloseTimer) {
			return;
		}

		clearTimeout(previewCloseTimer);
		previewCloseTimer = null;
	}

	function clearPreviewTimers(): void {
		clearPreviewOpenTimer();
		clearPreviewCloseTimer();
	}

	function setPreviewAnchor(
		button: HTMLButtonElement
	): void {
		const rect = button.getBoundingClientRect();
		const centerY = rect.top + rect.height / 2;
		const viewportPadding = 180;

		previewAnchorX = rect.left - 10;
		previewAnchorY = Math.min(
			Math.max(centerY, viewportPadding),
			Math.max(
				viewportPadding,
				window.innerHeight - viewportPadding
			)
		);
	}

	function schedulePreviewOpen(
		index: number,
		button: HTMLButtonElement
	): void {
		if (compact) {
			return;
		}

		clearPreviewTimers();
		setPreviewAnchor(button);

		if (previewIndex !== index) {
			previewIndex = null;
		}

		previewCandidateIndex = index;
		previewOpenTimer = setTimeout(() => {
			if (previewCandidateIndex === index) {
				previewIndex = index;
			}

			previewOpenTimer = null;
		}, PREVIEW_OPEN_DELAY_MS);
	}

	function openPreviewImmediately(
		index: number,
		button: HTMLButtonElement
	): void {
		if (compact) {
			return;
		}

		clearPreviewTimers();
		setPreviewAnchor(button);
		previewCandidateIndex = index;
		previewIndex = index;
	}

	function schedulePreviewClose(): void {
		clearPreviewOpenTimer();
		clearPreviewCloseTimer();
		previewCandidateIndex = null;

		previewCloseTimer = setTimeout(() => {
			previewIndex = null;
			previewCloseTimer = null;
		}, PREVIEW_CLOSE_DELAY_MS);
	}

	function keepPreviewOpen(): void {
		clearPreviewCloseTimer();
	}

	function closePreview(): void {
		clearPreviewTimers();
		previewCandidateIndex = null;
		previewIndex = null;
	}

	function handleTriggerFocus(
		index: number,
		button: HTMLButtonElement
	): void {
		if (!button.matches(':focus-visible')) {
			return;
		}

		openPreviewImmediately(index, button);
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
		clearPreviewTimers();
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
			<button
				type="button"
				class={getButtonClass(index)}
				onmouseenter={(event) => {
					schedulePreviewOpen(
						index,
						event.currentTarget
					);
				}}
				onmouseleave={schedulePreviewClose}
				onfocus={(event) => {
					handleTriggerFocus(
						index,
						event.currentTarget
					);
				}}
				onblur={schedulePreviewClose}
				onclick={() => {
					closePreview();
					onSelect(index);
				}}
			>
				{index + 1}
			</button>
		{/each}
	</div>

	{#if pageCount > 1}
		<nav
			class="mt-4 flex items-center justify-center border-t border-surface-300-700 pt-4"
			aria-label="題號分頁"
		>
			<div
				class="flex items-center divide-x divide-surface-300-700 overflow-hidden rounded-base border border-surface-300-700"
			>
				<button
					type="button"
					class="flex size-9 items-center justify-center transition hover:bg-surface-200-800 disabled:cursor-not-allowed disabled:opacity-30"
					aria-label="前 50 題"
					disabled={page === 0}
					onclick={() => goToPage(page - 1)}
				>
					‹
				</button>

				<span
					class="min-w-24 px-4 py-2 text-center text-sm font-semibold tabular-nums"
				>
					{range.start + 1}–{range.end}
				</span>

				<button
					type="button"
					class="flex size-9 items-center justify-center transition hover:bg-surface-200-800 disabled:cursor-not-allowed disabled:opacity-30"
					aria-label="後 50 題"
					disabled={page >= pageCount - 1}
					onclick={() => goToPage(page + 1)}
				>
					›
				</button>
			</div>
		</nav>
	{/if}
</div>

{#if !compact && previewQuestion && previewIndex !== null}
	<Portal>
		<div
			id="exam-question-preview"
			role="tooltip"
			class="card fixed z-[90] w-[min(24rem,calc(100vw-2rem))] border border-surface-300-700 bg-surface-50-950 p-4 shadow-xl"
			style={`left:${previewAnchorX}px;top:${previewAnchorY}px;transform:translate(-100%,-50%);`}
			onmouseenter={keepPreviewOpen}
			onmouseleave={schedulePreviewClose}
		>
			<div
				class="mb-3 flex items-center justify-between gap-3"
			>
				<strong>Question {previewIndex + 1}</strong>
				{#if previewSelectedId}
					<span class="badge preset-tonal-primary">
						已作答
					</span>
				{/if}
			</div>

			<p
				class="line-clamp-4 whitespace-pre-wrap text-sm font-semibold leading-relaxed"
			>
				{previewQuestion.prompt}
			</p>

			<div class="mt-4 space-y-2">
				{#each previewQuestion.options as option, optionIndex}
					<div
						class={getPreviewOptionClass(
							previewQuestion.id,
							option.id,
							previewSelectedId
						)}
					>
						<div class="flex gap-2">
							<strong>{String.fromCharCode(65 + optionIndex)}.</strong>
							<span class="min-w-0 flex-1">
								{option.content}
							</span>
						</div>

						{#if previewSelectedId === option.id}
							<p
								class="mt-1 font-semibold text-primary-700-300"
							>
								你的答案
							</p>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</Portal>
{/if}
