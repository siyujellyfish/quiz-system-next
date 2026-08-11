<script lang="ts">
	import { goto } from '$app/navigation';

	import ChartColumnIcon
		from '@lucide/svelte/icons/chart-column';
	import ChevronDownIcon
		from '@lucide/svelte/icons/chevron-down';
	import HistoryIcon
		from '@lucide/svelte/icons/history';
	import LogOutIcon
		from '@lucide/svelte/icons/log-out';
	import ShieldCheckIcon
		from '@lucide/svelte/icons/shield-check';
	import UserRoundIcon
		from '@lucide/svelte/icons/user-round';
	import UsersRoundIcon
		from '@lucide/svelte/icons/users-round';
	import {
		AppBar,
		Avatar,
		Menu,
		Portal
	} from '@skeletonlabs/skeleton-svelte';

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

	async function handleMenuSelect(
		value: string
	): Promise<void> {
		if (value === 'profile') {
			await goto('/profile');
			return;
		}

		if (value === 'history') {
			await goto('/history');
			return;
		}

		if (value === 'analytics') {
			await goto('/analytics');
			return;
		}

		if (value === 'admin') {
			await goto('/admin');
			return;
		}

		if (value === 'admin-users') {
			await goto('/admin/users');
			return;
		}

		if (value === 'logout') {
			const form = document.getElementById(
				'global-logout-form'
			);

			if (form instanceof HTMLFormElement) {
				form.requestSubmit();
			}
		}
	}
</script>

<AppBar
	class="sticky top-0 z-30 border-b border-surface-200-800 bg-surface-50-950"
>
	<AppBar.Toolbar
		class="mx-auto grid h-10 min-h-0 w-full max-w-6xl grid-cols-[1fr_auto] px-4 py-0 md:px-6"
	>
		<AppBar.Headline>
			<a
				href="/"
				class="inline-flex items-center gap-2 text-lg font-bold tracking-tight no-underline"
				aria-label="返回首頁"
			>
				<span
					class="relative size-6 shrink-0"
					aria-hidden="true"
				>
					<img
						src="/quiz-icon-light.svg"
						alt=""
						class="quiz-brand-icon-light absolute inset-0 size-full"
					/>
					<img
						src="/quiz-icon-dark.svg"
						alt=""
						class="quiz-brand-icon-dark absolute inset-0 size-full"
					/>
				</span>
				<span>Quiz System</span>
			</a>
		</AppBar.Headline>

		<AppBar.Trail class="justify-end gap-2">
			<LightSwitch />

			{#if user}
				<Menu
					positioning={{
						placement: 'bottom-end',
						gutter: 10
					}}
					onSelect={(details) =>
						handleMenuSelect(details.value)}
				>
					<Menu.Trigger
						class="flex items-center gap-2 rounded-lg p-1 transition hover:bg-surface-100-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
						aria-label="開啟使用者選單"
					>
						<Avatar class="size-8">
							<Avatar.Fallback
								class="preset-filled-primary-500 font-semibold"
							>
								{avatarLabel}
							</Avatar.Fallback>
						</Avatar>

						<span
							class="hidden max-w-40 truncate text-sm font-medium sm:block"
						>
							{user.username}
						</span>

						<Menu.Indicator>
							<ChevronDownIcon
								class="hidden size-4 opacity-60 sm:block"
								aria-hidden="true"
							/>
						</Menu.Indicator>
					</Menu.Trigger>

					<Portal>
						<Menu.Positioner
							class="z-100 overflow-visible [--z-index:100] pt-2"
						>
							<Menu.Content
								class="card isolate w-56 rounded-container border border-surface-200-800 bg-surface-50-950 p-1 shadow-2xl"
							>
								<Menu.ItemGroup>
									<Menu.ItemGroupLabel
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
									</Menu.ItemGroupLabel>

									<Menu.Item
										value="profile"
										class="flex w-full items-center justify-start gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-100-900"
									>
										<UserRoundIcon
											class="size-4 shrink-0 opacity-70"
											aria-hidden="true"
										/>
										<span class="flex-1 text-left">個人資料</span>
									</Menu.Item>

									<Menu.Item
										value="history"
										class="flex w-full items-center justify-start gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-100-900"
									>
										<HistoryIcon
											class="size-4 shrink-0 opacity-70"
											aria-hidden="true"
										/>
										<span class="flex-1 text-left">測驗紀錄</span>
									</Menu.Item>

									<Menu.Item
										value="analytics"
										class="flex w-full items-center justify-start gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-100-900"
									>
										<ChartColumnIcon
											class="size-4 shrink-0 opacity-70"
											aria-hidden="true"
										/>
										<span class="flex-1 text-left">學習統計</span>
									</Menu.Item>
								</Menu.ItemGroup>

								{#if user.isAdmin}
									<Menu.Separator />

									<Menu.ItemGroup>
										<Menu.Item
											value="admin"
											class="flex w-full items-center justify-start gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-100-900"
										>
											<ShieldCheckIcon
												class="size-4 shrink-0 opacity-70"
												aria-hidden="true"
											/>
											<span class="flex-1 text-left">管理後台</span>
										</Menu.Item>

										<Menu.Item
											value="admin-users"
											class="flex w-full items-center justify-start gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-100-900"
										>
											<UsersRoundIcon
												class="size-4 shrink-0 opacity-70"
												aria-hidden="true"
											/>
											<span class="flex-1 text-left">使用者管理</span>
										</Menu.Item>
									</Menu.ItemGroup>
								{/if}

								<Menu.Separator />

								<Menu.Item
									value="logout"
									class="flex w-full items-center justify-start gap-2 rounded-lg px-3 py-2 text-sm hover:bg-error-500/10 hover:text-error-700-300"
								>
									<LogOutIcon
										class="size-4 shrink-0 opacity-70"
										aria-hidden="true"
									/>
									<span class="flex-1 text-left">登出</span>
								</Menu.Item>
							</Menu.Content>
						</Menu.Positioner>
					</Portal>
				</Menu>

				<form
					id="global-logout-form"
					method="POST"
					action="/logout"
					class="hidden"
				></form>
			{:else}
				<a
					href="/login"
					class="btn preset-tonal-primary"
				>
					登入
				</a>
			{/if}
		</AppBar.Trail>
	</AppBar.Toolbar>
</AppBar>

<style>
	.quiz-brand-icon-dark {
		display: none;
	}

	:global(html[data-mode='dark'])
		.quiz-brand-icon-light {
		display: none;
	}

	:global(html[data-mode='dark'])
		.quiz-brand-icon-dark {
		display: block;
	}
</style>
