<script lang="ts">
	import {
		BookOpen,
		Clock,
		History,
		Trash2,
		Trophy
	} from '@lucide/svelte';
	import {
		Dialog,
		Portal
	} from '@skeletonlabs/skeleton-svelte';

	import type {
		PageProps
	} from './$types';

	let {
		data,
		form
	}: PageProps = $props();

	let deleteTarget = $state<{
		id: string;
		bankName: string;
	} | null>(null);
	let showClearConfirm = $state(false);

	let averageAccuracy = $derived.by(() => {
		if (data.attempts.length === 0) {
			return 0;
		}

		const total = data.attempts.reduce(
			(sum, attempt) => {
				const correct = attempt.correctCount ?? 0;
				return sum + (
					attempt.totalQuestions > 0
						? correct / attempt.totalQuestions * 100
						: 0
				);
			},
			0
		);

		return total / data.attempts.length;
	});

	function formatDate(
		value: Date | null
	): string {
		if (!value) {
			return '—';
		}

		return new Intl.DateTimeFormat(
			'zh-TW',
			{
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			}
		).format(value);
	}

	function formatDuration(
		seconds: number | null
	): string {
		if (seconds === null) {
			return '—';
		}

		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor(
			(seconds % 3600) / 60
		);
		const remainingSeconds = seconds % 60;

		return [
			hours,
			minutes,
			remainingSeconds
		]
			.map((value) =>
				String(value).padStart(2, '0'))
			.join(':');
	}

	function getAccuracy(
		correctCount: number | null,
		totalQuestions: number
	): number {
		if (totalQuestions <= 0) {
			return 0;
		}

		return (correctCount ?? 0) /
			totalQuestions * 100;
	}
</script>

<svelte:head>
	<title>測驗紀錄 | Quiz System</title>
</svelte:head>

