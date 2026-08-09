<script lang="ts">
	import type {
		PageProps
	} from './$types';

	import QuestionForm
		from '$lib/components/admin/QuestionForm.svelte';

	let {
		data,
		form
	}: PageProps = $props();

	let values = $derived(
		form?.values ?? {
			prompt: data.question.prompt,
			options: data.question.options.map(
				(option) => ({
					id: option.id,
					content: option.content,
					isCorrect: option.isCorrect
				})
			)
		}
	);
</script>

<svelte:head>
	<title>編輯題目 | {data.bank.name} | Quiz</title>
</svelte:head>

<div
	class="mx-auto w-full max-w-4xl p-4 md:p-6"
>
	<nav
		class="mb-4 text-sm opacity-60"
		aria-label="麵包屑"
	>
		<a href="/admin">管理後台</a>
		<span class="mx-2">/</span>
		<a href="/admin/banks">題庫管理</a>
		<span class="mx-2">/</span>
		<a
			href={`/admin/banks/${data.bank.id}/questions`}
		>
			{data.bank.name}
		</a>
		<span class="mx-2">/</span>
		<span>編輯題目</span>
	</nav>

	<header class="mb-8">
		<h1 class="text-3xl font-bold">
			編輯題目
		</h1>

		<p class="mt-2 font-mono text-sm opacity-50">
			{data.question.id}
		</p>
	</header>

	{#if form?.updated}
		<div
			class="card preset-tonal-success-500 mb-6 p-4 text-sm"
			role="status"
		>
			{form.message}
		</div>
	{/if}

	<section
		class="card preset-outlined p-5 md:p-6"
	>
		<QuestionForm
			{values}
			errors={form?.errors}
			message={form?.updated ? undefined : form?.message}
			submitLabel="儲存變更"
			cancelHref={`/admin/banks/${data.bank.id}/questions`}
			formAction="?/update"
		/>
	</section>

	<section
		class="card preset-outlined mt-8 border-error-500/50 p-5 md:p-6"
	>
		<h2 class="text-xl font-semibold text-error-700-300">
			危險區域
		</h2>

		<p class="mt-2 text-sm opacity-70">
			刪除題目會同步刪除其選項與相關錯題紀錄，並重置此題庫所有進行中的 Practice，以避免舊 session 引用已刪除題目。
		</p>

		<details
			class="mt-5 rounded-lg border border-error-500/40 p-4"
		>
			<summary
				class="cursor-pointer font-medium text-error-700-300"
			>
				我要刪除這道題目
			</summary>

			<div class="mt-4 space-y-4">
				<div
					class="card preset-tonal-error-500 p-4 text-sm"
				>
					<p class="font-semibold">
						此操作無法復原。
					</p>

					<p class="mt-2 whitespace-pre-wrap opacity-80">
						{data.question.prompt}
					</p>
				</div>

				<form
					method="POST"
					action="?/delete"
					class="flex justify-end"
				>
					<button
						type="submit"
						class="btn preset-filled-error-500"
					>
						確認刪除題目
					</button>
				</form>
			</div>
		</details>
	</section>
</div>
