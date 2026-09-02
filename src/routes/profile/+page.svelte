<script lang="ts">
	import {
		onMount
	} from 'svelte';

	import type {
		PageProps
	} from './$types';

	import { toaster } from '$lib/ui/toaster';

	let {
		data,
		form
	}: PageProps = $props();

	function formatUsagePercent(
		usedPercent: number
	) {
		const remaining = Math.max(
			0,
			100 - usedPercent
		);

		return `${remaining.toFixed(
			remaining % 1 === 0 ? 0 : 1
		)}% 可用`;
	}

	function formatUsageWindow(
		windowMinutes: number | null
	) {
		if (windowMinutes === null) {
			return '用量區間';
		}

		if (windowMinutes % 1440 === 0) {
			return `${windowMinutes / 1440} 天`;
		}

		if (windowMinutes % 60 === 0) {
			return `${windowMinutes / 60} 小時`;
		}

		return `${windowMinutes} 分鐘`;
	}

	function formatResetAt(
		resetsAt: string | null
	) {
		if (!resetsAt) {
			return '未提供';
		}

		return new Intl.DateTimeFormat(
			'zh-TW',
			{
				dateStyle: 'medium',
				timeStyle: 'short',
				timeZone: 'Asia/Taipei'
			}
		).format(
			new Date(resetsAt)
		);
	}

	onMount(() => {
		if (data.passwordChanged) {
			toaster.success({
				title: '密碼已更新',
				description:
					'其他裝置與瀏覽器的登入工作階段已登出。'
			});
		}

		if (data.chatgptLinked) {
			toaster.success({
				title: 'ChatGPT 已連結',
				description:
					'第三方帳號已成功連結。'
			});
		}

		if (data.chatgptDisconnected) {
			toaster.success({
				title: 'ChatGPT 已取消連結',
				description:
					'已移除 ChatGPT 帳號與授權憑證。'
			});
		}

		if (data.chatgptError) {
			const description =
				data.chatgptError === 'cancelled'
					? '你已取消 ChatGPT 授權。'
					: data.chatgptError === 'invalidCallback'
						? '授權回傳資料無效或已逾時，請重新連結。'
						: '無法完成 ChatGPT 連結，請稍後再試。';

			toaster.error({
				title: 'ChatGPT 連結失敗',
				description
			});
		}

		if (
			!data.passwordChanged &&
			!data.chatgptLinked &&
			!data.chatgptDisconnected &&
			!data.chatgptError
		) {
			return;
		}

		const url = new URL(window.location.href);

		for (const key of [
			'passwordChanged',
			'chatgptLinked',
			'chatgptDisconnected',
			'chatgptError'
		]) {
			url.searchParams.delete(key);
		}

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
			查看帳號資訊、第三方帳號與登入密碼。
		</p>
	</header>

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

			{#if data.chatgptConnection}
				<div>
					<dt class="text-sm font-medium opacity-60">
						Codex 用量
					</dt>

					<dd class="mt-2">
						{#if data.chatgptConnection.usageError}
							<p class="text-sm text-warning-700-300">
								暫時無法取得 Codex 用量。
							</p>
						{:else if !data.chatgptConnection.usageAvailable}
							<p class="text-sm opacity-60">
								此 ChatGPT 授權目前未提供 Codex 用量資料。
							</p>
						{:else if data.chatgptConnection.usage}
							<div class="space-y-3">
								{#if data.chatgptConnection.usage.primary}
									<div class="rounded-container bg-surface-100-900 p-3">
										<div class="flex flex-wrap items-center justify-between gap-2">
											<span class="font-medium">
												{formatUsageWindow(
													data.chatgptConnection.usage.primary.windowMinutes
												)}
											</span>
											<span class="font-semibold">
												{formatUsagePercent(
													data.chatgptConnection.usage.primary.usedPercent
												)}
											</span>
										</div>

										<p class="mt-1 text-sm opacity-60">
											重置時間：{formatResetAt(
												data.chatgptConnection.usage.primary.resetsAt
											)}（台北時間）
										</p>
									</div>
								{/if}

								{#if data.chatgptConnection.usage.secondary}
									<div class="rounded-container bg-surface-100-900 p-3">
										<div class="flex flex-wrap items-center justify-between gap-2">
											<span class="font-medium">
												{formatUsageWindow(
													data.chatgptConnection.usage.secondary.windowMinutes
												)}
											</span>
											<span class="font-semibold">
												{formatUsagePercent(
													data.chatgptConnection.usage.secondary.usedPercent
												)}
											</span>
										</div>

										<p class="mt-1 text-sm opacity-60">
											重置時間：{formatResetAt(
												data.chatgptConnection.usage.secondary.resetsAt
											)}（台北時間）
										</p>
									</div>
								{/if}
							</div>
						{/if}
					</dd>
				</div>
			{/if}
		</dl>
	</section>

	<section
		class="card preset-outlined mt-6 p-6"
	>
		<header>
			<h2 class="text-xl font-semibold">
				第三方帳號管理
			</h2>

			<p class="mt-2 text-sm opacity-60">
				管理 Quiz 可使用的第三方帳號授權。
			</p>
		</header>

		<div class="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<p class="font-semibold">
					ChatGPT
				</p>

				{#if data.chatgptConnection}
					<p class="mt-1 text-sm">
						{data.chatgptConnection.displayName}
					</p>

					{#if data.chatgptConnection.email && data.chatgptConnection.email !== data.chatgptConnection.displayName}
						<p class="mt-1 text-sm opacity-60">
							{data.chatgptConnection.email}
						</p>
					{/if}
				{:else}
					<p class="mt-1 text-sm opacity-60">
						尚未連結
					</p>
				{/if}
			</div>

			{#if data.chatgptConnection}
				<form
					method="POST"
					action="?/disconnectChatgpt"
				>
					<button
						type="submit"
						class="btn preset-tonal-error"
					>
						取消連接
					</button>
				</form>
			{:else}
				<a
					href="/integrations/chatgpt/connect"
					class="btn preset-filled-primary-500"
					class:opacity-50={!data.chatgptConfigured}
					aria-disabled={!data.chatgptConfigured}
				>
					連結至 ChatGPT
				</a>
			{/if}
		</div>

		{#if !data.chatgptConnection && !data.chatgptConfigured}
			<p class="mt-4 text-sm text-warning-700-300">
				ChatGPT OAuth 尚未完成伺服器設定，連結功能目前不可用。
			</p>
		{/if}
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
