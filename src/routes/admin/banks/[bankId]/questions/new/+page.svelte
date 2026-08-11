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

	const defaultOptions = [
		{ id: null, content: '', isCorrect: false },
		{ id: null, content: '', isCorrect: false },
		{ id: null, content: '', isCorrect: false },
		{ id: null, content: '', isCorrect: false }
	];

	let values = $derived(
		form?.values ?? {
			prompt: '',
			options: defaultOptions
		}
	);
</script>

<svelte:head>
	<title>新增題目 | {data.bank.name} | Quiz</title>
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
		<span>新增題目</span>
	</nav>

	<header class="mb-8">
		<h1 class="text-3xl font-bold">
			新增題目
		</h1>

		<p class="mt-2 opacity-60">
			新增至 {data.bank.name}
		</p>
	</header>

	<section
		class="card preset-outlined p-5 md:p-6"
	>
		<QuestionForm
			{values}
			errors={form?.errors}
			message={form?.message}
			submitLabel="建立題目"
			cancelHref={`/admin/banks/${data.bank.id}/questions`}
		/>
	</section>
</div>
