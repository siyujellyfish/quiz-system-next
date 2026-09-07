<script lang="ts">
	import {
		onMount
	} from 'svelte';

	import type {
		PageProps
	} from './$types';

	import { toaster } from '$lib/ui/toaster';

	type UsageWindow = {
		usedPercent: number;
		windowMinutes: number | null;
		resetsAt: string | null;
	};

	type Usage = {
		primary: UsageWindow | null;
		secondary: UsageWindow | null;
	};

	let {
		data,
		form
	}: PageProps = $props();

	let usage = $state<Usage | null>(
		data.chatgptConnection?.usage ?? null
	);
	let usageError = $state(
		data.chatgptConnection?.usageError ?? false
	);
	let usageUpdatedAt = $state<Date | string | null>(
		data.chatgptConnection?.usageUpdatedAt ?? null
	);
	let refreshingUsage = $state(false);
	let usageAvailable = $derived(
		Boolean(usage?.primary || usage?.secondary)
	);

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

	function formatUpdatedAt(
		updatedAt: Date | string | null
	) {
		if (!updatedAt) {
			return null;
		}

		return new Intl.DateTimeFormat(
			'zh-TW',
			{
				dateStyle: 'medium',
				timeStyle: 'short',
				timeZone: 'Asia/Taipei'
			}
		).format(new Date(updatedAt));
	}

	function formatPlanType(
		planType: string | null
	) {
		if (!planType) {
			return null;
		}

		return planType
			.split('_')
			.map((part) =>
				part.charAt(0).toUpperCase() +
				part.slice(1)
			)
			.join(' ');
	}

	async function refreshCodexUsage() {
		if (
			refreshingUsage ||
			!data.chatgptConnection
		) {
			return;
		}

		refreshingUsage = true;

		try {
			const response = await fetch(
				'/integrations/chatgpt/usage/refresh',
				{
					method: 'POST',
					headers: {
						accept: 'application/json'
					}
				}
			);
			const payload = await response.json() as {
				usage?: Usage;
				updatedAt?: string;
				error?: string;
			};

			if (!response.ok) {
				if (response.status === 409) {
					toaster.error({
						title: 'ChatGPT 連結已失效',
						description:
							payload.error ?? '請重新連結 ChatGPT。'
					});

					window.setTimeout(() => {
						window.location.reload();
					}, 900);
					return;
				}

				throw new Error(
					payload.error ??
						`無法取得 Codex 用量 (${response.status})`
				);
			}

			usage = payload.usage ?? null;
			usageError = false;
			usageUpdatedAt =
				payload.updatedAt ?? new Date().toISOString();

			toaster.success({
				title: 'Codex 用量已更新',
				description:
					'已從你的 ChatGPT / Codex 帳號取得最新用量。'
			});
		} catch (caughtError) {
			usageError = true;

			toaster.error({
				title: 'Codex 用量更新失敗',
				description:
					caughtError instanceof Error
						? caughtError.message
						: '暫時無法取得 Codex 用量，請稍後再試。'
			});
		} finally {
			refreshingUsage = false;
		}
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
					'已確認 ChatGPT 帳號；系統也會自動取得 Codex 用量。'
			});
		}

		if (data.chatgptDisconnected) {
			toaster.success({
				title: 'ChatGPT 已取消連結',
				description:
					'Vercel Sandbox 中的 Codex 登入資料已移除。'
			});
		}

		if (data.chatgptError) {
			const description =
				data.chatgptError === 'disconnectFailed'
					? '無法刪除 Vercel Sandbox 中的 ChatGPT 連結資料，Neon metadata 尚未移除。'
					: '無法完成 ChatGPT 連結，請稍後再試。';

			toaster.error({
				title: 'ChatGPT 操作失敗',
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
						ChatGPT 方案
					</dt>

					<dd class="mt-1 font-medium">
						{formatPlanType(
							data.chatgptConnection.planType
						) ?? '未提供'}
					</dd>
				</div>

				<div>
					<dt class="text-sm font-medium opacity-60">
						Codex 用量
					</dt>

					<dd class="mt-2">
						<div class="mb-3 flex flex-wrap items-center justify-between gap-3">
							<p class="text-sm opacity-60">
								連結成功時會自動取得；也可手動更新最新用量。
							</p>

							<button
								type="button"
								class="btn preset-tonal"
								disabled={refreshingUsage}
								onclick={refreshCodexUsage}
							>
								{refreshingUsage
									? '正在重新整理…'
									: '重新整理 Codex 用量'}
							</button>
						</div>

						{#if usageError}
							<p class="mb-3 text-sm text-warning-700-300">
								最新用量更新失敗；若下方仍有資料，顯示的是上一次成功取得的快照。
							</p>
						{/if}

						{#if usageAvailable && usage}
							<div class="space-y-3">
								{#if usage.primary}
									<div class="rounded-container bg-surface-100-900 p-3">
										<div class="flex flex-wrap items-center justify-between gap-2">
											<span class="font-medium">
												{formatUsageWindow(
													usage.primary.windowMinutes
												)}
											</span>
											<span class="font-semibold">
												{formatUsagePercent(
													usage.primary.usedPercent
												)}
											</span>
										</div>

										<p class="mt-1 text-sm opacity-60">
											重置時間：{formatResetAt(
												usage.primary.resetsAt
											)}（台北時間）
										</p>
									</div>
								{/if}

								{#if usage.secondary}
									<div class="rounded-container bg-surface-100-900 p-3">
										<div class="flex flex-wrap items-center justify-between gap-2">
											<span class="font-medium">
												{formatUsageWindow(
													usage.secondary.windowMinutes
												)}
											</span>
											<span class="font-semibold">
												{formatUsagePercent(
													usage.secondary.usedPercent
												)}
											</span>
										</div>

										<p class="mt-1 text-sm opacity-60">
											重置時間：{formatResetAt(
												usage.secondary.resetsAt
											)}（台北時間）
										</p>
									</div>
								{/if}
							</div>
						{:else}
							<p class="text-sm opacity-60">
								尚無 Codex 用量快照。按「重新整理 Codex 用量」即可取得最新資料。
							</p>
						{/if}

						{#if formatUpdatedAt(usageUpdatedAt)}
							<p class="mt-3 text-xs opacity-50">
								最後更新：{formatUpdatedAt(usageUpdatedAt)}（台北時間）
							</p>
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
				連結 ChatGPT 後，Quiz 的 AI 對話會使用該帳號自己的 Codex 額度。
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

					{#if data.chatgptConnection.planType}
						<p class="mt-1 text-sm opacity-60">
							ChatGPT {formatPlanType(
								data.chatgptConnection.planType
							)}
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
			{:else if !data.chatgptLoadError && data.chatgptConfigured}
				<a
					href="/integrations/chatgpt/connect"
					class="btn preset-filled-primary-500"
				>
					連結至 ChatGPT
				</a>
			{:else}
				<button
					type="button"
					class="btn preset-filled-primary-500 opacity-50"
					disabled
				>
					連結至 ChatGPT
				</button>
			{/if}
		</div>

		{#if data.chatgptLoadError}
			<p class="mt-4 text-sm text-warning-700-300">
				ChatGPT 連結資料庫尚未初始化或目前無法存取。請先對這個部署使用的 Neon 資料庫套用最新 migration。
			</p>
		{:else if !data.chatgptConnection && !data.chatgptConfigured}
			<p class="mt-4 text-sm text-warning-700-300">
				Vercel Sandbox 尚未可用，連結與個人 Codex 額度功能目前不可用。
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
