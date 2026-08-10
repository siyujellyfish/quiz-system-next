<script lang="ts">
	import { goto } from '$app/navigation';

	import ChevronDownIcon
		from '@lucide/svelte/icons/chevron-down';
	import HistoryIcon
		from '@lucide/svelte/icons/history';
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

		if (value === 'admin') {
			await goto('/admin');
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
				class="text-lg font-bold tracking-tight no-underline"
				aria-label="返回首頁"
			>
				Quiz System
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
								class="card isolate w-52 rounded-container border border-surface-200-800 bg-surface-50-950 p-1 shadow-2xl"
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
										class="rounded-lg px-3 py-2 text-sm hover:bg-surface-100-900"
									>
										<Menu.ItemText>個人資料</Menu.ItemText>
									</Menu.Item>

									<Menu.Item
										value="history"
										class="rounded-lg px-3 py-2 text-sm hover:bg-surface-100-900"
									>
										<HistoryIcon
											class="size-4"
											aria-hidden="true"
										/>
										<Menu.ItemText>測驗紀錄</Menu.ItemText>
									</Menu.Item>

									{#if user.isAdmin}
										<Menu.Item
											value="admin"
											class="rounded-lg px-3 py-2 text-sm hover:bg-surface-100-900"
										>
											<Menu.ItemText>管理後台</Menu.ItemText>
										</Menu.Item>
									{/if}
								</Menu.ItemGroup>

								<Menu.Separator />

								<Menu.Item
									value="logout"
									class="rounded-lg px-3 py-2 text-sm hover:bg-error-500/10 hover:text-error-700-300"
								>
									<Menu.ItemText>登出</Menu.ItemText>
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
