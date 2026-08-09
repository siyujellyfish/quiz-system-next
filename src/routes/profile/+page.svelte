<script lang="ts">
	import {
		onMount
	} from 'svelte';

	import type {
		PageProps
	} from './$types';

	let {
		data,
		form
	}: PageProps = $props();

	onMount(() => {
		if (!data.passwordChanged) {
			return;
		}

		const url = new URL(window.location.href);
		url.searchParams.delete('passwordChanged');

		window.history.replaceState(
			window.history.state,
			'',
			`${url.pathname}${url.search}${url.hash}`
		);
	});
</script>

<svelte:head>
	<title>個人資料 | Quiz</title>
</svelte:head>

<div
	class="mx-auto w-full max-w-3xl p-4 md:p-6"
>
	<header class="mb-6">
		<h1 class="text-3xl font-bold">
			個人資料
		</h1>

		<p class="mt-2 opacity-60">
			查看帳號資訊與管理登入密碼。
		</p>
	</header>

	{#if data.passwordChanged}
		<div
			class="card preset-tonal-success-500 mb-6 p-4 text-sm"
			role="status"
		>
			密碼已更新，其他裝置與瀏覽器的登入工作階段已登出。
		</div>
	{/if}

	<section
		class="card preset-outlined p-6"
	>
		<h2 class="text-xl font-semibold">
			帳號資訊
		</h2>

		<dl class="mt-5 space-y-5">
			<div>
				<dt class="text-sm font-medium opacity-60">
					使用者名稱
				</dt>

				<dd class="mt-1 text-lg font-semibold">
					{data.user.username}
				</dd>
			</div>

			<div>
				<dt class="text-sm font-medium opacity-60">
					帳號類型
				</dt>

				<dd class="mt-1">
					<span
						class="badge"
						class:preset-tonal-primary={
							data.user.isAdmin
						}
						class:preset-tonal={
							!data.user.isAdmin
						}
					>
						{data.user.isAdmin
							? '管理員'
							: '一般使用者'}
					</span>
				</dd>
			</div>
		</dl>
	</section>

	<section
		class="card preset-outlined mt-6 p-6"
	>
		<header>
			<h2 class="text-xl font-semibold">
				修改密碼
			</h2>

			<p class="mt-2 text-sm opacity-60">
				新密碼需介於 8 至 128 個字元。更新後會保留目前登入，並撤銷其他工作階段。
			</p>
		</header>

		{#if form?.message}
			<div
				class="card preset-tonal-error-500 mt-5 p-4 text-sm"
				role="alert"
			>
				{form.message}
			</div>
		{/if}

		<form
			method="POST"
			action="?/changePassword"
			class="mt-6 space-y-5"
		>
			<label class="label">
				<span class="label-text">
					目前密碼
				</span>

				<input
					class="input"
					type="password"
					name="currentPassword"
					autocomplete="current-password"
					required
					maxlength="128"
				/>

				{#if form?.errors?.currentPassword}
					<span class="mt-2 text-sm text-error-700-300">
						{form.errors.currentPassword}
					</span>
				{/if}
			</label>

			<label class="label">
				<span class="label-text">
					新密碼
				</span>

				<input
					class="input"
					type="password"
					name="newPassword"
					autocomplete="new-password"
					required
					minlength="8"
					maxlength="128"
				/>

				{#if form?.errors?.newPassword}
					<span class="mt-2 text-sm text-error-700-300">
						{form.errors.newPassword}
					</span>
				{/if}
			</label>

			<label class="label">
				<span class="label-text">
					確認新密碼
				</span>

				<input
					class="input"
					type="password"
					name="confirmPassword"
					autocomplete="new-password"
					required
					minlength="8"
					maxlength="128"
				/>

				{#if form?.errors?.confirmPassword}
					<span class="mt-2 text-sm text-error-700-300">
						{form.errors.confirmPassword}
					</span>
				{/if}
			</label>

			<div class="flex justify-end">
				<button
					type="submit"
					class="btn preset-filled-primary-500"
				>
					更新密碼
				</button>
			</div>
		</form>
	</section>
</div>
