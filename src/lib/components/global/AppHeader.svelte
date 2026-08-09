<script lang="ts">
	import ChevronDownIcon
		from '@lucide/svelte/icons/chevron-down';

	import LightSwitch
		from '$lib/components/global/LightSwitch.svelte';

	import type {
		SessionUser
	} from '$lib/types/auth';

	type Props = {
		user: SessionUser | null;
	};

	let {
		user
	}: Props = $props();

	let avatarLabel =
		$derived(
			user?.username
				.trim()
				.charAt(0)
				.toUpperCase() ||
				'?'
		);
</script>

<header
	class="sticky top-0 z-40 h-16 border-b border-surface-200-800 bg-surface-50-950"
>
	<div
		class="mx-auto flex h-full w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6"
	>
		<a
			href="/"
			class="text-lg font-bold tracking-tight no-underline md:text-xl"
			aria-label="返回首頁"
		>
			Quiz System
		</a>

		<div class="flex items-center gap-3">
			<LightSwitch />

			{#if user}
				<details class="relative">
					<summary
						class="flex cursor-pointer list-none items-center gap-2 rounded-lg p-1.5 transition hover:bg-surface-100-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
						aria-label="開啟使用者選單"
					>
						<span
							class="preset-filled-primary-500 flex size-9 items-center justify-center rounded-full font-semibold"
							aria-hidden="true"
						>
							{avatarLabel}
						</span>

						<span
							class="hidden max-w-40 truncate text-sm font-medium sm:block"
						>
							{user.username}
						</span>

						<ChevronDownIcon
							class="hidden size-4 opacity-60 sm:block"
							aria-hidden="true"
						/>
					</summary>

					<div
						class="absolute right-0 mt-2 w-52 overflow-hidden rounded-container border border-surface-200-800 bg-surface-50-950 p-1 shadow-xl"
					>
						<div
							class="border-b border-surface-200-800 px-3 py-2"
						>
							<p class="truncate text-sm font-semibold">
								{user.username}
							</p>

							<p class="mt-0.5 text-xs opacity-60">
								{user.isAdmin
									? '管理員帳號'
									: '使用者帳號'}
							</p>
						</div>

						<a
							href="/profile"
							class="block rounded-lg px-3 py-2 text-sm no-underline transition hover:bg-surface-100-900"
						>
							個人資料
						</a>

						{#if user.isAdmin}
							<a
								href="/admin"
								class="block rounded-lg px-3 py-2 text-sm no-underline transition hover:bg-surface-100-900"
							>
								管理後台
							</a>
						{/if}

						<div
							class="my-1 border-t border-surface-200-800"
						></div>

						<form
							method="POST"
							action="/logout"
						>
							<button
								type="submit"
								class="w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-error-500/10 hover:text-error-700-300"
							>
								登出
							</button>
						</form>
					</div>
				</details>
			{:else}
				<a
					href="/login"
					class="btn preset-tonal-primary"
				>
					登入
				</a>
			{/if}
		</div>
	</div>
</header>

<style>
	summary::-webkit-details-marker {
		display: none;
	}
</style>
