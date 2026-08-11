<script lang="ts">
	import type {
		ActionData
	} from './$types';

	import BankForm
		from '$lib/components/admin/BankForm.svelte';

	let {
		form
	}: {
		form: ActionData;
	} = $props();

	let values = $derived({
		name: form?.values?.name ?? '',
		slug: form?.values?.slug ?? '',
		description:
			form?.values?.description ?? ''
	});
</script>

<svelte:head>
	<title>新增題庫 | Quiz</title>
</svelte:head>

<div
	class="mx-auto w-full max-w-3xl p-4 md:p-6"
>
	<nav
		class="mb-4 text-sm opacity-60"
		aria-label="麵包屑"
	>
		<a href="/admin">管理後台</a>
		<span class="mx-2">/</span>
		<a href="/admin/banks">題庫管理</a>
		<span class="mx-2">/</span>
		<span>新增題庫</span>
	</nav>

	<header class="mb-8">
		<h1 class="text-3xl font-bold">
			新增題庫
		</h1>

		<p class="mt-2 opacity-60">
			先建立題庫基本資料，之後再加入題目。
		</p>
	</header>

	<section
		class="card preset-outlined p-5 md:p-6"
	>
		<BankForm
			{values}
			errors={form?.errors}
			message={form?.message}
			submitLabel="建立題庫"
			cancelHref="/admin/banks"
		/>
	</section>
</div>
