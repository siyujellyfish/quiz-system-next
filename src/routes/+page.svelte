<script lang="ts">
	import {
		enhance,
		applyAction
	} from '$app/forms';

	import {
		goto
	} from '$app/navigation';

	import type {
		SubmitFunction
	} from '@sveltejs/kit';

	import type {
		PracticeQuestionsState
	} from '$lib/types/quiz';

	import {
		getGuestPracticeStorageKey
	} from '$lib/quiz/storage';


	let {
		data,
		form
	} = $props();


	type GuestPracticeResult = {
		guestPractice: {
			slug: string;
			questionsState:
				PracticeQuestionsState;
		};
	};


	function isGuestPracticeResult(
		value: unknown
	): value is GuestPracticeResult {
		if (
			typeof value !== 'object' ||
			value === null
		) {
			return false;
		}

		return (
			'guestPractice' in value &&
			typeof value.guestPractice ===
				'object' &&
			value.guestPractice !== null
		);
	}

const enhanceStart: SubmitFunction =
	() => {
		return async ({
			result
		}) => {
			if (
				result.type ===
					'success' &&
				isGuestPracticeResult(
					result.data
				)
			) {
				const {
					slug,
					questionsState
				} =
					result.data
						.guestPractice;

				sessionStorage.setItem(
					getGuestPracticeStorageKey(
						slug
					),
					JSON.stringify(
						questionsState
					)
				);

				await goto(
					`/practice/${slug}`
				);

				return;
			}

			await applyAction(
				result
			);
		};
	};
</script>


<svelte:head>
	<title>刷題模式 | Quiz</title>
</svelte:head>


<div class="mx-auto w-full max-w-5xl p-4 md:p-6">
	<header class="mb-8">
		<h1 class="text-3xl font-bold">
			練習模式
		</h1>

		{#if data.user}
			<p class="mt-2 opacity-60">
				選擇題庫並開始練習，進度會自動保存。
			</p>
		{:else}
			<p class="mt-2 opacity-60">
				目前為訪客模式，練習進度不會永久保存。
			</p>
		{/if}
	</header>


	{#if data.banks.length === 0}
		<section
			class="card preset-outlined-surface-200-800 p-6"
		>
			<h2 class="text-lg font-semibold">
				目前沒有題庫
			</h2>

			<p class="mt-2 opacity-60">
				請稍後再試。
			</p>
		</section>
	{:else}
		<div class="space-y-6">
			{#each data.banks as bank}
				<section
					class="card preset-outlined-surface-200-800 p-6"
				>
					<header
						class="
							mb-6
							flex
							flex-col
							gap-3
							md:flex-row
							md:items-start
							md:justify-between
						"
					>
						<div>
							<h2
								class="text-xl font-semibold"
							>
								{bank.name}
							</h2>

							{#if bank.description}
								<p
									class="
										mt-1
										text-sm
										opacity-60
									"
								>
									{bank.description}
								</p>
							{/if}
						</div>

						<div
							class="
								shrink-0
								text-sm
								opacity-60
							"
						>
							{bank.questionCount}
							題
						</div>
					</header>


					{#if bank.progress}
						<div
							class="
								mb-6
								rounded-container
								bg-surface-100-900
								p-4
							"
						>
							<div
								class="
									flex
									items-center
									justify-between
									gap-4
								"
							>
								<div>
									<p
										class="
											text-sm
											font-medium
										"
									>
										目前練習進度
									</p>

									<p
										class="
											mt-1
											text-sm
											opacity-60
										"
									>
										{bank.progress.completedQuestions}
										/
										{bank.progress.totalQuestions}
										題
									</p>
								</div>

								<a
									href={`/practice/${bank.slug}`}
									class="
										btn
										preset-tonal-primary
									"
								>
									繼續練習
								</a>
							</div>

							<progress
								class="progress mt-4 w-full"
								value={bank.progress.completedQuestions}
								max={bank.progress.totalQuestions}
							></progress>
						</div>
					{/if}


					<form
						method="POST"
						action="?/startPractice"
						use:enhance={enhanceStart}
						class="space-y-6"
					>
						<input
							type="hidden"
							name="bankId"
							value={bank.id}
						/>


						<fieldset>
							<legend
								class="
									mb-3
									text-sm
									font-semibold
								"
							>
								題目數量
							</legend>

							<div
								class="
									grid
									grid-cols-1
									gap-3
									sm:grid-cols-3
								"
							>
								<label
									class="
										flex
										cursor-pointer
										items-center
										gap-3
										rounded-container
										border
										border-surface-300-700
										p-3
									"
								>
									<input
										type="radio"
										name="coverage"
										value="30"
										checked
										class="
											size-4
											accent-primary-500
										"
									/>

									<span>
										<strong>
											30%
										</strong>

										<span
											class="
												ml-1
												text-sm
												opacity-60
											"
										>
											·
											{Math.ceil(
												bank.questionCount *
												0.3
											)}
											題
										</span>
									</span>
								</label>


								<label
									class="
										flex
										cursor-pointer
										items-center
										gap-3
										rounded-container
										border
										border-surface-300-700
										p-3
									"
								>
									<input
										type="radio"
										name="coverage"
										value="50"
										class="
											size-4
											accent-primary-500
										"
									/>

									<span>
										<strong>
											50%
										</strong>

										<span
											class="
												ml-1
												text-sm
												opacity-60
											"
										>
											·
											{Math.ceil(
												bank.questionCount *
												0.5
											)}
											題
										</span>
									</span>
								</label>


								<label
									class="
										flex
										cursor-pointer
										items-center
										gap-3
										rounded-container
										border
										border-surface-300-700
										p-3
									"
								>
									<input
										type="radio"
										name="coverage"
										value="100"
										class="
											size-4
											accent-primary-500
										"
									/>

									<span>
										<strong>
											100%
										</strong>

										<span
											class="
												ml-1
												text-sm
												opacity-60
											"
										>
											·
											{bank.questionCount}
											題
										</span>
									</span>
								</label>
							</div>
						</fieldset>


						<fieldset>
							<legend
								class="
									mb-3
									text-sm
									font-semibold
								"
							>
								選項順序
							</legend>

							<div
								class="
									flex
									flex-wrap
									gap-4
								"
							>
								<label
									class="
										flex
										cursor-pointer
										items-center
										gap-2
									"
								>
									<input
										type="radio"
										name="optionOrder"
										value="random"
										checked
										class="
											size-4
											accent-primary-500
										"
									/>

									<span>
										隨機
									</span>
								</label>

								<label
									class="
										flex
										cursor-pointer
										items-center
										gap-2
									"
								>
									<input
										type="radio"
										name="optionOrder"
										value="fixed"
										class="
											size-4
											accent-primary-500
										"
									/>

									<span>
										固定
									</span>
								</label>
							</div>
						</fieldset>


						{#if
							form?.bankId === bank.id &&
							form?.message
						}
							<div
								class="
									preset-tonal-error
									rounded-container
									p-3
									text-sm
								"
								role="alert"
							>
								{form.message}
							</div>
						{/if}


						<div
							class="
								flex
								justify-end
							"
						>
							<button
								type="submit"
								class="
									btn
									preset-filled-primary-500
								"
								disabled={bank.questionCount === 0}
							>
								{#if bank.progress}
									重新開始
								{:else}
									開始練習
								{/if}
							</button>
						</div>
					</form>
				</section>
			{/each}
		</div>
	{/if}
</div>