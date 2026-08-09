<script lang="ts">
	import type { ActionData } from './$types';

	let {
		form
	}: {
		form: ActionData;
	} = $props();
</script>

<svelte:head>
	<title>建立帳號 | Quiz</title>
	<meta
		name="description"
		content="建立 Quiz 刷題系統帳號"
	/>
</svelte:head>

<section class="card preset-outlined p-6 md:p-8 select-none">
	<header class="mb-6">
		<h2 class="h3">
			建立帳號
		</h2>

		<p class="mt-1 text-sm opacity-60">
			建立帳號後即可開始刷題
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
				placeholder="3 - 64 個字元"
				autocomplete="username"
				autocapitalize="none"
				spellcheck="false"
				required
				minlength="3"
				maxlength="64"
			/>

			<span class="label-text text-xs opacity-50">
				登入時會使用這個名稱
			</span>
		</label>

		<label class="label">
			<span class="label-text">
				密碼
			</span>

			<input
				class="input"
				type="password"
				name="password"
				placeholder="至少 8 個字元"
				autocomplete="new-password"
				required
				minlength="8"
				maxlength="128"
			/>
		</label>

		<label class="label">
			<span class="label-text">
				確認密碼
			</span>

			<input
				class="input"
				type="password"
				name="confirmPassword"
				placeholder="再次輸入密碼"
				autocomplete="new-password"
				required
				minlength="8"
				maxlength="128"
			/>
		</label>

		<button
			type="submit"
			class="btn preset-filled-primary-500 w-full"
		>
			建立帳號
		</button>
	</form>

	<footer class="mt-6 text-center text-sm">
		<span class="opacity-60">
			已經有帳號？
		</span>

		<a
			href="/login"
			class="ml-1 font-medium"
		>
			登入
		</a>
	</footer>
</section>