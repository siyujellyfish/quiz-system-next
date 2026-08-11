<script lang="ts">
	import {
		ArrowLeft,
		ShieldCheck,
		Trash2,
		UserPlus,
		UsersRound
	} from '@lucide/svelte';

	import type {
		PageProps
	} from './$types';

	let {
		data,
		form
	}: PageProps = $props();

	let actionSucceeded = $derived(
		Boolean(
			form &&
			'success' in form &&
			form.success
		)
	);

	function confirmDelete(
		event: SubmitEvent,
		username: string
	): void {
		if (
			!window.confirm(
				`確定要刪除使用者「${username}」嗎？此操作會一併移除其登入工作階段與相關個人資料，且無法復原。`
			)
		) {
			event.preventDefault();
		}
	}
</script>

<svelte:head>
	<title>使用者管理 | Quiz System</title>
</svelte:head>

<div class="app-page max-w-6xl">
	<header
		class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
	>
		<div>
			<a
				href="/admin"
				class="mb-3 inline-flex items-center gap-2 text-sm font-medium opacity-65 transition hover:opacity-100"
			>
				<ArrowLeft size={16} aria-hidden="true" />
				返回管理後台
			</a>

			<div class="flex items-center gap-3">
				<span
					class="flex size-10 shrink-0 items-center justify-center rounded-base bg-primary-500/10 text-primary-700-300"
				>
					<UsersRound size={20} aria-hidden="true" />
				</span>
				<div>
					<p class="quiz-eyebrow">USER MANAGEMENT</p>
					<h1 class="mt-1 text-2xl font-bold">使用者管理</h1>
				</div>
			</div>

			<p class="mt-3 max-w-2xl text-sm opacity-60">
				新增或刪除帳號，並管理後台存取權限。目前登入帳號無法刪除或移除自己的管理員權限。
			</p>
		</div>

		<span class="badge preset-tonal-primary w-fit">
			共 {data.users.length} 個帳號
		</span>
	</header>

	{#if form?.message}
		<div
			class={`mb-5 rounded-container border p-4 text-sm ${
				actionSucceeded
					? 'border-success-500/35 bg-success-500/10 text-success-700-300'
					: 'border-error-500/35 bg-error-500/10 text-error-700-300'
			}`}
			role="status"
		>
			{form.message}
		</div>
	{/if}

	<section class="app-panel overflow-hidden">
		<header
			class="border-b border-surface-300-700 px-5 py-4 md:px-6"
		>
			<div class="flex items-center gap-2">
				<UserPlus
					size={18}
					class="text-primary-700-300"
					aria-hidden="true"
				/>
				<h2 class="text-lg font-semibold">新增使用者</h2>
			</div>
			<p class="mt-1 text-sm opacity-55">
				使用者名稱限英文、數字、底線與連字號；密碼長度需為 8 至 128 個字元。
			</p>
		</header>

		<form
			method="POST"
			action="?/create"
			class="grid gap-4 p-5 md:grid-cols-2 md:p-6"
		>
			<label class="label md:col-span-2">
				<span class="label-text">使用者名稱</span>
				<input
					class="input"
					type="text"
					name="username"
					autocomplete="off"
					required
					minlength="3"
					maxlength="64"
					pattern="[a-zA-Z0-9_-]+"
					placeholder="例如：user01"
				/>
			</label>

			<label class="label">
				<span class="label-text">密碼</span>
				<input
					class="input"
					type="password"
					name="password"
					autocomplete="new-password"
					required
					minlength="8"
					maxlength="128"
				/>
			</label>

			<label class="label">
				<span class="label-text">確認密碼</span>
				<input
					class="input"
					type="password"
					name="confirmPassword"
					autocomplete="new-password"
					required
					minlength="8"
					maxlength="128"
				/>
			</label>

			<div
				class="flex flex-col gap-4 md:col-span-2 sm:flex-row sm:items-center sm:justify-between"
			>
				<label
					class="flex cursor-pointer items-center gap-3 rounded-container border border-surface-300-700 px-4 py-3"
				>
					<input
						type="checkbox"
						name="isAdmin"
						class="checkbox"
					/>
					<span>
						<span class="block text-sm font-semibold">
							建立為管理員
						</span>
						<span class="block text-xs opacity-55">
							可存取題庫與使用者管理後台
						</span>
					</span>
				</label>

				<button
					type="submit"
					class="btn preset-filled-primary-500"
				>
					<UserPlus size={16} aria-hidden="true" />
					新增使用者
				</button>
			</div>
		</form>
	</section>

	<section class="app-panel mt-6 overflow-hidden">
		<header
			class="flex flex-wrap items-center justify-between gap-3 border-b border-surface-300-700 px-5 py-4 md:px-6"
		>
			<div>
				<h2 class="text-lg font-semibold">現有使用者</h2>
				<p class="mt-1 text-sm opacity-55">
					刪除帳號時，其工作階段、練習進度、錯題與測驗紀錄會依資料庫關聯一併清除。
				</p>
			</div>
		</header>

		<div class="divide-y divide-surface-300-700">
			{#each data.users as user (user.id)}
				<article
					class="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6"
				>
					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-2">
							<p class="truncate font-semibold">
								{user.username}
							</p>

							<span
								class="badge"
								class:preset-tonal-primary={user.isAdmin}
								class:preset-tonal={!user.isAdmin}
							>
								{#if user.isAdmin}
									<ShieldCheck size={13} aria-hidden="true" />
									管理員
								{:else}
									一般使用者
								{/if}
							</span>

							{#if user.id === data.currentUserId}
								<span class="badge preset-tonal-success">
									目前帳號
								</span>
							{/if}
						</div>

						<p class="mt-1 break-all font-mono text-xs opacity-40">
							{user.id}
						</p>
					</div>

					<div class="flex flex-wrap items-center gap-2">
						<form
							method="POST"
							action="?/setAdmin"
						>
							<input
								type="hidden"
								name="userId"
								value={user.id}
							/>
							<input
								type="hidden"
								name="isAdmin"
								value={user.isAdmin ? 'false' : 'true'}
							/>

							<button
								type="submit"
								class="btn preset-tonal"
								disabled={
									user.id === data.currentUserId &&
									user.isAdmin
								}
							>
								<ShieldCheck size={15} aria-hidden="true" />
								{user.isAdmin
									? user.id === data.currentUserId
										? '目前管理員'
										: '移除管理員'
									: '設為管理員'}
							</button>
						</form>

						<form
							method="POST"
							action="?/delete"
							onsubmit={(event) =>
								confirmDelete(
									event,
									user.username
								)}
						>
							<input
								type="hidden"
								name="userId"
								value={user.id}
							/>

							<button
								type="submit"
								class="btn preset-tonal-error-500"
								disabled={user.id === data.currentUserId}
							>
								<Trash2 size={15} aria-hidden="true" />
								刪除
							</button>
						</form>
					</div>
				</article>
			{/each}
		</div>
	</section>
</div>
