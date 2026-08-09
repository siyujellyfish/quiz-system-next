<script lang="ts">
	import type {
		PageProps
	} from './$types';

	let {
		data
	}: PageProps = $props();
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
			查看目前登入帳號資訊。
		</p>
	</header>

	<section
		class="card preset-outlined p-6"
	>
		<dl class="space-y-5">
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
</div>
