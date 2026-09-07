<script lang="ts">
	import {
		onMount
	} from 'svelte';
	import type {
		Snippet
	} from 'svelte';

	type Props = {
		toolbar: Snippet;
		questionPane: Snippet;
		explanationPane?: Snippet;
		showExplanation?: boolean;
		storageKey?: string;
	};

	const DEFAULT_QUESTION_RATIO = 62;
	const MIN_QUESTION_RATIO = 38;
	const MAX_QUESTION_RATIO = 78;

	let {
		toolbar,
		questionPane,
		explanationPane,
		showExplanation = true,
		storageKey = 'quiz-system-workspace-question-ratio'
	}: Props = $props();

	let questionRatio =
		$state(DEFAULT_QUESTION_RATIO);
	let contentElement =
		$state<HTMLDivElement | null>(null);
	let hasVisibleExplanation =
		$derived(
			showExplanation &&
			Boolean(explanationPane)
		);

	onMount(() => {
		const stored = Number.parseFloat(
			localStorage.getItem(storageKey) ?? ''
		);

		if (Number.isFinite(stored)) {
			questionRatio = clampRatio(stored);
		}
	});

	function clampRatio(
		value: number
	) {
		return Math.min(
			MAX_QUESTION_RATIO,
			Math.max(
				MIN_QUESTION_RATIO,
				value
			)
		);
	}

	function setQuestionRatio(
		value: number,
		persist = false
	) {
		questionRatio = clampRatio(value);

		if (persist) {
			localStorage.setItem(
				storageKey,
				String(Math.round(questionRatio))
			);
		}
	}

	function startResize(
		event: PointerEvent
	) {
		if (
			event.button !== 0 ||
			!contentElement
		) {
			return;
		}

		event.preventDefault();
		const element = contentElement;

		const handleMove = (
			moveEvent: PointerEvent
		) => {
			const rect =
				element.getBoundingClientRect();

			if (rect.height <= 0) {
				return;
			}

			setQuestionRatio(
				(
					(moveEvent.clientY - rect.top) /
					rect.height
				) * 100
			);
		};
		const handleUp = () => {
			window.removeEventListener(
				'pointermove',
				handleMove
			);
			window.removeEventListener(
				'pointerup',
				handleUp
			);
			setQuestionRatio(
				questionRatio,
				true
			);
		};

		window.addEventListener(
			'pointermove',
			handleMove
		);
		window.addEventListener(
			'pointerup',
			handleUp
		);
	}

	function handleSeparatorKeydown(
		event: KeyboardEvent
	) {
		if (
			event.key !== 'ArrowUp' &&
			event.key !== 'ArrowDown'
		) {
			return;
		}

		event.preventDefault();
		setQuestionRatio(
			questionRatio +
				(event.key === 'ArrowDown'
					? 4
					: -4),
			true
		);
	}
</script>

