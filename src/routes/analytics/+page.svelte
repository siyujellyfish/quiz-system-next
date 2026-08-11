<script lang="ts">
	import {
		BookOpen,
		ChartColumn,
		Clock,
		History,
		Target,
		TrendingUp,
		Trophy
	} from '@lucide/svelte';

	import type {
		PageProps
	} from './$types';

	let {
		data
	}: PageProps = $props();

	function formatDuration(
		seconds: number
	): string {
		const rounded = Math.max(
			0,
			Math.round(seconds)
		);
		const hours = Math.floor(
			rounded / 3600
		);
		const minutes = Math.floor(
			(rounded % 3600) / 60
		);
		const remainingSeconds =
			rounded % 60;

		return [
			hours,
			minutes,
			remainingSeconds
		]
			.map((value) =>
				String(value).padStart(2, '0'))
			.join(':');
	}

	function formatShortDate(
		value: Date
	): string {
		return new Intl.DateTimeFormat(
			'zh-TW',
			{
				month: '2-digit',
				day: '2-digit'
			}
		).format(value);
	}

	function formatDate(
		value: Date
	): string {
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

	function getBarHeight(
		accuracy: number
	): number {
		return Math.max(
			4,
			Math.min(100, accuracy)
		);
	}
</script>

<svelte:head>
	<title>學習統計 | Quiz System</title>
</svelte:head>

<div class="app-page max-w-6xl">
	<section class="app-panel overflow-hidden">
		<header
			class="flex flex-wrap items-start justify-between gap-4 border-b border-surface-300-700 px-5 py-5 md:px-6"
		>
			<div class="flex items-start gap-3">
				<span
					class="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-base bg-primary-500/10 text-primary-700-300"
				>
					<ChartColumn size={20} aria-hidden="true" />
				</span>
				<div>
					<p class="quiz-eyebrow">LEARNING ANALYTICS</p>
					<h1 class="mt-1 text-2xl font-bold">學習統計</h1>
					<p class="mt-1 text-sm opacity-60">
						依據已完成的模擬測驗紀錄，觀察整體與各題庫的表現。
					</p>
				</div>
			</div>

			<a
				href="/history"
				class="btn preset-tonal"
			>
				<History size={16} aria-hidden="true" />
				測驗紀錄
			</a>
		</header>

		<div class="p-5 md:p-6">
			{#if data.analytics.overview.attemptCount === 0}
				<div class="py-16 text-center">
					<span
						class="mx-auto flex size-14 items-center justify-center rounded-full bg-surface-200-800"
					>
						<TrendingUp size={24} aria-hidden="true" />
					</span>
					<h2 class="mt-4 text-lg font-semibold">
						目前還沒有可分析的成績
					</h2>
					<p class="mt-2 text-sm opacity-60">
						完成模擬測驗後，這裡會自動整理近期趨勢與各題庫統計。
					</p>
					<a
						href="/"
						class="btn preset-filled-primary-500 mt-6"
					>
						開始測驗
					</a>
				</div>
			{:else}
				<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<div class="quiz-stat-tile text-left">
						<div class="flex items-center gap-2 text-sm opacity-60">
							<History size={16} aria-hidden="true" />
							完成次數
						</div>
						<p class="mt-2 text-2xl font-bold tabular-nums">
							{data.analytics.overview.attemptCount}
						</p>
					</div>

					<div class="quiz-stat-tile text-left">
						<div class="flex items-center gap-2 text-sm opacity-60">
							<Target size={16} aria-hidden="true" />
							平均正確率
						</div>
						<p class="mt-2 text-2xl font-bold tabular-nums">
							{data.analytics.overview.averageAccuracy.toFixed(1)}%
						</p>
					</div>

					<div class="quiz-stat-tile text-left">
						<div class="flex items-center gap-2 text-sm opacity-60">
							<Trophy size={16} aria-hidden="true" />
							最佳正確率
						</div>
						<p class="mt-2 text-2xl font-bold tabular-nums">
							{data.analytics.overview.bestAccuracy.toFixed(1)}%
						</p>
					</div>

					<div class="quiz-stat-tile text-left">
						<div class="flex items-center gap-2 text-sm opacity-60">
							<Clock size={16} aria-hidden="true" />
							平均作答時間
						</div>
						<p class="mt-2 text-2xl font-bold tabular-nums">
							{formatDuration(
								data.analytics.overview.averageDurationSeconds
							)}
						</p>
					</div>
				</div>

				<section
					class="mt-6 rounded-container border border-surface-300-700 bg-surface-50-950 p-4 md:p-5"
				>
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div>
							<div class="flex items-center gap-2">
								<TrendingUp
									size={18}
									class="text-primary-700-300"
									aria-hidden="true"
								/>
								<h2 class="font-semibold">近期成績趨勢</h2>
							</div>
							<p class="mt-1 text-sm opacity-55">
								依時間排列最近 {data.analytics.recentTrend.length} 次測驗。
							</p>
						</div>
						<span class="text-xs opacity-50">正確率</span>
					</div>

					<div
						class="mt-6 flex min-h-52 items-end gap-2 overflow-x-auto pb-1"
						aria-label="最近測驗正確率趨勢"
					>
						{#each data.analytics.recentTrend as point (point.id)}
							<div
								class="flex min-w-16 flex-1 flex-col items-center gap-2"
								title={`${point.bankName} · ${point.accuracy.toFixed(1)}% · ${formatDate(point.submittedAt)}`}
							>
								<span class="text-xs font-semibold tabular-nums">
									{point.accuracy.toFixed(0)}%
								</span>
								<div
									class="flex h-36 w-full items-end overflow-hidden rounded-base bg-surface-100-900 p-1"
									aria-label={`${formatDate(point.submittedAt)} ${point.bankName} 正確率 ${point.accuracy.toFixed(1)}%`}
								>
									<div
										class="w-full rounded-sm bg-primary-500/75 transition-opacity hover:opacity-85"
										style={`height:${getBarHeight(point.accuracy)}%`}
									></div>
								</div>
								<span class="text-xs tabular-nums opacity-55">
									{formatShortDate(point.submittedAt)}
								</span>
							</div>
						{/each}
					</div>
				</section>

				<section class="mt-6">
					<div class="flex items-center gap-2">
						<BookOpen
							size={18}
							class="text-primary-700-300"
							aria-hidden="true"
						/>
						<h2 class="text-lg font-semibold">各題庫表現</h2>
					</div>
					<p class="mt-1 text-sm opacity-55">
						依完成次數排序；已移除的題庫仍保留歷史統計。
					</p>

					<div class="mt-4 grid gap-4 lg:grid-cols-2">
						{#each data.analytics.banks as bank (`${bank.bankId ?? 'removed'}:${bank.bankName}`)}
							<article
								class="rounded-container border border-surface-300-700 bg-surface-50-950 p-4 md:p-5"
							>
								<div class="flex items-start justify-between gap-3">
									<div class="min-w-0">
										<div class="flex flex-wrap items-center gap-2">
											<h3 class="truncate font-semibold">
												{bank.bankName}
											</h3>
											{#if bank.bankId === null}
												<span class="badge preset-tonal">題庫已移除</span>
											{/if}
										</div>
										<p class="mt-1 text-xs opacity-55">
											最近測驗 {formatDate(bank.lastAttemptAt)}
										</p>
									</div>
									<span class="badge preset-tonal-primary shrink-0">
										{bank.attemptCount} 次
									</span>
								</div>

								<div class="mt-5 flex items-center justify-between gap-3 text-sm">
									<span class="opacity-60">平均正確率</span>
									<strong class="tabular-nums">
										{bank.averageAccuracy.toFixed(1)}%
									</strong>
								</div>
								<div
									class="mt-2 h-2 overflow-hidden rounded-full bg-surface-200-800"
								>
									<div
										class="h-full rounded-full bg-primary-500"
										style={`width:${Math.min(100, Math.max(0, bank.averageAccuracy))}%`}
									></div>
								</div>

								<div class="mt-5 grid grid-cols-2 gap-3">
									<div>
										<p class="text-xs opacity-55">最佳正確率</p>
										<p class="mt-1 font-semibold tabular-nums">
											{bank.bestAccuracy.toFixed(1)}%
										</p>
									</div>
									<div>
										<p class="text-xs opacity-55">平均時間</p>
										<p class="mt-1 font-semibold tabular-nums">
											{formatDuration(bank.averageDurationSeconds)}
										</p>
									</div>
								</div>
							</article>
						{/each}
					</div>
				</section>
			{/if}
		</div>
	</section>
</div>