<div class="app-page max-w-5xl">
	<section class="app-panel overflow-hidden">
		<header
			class="flex flex-wrap items-start justify-between gap-4 border-b border-surface-300-700 px-5 py-5 md:px-6"
		>
			<div class="flex items-start gap-3">
				<span
					class="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-base bg-primary-500/10 text-primary-700-300"
				>
					<History size={20} aria-hidden="true" />
				</span>
				<div>
					<p class="quiz-eyebrow">EXAM HISTORY</p>
					<h1 class="mt-1 text-2xl font-bold">測驗紀錄</h1>
					<p class="mt-1 text-sm opacity-60">
						查看已完成的模擬測驗成績與作答時間。
					</p>
				</div>
			</div>

			{#if data.attempts.length > 0}
				<button
					type="button"
					class="btn preset-tonal-error"
					onclick={() => {
						showClearConfirm = true;
					}}
				>
					<Trash2 size={16} aria-hidden="true" />
					清空紀錄
				</button>
			{/if}
		</header>

		<div class="p-5 md:p-6">
			{#if data.deleted}
				<p
					class="mb-5 rounded-base border border-success-500/30 bg-success-500/10 px-4 py-3 text-sm text-success-700-300"
					role="status"
				>
					測驗紀錄已刪除。
				</p>
			{:else if data.cleared}
				<p
					class="mb-5 rounded-base border border-success-500/30 bg-success-500/10 px-4 py-3 text-sm text-success-700-300"
					role="status"
				>
					所有測驗紀錄已清空。
				</p>
			{/if}

			{#if form?.message}
				<p
					class="mb-5 rounded-base border border-error-500/30 bg-error-500/10 px-4 py-3 text-sm text-error-700-300"
					role="alert"
				>
					{form.message}
				</p>
			{/if}

			{#if data.attempts.length === 0}
				<div class="py-16 text-center">
					<span
						class="mx-auto flex size-14 items-center justify-center rounded-full bg-surface-200-800"
					>
						<History size={24} aria-hidden="true" />
					</span>
					<h2 class="mt-4 text-lg font-semibold">
						目前沒有測驗紀錄
					</h2>
					<p class="mt-2 text-sm opacity-60">
						完成模擬測驗後，成績會自動保存在這裡。
					</p>
					<a
						href="/"
						class="btn preset-filled-primary-500 mt-6"
					>
						開始測驗
					</a>
				</div>
			{:else}
				<div class="mb-6 grid gap-3 sm:grid-cols-2">
					<div class="quiz-stat-tile text-left">
						<div class="flex items-center gap-2 text-sm opacity-60">
							<History size={16} aria-hidden="true" />
							完成次數
						</div>
						<p class="mt-2 text-2xl font-bold">
							{data.attempts.length}
						</p>
					</div>
					<div class="quiz-stat-tile text-left">
						<div class="flex items-center gap-2 text-sm opacity-60">
							<Trophy size={16} aria-hidden="true" />
							平均正確率
						</div>
						<p class="mt-2 text-2xl font-bold">
							{averageAccuracy.toFixed(1)}%
						</p>
					</div>
				</div>

				<div class="space-y-3">
					{#each data.attempts as attempt (attempt.id)}
						<article
							class="rounded-container border border-surface-300-700 bg-surface-50-950 p-4 md:p-5"
						>
							<div class="flex flex-wrap items-start justify-between gap-4">
								<div class="min-w-0">
									<div class="flex items-center gap-2">
										<BookOpen
											size={17}
											class="shrink-0 opacity-60"
											aria-hidden="true"
										/>
										<h2 class="truncate font-semibold">
											{attempt.bankName}
										</h2>
										{#if attempt.bankId === null}
											<span class="badge preset-tonal">題庫已移除</span>
										{/if}
									</div>
									<p class="mt-1 text-xs opacity-55">
										{formatDate(attempt.submittedAt)}
									</p>
								</div>

								<button
									type="button"
									class="btn preset-tonal-error"
									aria-label={`刪除 ${attempt.bankName} 測驗紀錄`}
									onclick={() => {
										deleteTarget = {
											id: attempt.id,
											bankName: attempt.bankName
										};
									}}
								>
									<Trash2 size={16} aria-hidden="true" />
									<span class="hidden sm:inline">刪除</span>
								</button>
							</div>

							<div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
								<div>
									<p class="text-xs opacity-55">成績</p>
									<p class="mt-1 font-semibold tabular-nums">
										{attempt.correctCount ?? 0} / {attempt.totalQuestions}
									</p>
								</div>
								<div>
									<p class="text-xs opacity-55">正確率</p>
									<p class="mt-1 font-semibold tabular-nums">
										{getAccuracy(
											attempt.correctCount,
											attempt.totalQuestions
										).toFixed(1)}%
									</p>
								</div>
								<div>
									<p class="text-xs opacity-55">已作答</p>
									<p class="mt-1 font-semibold tabular-nums">
										{attempt.answeredCount ?? 0}
									</p>
								</div>
								<div>
									<div class="flex items-center gap-1 text-xs opacity-55">
										<Clock size={13} aria-hidden="true" />
										作答時間
									</div>
									<p class="mt-1 font-semibold tabular-nums">
										{formatDuration(attempt.elapsedSeconds)}
									</p>
								</div>
							</div>
						</article>
					{/each}
				</div>
			{/if}
		</div>
	</section>
</div>

<Dialog
	role="alertdialog"
	open={deleteTarget !== null}
	onOpenChange={(details) => {
		if (!details.open) {
			deleteTarget = null;
		}
	}}
>
	<Portal>
		<Dialog.Backdrop class="fixed inset-0 z-50 bg-black/60" />
		<Dialog.Positioner
			class="fixed inset-0 z-50 flex items-center justify-center p-4"
		>
			<Dialog.Content
				class="card w-full max-w-md bg-surface-50-950 p-6 shadow-xl"
			>
				<Dialog.Title class="text-xl font-bold">
					刪除測驗紀錄？
				</Dialog.Title>
				<Dialog.Description class="mt-3 text-sm leading-relaxed opacity-70">
					將刪除「{deleteTarget?.bankName ?? ''}」這筆測驗紀錄。此操作無法復原。
				</Dialog.Description>

				<form
					method="POST"
					action="?/delete"
					class="mt-6 flex justify-end gap-3"
				>
					<input
						type="hidden"
						name="attemptId"
						value={deleteTarget?.id ?? ''}
					/>
					<Dialog.CloseTrigger
						type="button"
						class="btn preset-tonal"
					>
						取消
					</Dialog.CloseTrigger>
					<button
						type="submit"
						class="btn preset-filled-error-500"
					>
						刪除
					</button>
				</form>
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog>

<Dialog
	role="alertdialog"
	open={showClearConfirm}
	onOpenChange={(details) => {
		showClearConfirm = details.open;
	}}
>
	<Portal>
		<Dialog.Backdrop class="fixed inset-0 z-50 bg-black/60" />
		<Dialog.Positioner
			class="fixed inset-0 z-50 flex items-center justify-center p-4"
		>
			<Dialog.Content
				class="card w-full max-w-md bg-surface-50-950 p-6 shadow-xl"
			>
				<Dialog.Title class="text-xl font-bold">
					清空所有測驗紀錄？
				</Dialog.Title>
				<Dialog.Description class="mt-3 text-sm leading-relaxed opacity-70">
					將刪除你目前所有已完成的測驗紀錄，共 {data.attempts.length} 筆。正在進行中的測驗不受影響，此操作無法復原。
				</Dialog.Description>

				<form
					method="POST"
					action="?/clear"
					class="mt-6 flex justify-end gap-3"
				>
					<Dialog.CloseTrigger
						type="button"
						class="btn preset-tonal"
					>
						取消
					</Dialog.CloseTrigger>
					<button
						type="submit"
						class="btn preset-filled-error-500"
					>
						清空紀錄
					</button>
				</form>
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog>
