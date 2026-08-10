<script lang="ts">
	import {
		Dialog,
		Portal
	} from '@skeletonlabs/skeleton-svelte';
	import {
		BookOpen,
		Check,
		ChevronDown,
		Search
	} from '@lucide/svelte';

	type BankOption = {
		id: string;
		slug: string;
		name: string;
		description: string | null;
		questionCount: number;
	};

	type Props = {
		banks: BankOption[];
		selectedIndex: number;
		onSelect: (index: number) => void;
	};

	let {
		banks,
		selectedIndex,
		onSelect
	}: Props = $props();

	let searchValue = $state('');

	let selectedBank = $derived(
		banks[selectedIndex] ?? banks[0] ?? null
	);

	let filteredBanks = $derived.by(() => {
		const query = searchValue
			.trim()
			.toLocaleLowerCase();

		if (!query) {
			return banks.map(
				(bank, index) => ({ bank, index })
			);
		}

		return banks
			.map((bank, index) => ({ bank, index }))
			.filter(({ bank }) =>
				[
					bank.name,
					bank.slug,
					bank.description ?? ''
				]
					.join(' ')
					.toLocaleLowerCase()
					.includes(query)
			);
	});
</script>

{#if selectedBank}
	<Dialog>
		<Dialog.Trigger
			class="group flex w-full min-w-0 items-center gap-3 rounded-container border border-surface-300-700 bg-surface-100-900 px-4 py-3 text-left transition hover:border-primary-500 hover:bg-surface-200-800 sm:w-[22rem]"
			aria-label="選擇題庫"
		>
			<span
				class="flex size-10 shrink-0 items-center justify-center rounded-base bg-primary-500/10 text-primary-700-300"
			>
				<BookOpen size={20} aria-hidden="true" />
			</span>

			<span class="min-w-0 flex-1">
				<span class="flex items-center justify-between gap-3">
					<strong class="truncate">{selectedBank.name}</strong>
					<span class="shrink-0 text-xs font-semibold opacity-60">
						{selectedBank.questionCount} 題
					</span>
				</span>
				<span class="mt-0.5 block truncate text-xs opacity-55">
					{selectedBank.description || selectedBank.slug.toUpperCase()}
				</span>
			</span>

			<ChevronDown
				size={18}
				class="shrink-0 opacity-45 transition group-hover:opacity-80"
				aria-hidden="true"
			/>
		</Dialog.Trigger>

		<Portal>
			<Dialog.Backdrop
				class="fixed inset-0 z-50 bg-black/60"
			/>
			<Dialog.Positioner
				class="fixed inset-0 z-50 flex items-center justify-center p-4"
			>
				<Dialog.Content
					class="card w-full max-w-xl bg-surface-50-950 p-5 shadow-xl md:p-6"
				>
					<Dialog.Title class="flex items-center gap-2 text-xl font-bold">
						<BookOpen size={20} aria-hidden="true" />
						選擇題庫
					</Dialog.Title>
					<Dialog.Description class="mt-1 text-sm opacity-60">
						選擇要用於目前模式的題庫。
					</Dialog.Description>

					<label class="relative mt-5 block">
						<span class="sr-only">搜尋題庫</span>
						<Search
							size={17}
							class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-45"
							aria-hidden="true"
						/>
						<input
							type="search"
							class="input w-full pl-10"
							placeholder="搜尋名稱、代號或描述"
							bind:value={searchValue}
						/>
					</label>

					<div class="mt-4 max-h-[55vh] space-y-2 overflow-y-auto pr-1">
						{#if filteredBanks.length === 0}
							<p class="py-8 text-center text-sm opacity-60">
								沒有符合的題庫。
							</p>
						{:else}
							{#each filteredBanks as item (item.bank.id)}
								<Dialog.CloseTrigger
									type="button"
									class={`flex w-full items-start gap-3 rounded-container border px-4 py-3 text-left transition hover:border-primary-500 hover:bg-surface-100-900 ${item.index === selectedIndex ? 'border-primary-500' : 'border-surface-300-700'}`}
									onclick={() => onSelect(item.index)}
								>
									<span
										class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-base bg-surface-200-800"
									>
										<BookOpen size={17} aria-hidden="true" />
									</span>

									<span class="min-w-0 flex-1">
										<span class="flex items-center justify-between gap-3">
											<strong class="truncate">{item.bank.name}</strong>
											<span class="shrink-0 text-xs font-semibold opacity-60">
												{item.bank.questionCount} 題
											</span>
										</span>
										<span class="mt-1 block text-xs leading-relaxed opacity-55">
											{item.bank.description || item.bank.slug.toUpperCase()}
										</span>
									</span>

									{#if item.index === selectedIndex}
										<Check
											size={18}
											class="mt-1 shrink-0 text-primary-700-300"
											aria-hidden="true"
										/>
									{/if}
								</Dialog.CloseTrigger>
							{/each}
						{/if}
					</div>

					<div class="mt-5 flex justify-end">
						<Dialog.CloseTrigger
							type="button"
							class="btn preset-tonal"
						>
							關閉
						</Dialog.CloseTrigger>
					</div>
				</Dialog.Content>
			</Dialog.Positioner>
		</Portal>
	</Dialog>
{/if}
