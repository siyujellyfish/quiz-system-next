<script lang="ts">
	import {
		Collapsible,
		Dialog,
		Portal
	} from '@skeletonlabs/skeleton-svelte';

	import type {
		PageProps
	} from './$types';

	import BankForm
		from '$lib/components/admin/BankForm.svelte';
	import { toaster } from '$lib/ui/toaster';

	let {
		data,
		form
	}: PageProps = $props();

	let values = $derived({
		name:
			form?.values?.name ??
			data.bank.name,
		slug:
			form?.values?.slug ??
			data.bank.slug,
		description:
			form?.values?.description ??
			data.bank.description ?? ''
	});

	let updateToastShown = $state(false);

	$effect(() => {
		if (form?.updated && !updateToastShown) {
			toaster.success({
				title: '題庫已更新',
				description: '題庫資料已成功儲存。'
			});
			updateToastShown = true;
		} else if (!form?.updated) {
			updateToastShown = false;
		}
	});
</script>

<svelte:head>
	<title>{data.bank.name} | 題庫管理 | Quiz</title>
</svelte:head>

<div
	class="mx-auto w-full max-w-3xl p-4 md:p-6"
>
	<nav
		class="mb-4 text-sm opacity-60"
		aria-label="麵包屑"
	>
		<a href="/admin">管理後台</a>
		<span class="mx-2">/</span>
		<a href="/admin/banks">題庫管理</a>
		<span class="mx-2">/</span>
		<span>{data.bank.name}</span>
	</nav>

	<header
		class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
	>
		<div>
			<h1 class="text-3xl font-bold">
				編輯題庫
			</h1>

			<p class="mt-2 font-mono text-sm opacity-60">
				{data.bank.id}
			</p>
		</div>

		<a
			href={`/admin/banks/${data.bank.id}/questions`}
			class="btn preset-filled-primary-500"
		>
			管理題目
		</a>
	</header>

	<section
		class="mb-6 grid gap-3 sm:grid-cols-3"
		aria-label="題庫影響範圍"
	>
		<article
			class="card preset-outlined p-4"
		>
			<p class="text-sm opacity-60">
				題目
			</p>
			<p class="mt-1 text-2xl font-bold">
				{data.bank.questionCount}
			</p>
		</article>

		<article
			class="card preset-outlined p-4"
		>
			<p class="text-sm opacity-60">
				進行中練習
			</p>
			<p class="mt-1 text-2xl font-bold">
				{data.bank.practiceProgressCount}
			</p>
		</article>

		<article
			class="card preset-outlined p-4"
		>
			<p class="text-sm opacity-60">
				錯題紀錄
			</p>
			<p class="mt-1 text-2xl font-bold">
				{data.bank.wrongQuestionCount}
			</p>
		</article>
	</section>

	<section
		class="card preset-outlined p-5 md:p-6"
	>
		<BankForm
			{values}
			errors={form?.errors}
			message={form?.updated ? undefined : form?.message}
			submitLabel="儲存變更"
			cancelHref="/admin/banks"
			formAction="?/update"
		/>
	</section>

	<section
		class="card preset-outlined mt-8 border-error-500/50 p-5 md:p-6"
	>
		<h2 class="text-xl font-semibold text-error-700-300">
			危險區域
		</h2>

		<p class="mt-2 text-sm opacity-70">
			刪除題庫會透過資料庫 cascade 一併刪除題目、選項、此題庫的練習進度，以及相關錯題紀錄，且無法復原。
		</p>

		<Collapsible class="mt-5">
			<Collapsible.Trigger
				class="btn preset-tonal-error"
			>
				我要刪除這個題庫
			</Collapsible.Trigger>

			<Collapsible.Content class="mt-4 space-y-4">
				<div
					class="card preset-tonal-error-500 p-4 text-sm"
				>
					<p class="font-semibold">
						刪除「{data.bank.name}」將影響：
					</p>

					<ul class="mt-2 list-disc space-y-1 pl-5">
						<li>
							{data.bank.questionCount} 道題目及其選項
						</li>
						<li>
							{data.bank.practiceProgressCount} 筆進行中練習
						</li>
						<li>
							{data.bank.wrongQuestionCount} 筆錯題紀錄
						</li>
					</ul>
				</div>

				<div class="flex justify-end">
					<Dialog role="alertdialog">
						<Dialog.Trigger
							class="btn preset-filled-error-500"
						>
							確認刪除題庫
						</Dialog.Trigger>

						<Portal>
							<Dialog.Backdrop
								class="fixed inset-0 z-50 bg-black/60"
							/>
							<Dialog.Positioner
								class="fixed inset-0 z-50 flex items-center justify-center p-4"
							>
								<Dialog.Content
									class="card w-full max-w-lg bg-surface-50-950 p-6 shadow-xl"
								>
									<Dialog.Title
										class="text-xl font-bold text-error-700-300"
									>
										永久刪除「{data.bank.name}」？
									</Dialog.Title>

									<Dialog.Description
										class="mt-3 text-sm opacity-70"
									>
										此操作無法復原，題目、選項、練習進度與錯題紀錄都會一併刪除。
									</Dialog.Description>

									<form
										method="POST"
										action="?/delete"
										class="mt-6 flex justify-end gap-3"
									>
										<Dialog.CloseTrigger
											type="button"
											class="btn preset-tonal"
										>
											取消
										</Dialog.CloseTrigger>

										<button
											type="submit"
											class="btn preset-filled-error-500"
										>
											永久刪除題庫
										</button>
									</form>
								</Dialog.Content>
							</Dialog.Positioner>
						</Portal>
					</Dialog>
				</div>
			</Collapsible.Content>
		</Collapsible>
	</section>
</div>
