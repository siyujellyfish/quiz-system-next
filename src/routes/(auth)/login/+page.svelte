<script lang="ts">
	import type { ActionData } from './$types';

	let {
		form
	}: {
		form: ActionData;
	} = $props();
</script>

<svelte:head>
	<title>登入 | Quiz</title>
	<meta
		name="description"
		content="登入 Quiz 刷題系統"
	/>
</svelte:head>

<section class="card preset-outlined p-6 md:p-8 select-none">
	<header class="mb-6">
		<h2 class="h3">
			登入
		</h2>

		<p class="mt-1 text-sm opacity-60">
			登入帳號後開始刷題
		</p>
	</header>

	{#if form?.message}
		<div
			class="card preset-tonal-error-500 mb-6 p-4 text-sm"
			role="alert"
		>
			{form.message}
		</div>
	{/if}

	<form
		method="POST"
		class="space-y-5"
	>
		<label class="label">
			<span class="label-text">
				使用者名稱
			</span>

			<input
				class="input"
				type="text"
				name="username"
				value={form?.username ?? ''}
				placeholder="請輸入使用者名稱"
				autocomplete="username"
				autocapitalize="none"
				spellcheck="false"
				required
				minlength="3"
				maxlength="64"
			/>
		</label>

		<label class="label">
			<span class="label-text">
				密碼
			</span>

			<input
				class="input"
				type="password"
				name="password"
				placeholder="請輸入密碼"
				autocomplete="current-password"
				required
			/>
		</label>

		<button
			type="submit"
			class="btn preset-filled-primary-500 w-full"
		>
			登入
		</button>
	</form>

	<footer class="mt-6 text-center text-sm">
		<span class="opacity-60">
			還沒有帳號？
		</span>

		<a
			href="/signup"
			class="ml-1 font-medium"
		>
			建立帳號
		</a>
	</footer>
</section>