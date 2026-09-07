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

	.quiz-workspace-content,
	.quiz-workspace-question-pane,
	.quiz-workspace-explanation-pane {
		min-width: 0;
	}

	.quiz-workspace-splitter {
		display: none;
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
				8px
				minmax(0, 1fr);
		}

		.quiz-workspace-question-pane,
		.quiz-workspace-explanation-pane {
			min-height: 0;
			overflow-y: auto;
			overscroll-behavior: contain;
		}

		.quiz-workspace-splitter {
			position: relative;
			display: block;
			width: 100%;
			min-height: 8px;
			background: transparent;
			cursor: row-resize;
			outline: none;
		}

		.quiz-workspace-splitter::after {
			position: absolute;
			top: 3px;
			left: 50%;
			width: 3.5rem;
			height: 2px;
			border-radius: 999px;
			background: currentColor;
			content: '';
			opacity: 0.28;
			transform: translateX(-50%);
		}

		.quiz-workspace-splitter:hover::after,
		.quiz-workspace-splitter:focus-visible::after {
			opacity: 0.65;
		}
	}
</style>