<section class="quiz-workspace">
	<div class="quiz-workspace-toolbar border-b border-surface-300-700 bg-surface-50-950">
		{@render toolbar()}
	</div>

	<div
		bind:this={contentElement}
		class="quiz-workspace-content"
		class:with-explanation={hasVisibleExplanation}
		style={`--quiz-workspace-question-ratio: ${questionRatio}%`}
	>
		<section
			class="quiz-workspace-question-pane"
			aria-label="做題區"
		>
			{@render questionPane()}
		</section>

		{#if hasVisibleExplanation && explanationPane}
			<div
				class="quiz-workspace-splitter"
				role="separator"
				tabindex="0"
				aria-label="調整做題區與解析區高度"
				aria-orientation="horizontal"
				aria-valuemin={MIN_QUESTION_RATIO}
				aria-valuemax={MAX_QUESTION_RATIO}
				aria-valuenow={Math.round(questionRatio)}
				onpointerdown={startResize}
				onkeydown={handleSeparatorKeydown}
			></div>

			<section
				class="quiz-workspace-explanation-pane"
				aria-label="解析區"
			>
				{@render explanationPane()}
			</section>
		{/if}
	</div>
</section>

<style>
	.quiz-workspace {
		min-width: 0;
	}

	.quiz-workspace-toolbar {
		position: relative;
		z-index: 1;
		padding-top: 0.5rem;
	}

	.quiz-workspace-toolbar :global(.badge) {
		font-size: 0.875rem;
		font-weight: 600;
		line-height: 1.25rem;
	}

	.quiz-workspace-toolbar
		:global(div:has(> [aria-label='練習進度'])) {
		order: 100;
		display: block !important;
		flex: 1 0 100%;
		width: 100% !important;
		margin-top: 0.25rem;
		padding-bottom: 0.25rem;
	}

	.quiz-workspace-toolbar
		:global([aria-label='練習進度']) {
		width: 100%;
	}

	.quiz-workspace-toolbar
		:global([aria-label='練習進度'] [data-part='track']) {
		height: 0.625rem !important;
		min-height: 0.625rem;
		border-radius: 999px;
	}

	.quiz-workspace-question-pane
		:global(.quiz-eyebrow + .badge),
	.quiz-workspace-explanation-pane
		:global(.badge.preset-tonal-success),
	.quiz-workspace-explanation-pane
		:global(.badge.preset-tonal-error) {
		padding: 0.375rem 0.625rem;
		font-size: 0.875rem;
		font-weight: 700;
		line-height: 1.25rem;
	}

	.quiz-workspace-content,
	.quiz-workspace-question-pane,
	.quiz-workspace-explanation-pane {
		min-width: 0;
	}

	.quiz-workspace-explanation-pane {
		border-top: 1px solid
			var(--color-surface-300-700);
	}

	.quiz-workspace-splitter {
		display: none;
	}

	@media (max-width: 47.999rem) {
		.quiz-workspace-toolbar
			:global(
				div:has(> .badge.preset-tonal-success):has(> .badge.preset-tonal-error):has(> .badge.preset-tonal-primary)
			) {
			order: 90;
			display: flex !important;
			flex: 1 0 100%;
			flex-wrap: wrap;
			gap: 0.5rem;
			margin-top: 0.25rem;
		}
	}

	@media (min-width: 64rem) {
		.quiz-workspace {
			display: grid;
			height: calc(100dvh - 4rem);
			grid-template-rows: auto minmax(0, 1fr);
			overflow: hidden;
		}

		.quiz-workspace-content {
			min-height: 0;
			overflow: hidden;
		}

		.quiz-workspace-content.with-explanation {
			display: grid;
			grid-template-rows:
				minmax(
					0,
					var(--quiz-workspace-question-ratio)
				)
				10px
				minmax(0, 1fr);
		}

		.quiz-workspace-question-pane,
		.quiz-workspace-explanation-pane {
			min-height: 0;
			overflow-y: auto;
			overscroll-behavior: contain;
		}

		.quiz-workspace-explanation-pane {
			border-top: 0;
		}

		.quiz-workspace-splitter {
			position: relative;
			display: block;
			width: 100%;
			min-height: 10px;
			border-top: 1px solid
				var(--color-surface-300-700);
			border-bottom: 1px solid
				var(--color-surface-300-700);
			background: var(--color-surface-100-900);
			cursor: row-resize;
			outline: none;
		}

		.quiz-workspace-splitter::after {
			position: absolute;
			top: 50%;
			left: 50%;
			width: 4rem;
			height: 3px;
			border-radius: 999px;
			background: currentColor;
			content: '';
			opacity: 0.42;
			transform: translate(-50%, -50%);
		}

		.quiz-workspace-splitter:hover,
		.quiz-workspace-splitter:focus-visible {
			background: var(--color-surface-200-800);
		}

		.quiz-workspace-splitter:hover::after,
		.quiz-workspace-splitter:focus-visible::after {
			opacity: 0.8;
		}
	}
</style>
