<script lang="ts">
	type OptionValue = {
		id: string | null;
		content: string;
		isCorrect: boolean;
	};

	type Values = {
		prompt: string;
		options: OptionValue[];
	};

	type Errors = {
		prompt?: string;
		options?: string;
		optionContent?: Record<number, string>;
	};

	type LocalOption = OptionValue & {
		key: string;
	};

	type Props = {
		values: Values;
		errors?: Errors;
		message?: string;
		submitLabel: string;
		cancelHref?: string;
		formAction?: string;
		hiddenFields?: Record<string, string>;
		onDirtyChange?: (dirty: boolean) => void;
		onCancel?: () => void;
	};

	let {
		values,
		errors,
		message,
		submitLabel,
		cancelHref,
		formAction,
		hiddenFields = {},
		onDirtyChange,
		onCancel
	}: Props = $props();

	let nextKey = $state(0);
	let prompt = $state('');
	let options = $state<LocalOption[]>([]);
	let baseline = $state('');

	function fingerprint(
		promptValue: string,
		optionValues: Array<Pick<LocalOption, 'id' | 'content' | 'isCorrect'>>
	): string {
		return JSON.stringify({
			prompt: promptValue,
			options: optionValues.map((option) => ({
				id: option.id,
				content: option.content,
				isCorrect: option.isCorrect
			}))
		});
	}

	$effect(() => {
		const incoming = values;

		prompt = incoming.prompt;
		options = incoming.options.map(
			(option, index) => ({
				...option,
				key:
					option.id ??
					`new-${index}`
			})
		);
		nextKey = incoming.options.length;
		baseline = fingerprint(
			incoming.prompt,
			incoming.options
		);
	});

	let serializedOptions = $derived(
		JSON.stringify(
			options.map((option) => ({
				id: option.id,
				content: option.content,
				isCorrect: option.isCorrect
			}))
		)
	);

	let dirty = $derived(
		fingerprint(prompt, options) !== baseline
	);

	$effect(() => {
		onDirtyChange?.(dirty);
	});

	function addOption(): void {
		options.push({
			id: null,
			content: '',
			isCorrect: false,
			key: `new-${nextKey}`
		});

		nextKey += 1;
	}

	function removeOption(index: number): void {
		if (options.length <= 2) {
			return;
		}

		options.splice(index, 1);
	}

	function setCorrect(index: number): void {
		for (
			let current = 0;
			current < options.length;
			current += 1
		) {
			options[current].isCorrect =
				current === index;
		}
	}

	function moveOption(
		index: number,
		direction: -1 | 1
	): void {
		const target = index + direction;

		if (
			target < 0 ||
			target >= options.length
		) {
			return;
		}

		const current = options[index];
		options[index] = options[target];
		options[target] = current;
	}

	function optionLabel(index: number): string {
		return String.fromCharCode(
			65 + index
		);
	}
</script>

{#if message}
	<div
		class="card preset-tonal-error-500 mb-5 p-4 text-sm"
		role="alert"
	>
		{message}
	</div>
{/if}

<form
	method="POST"
	action={formAction}
	class="space-y-6"
>
	<input
		type="hidden"
		name="options"
		value={serializedOptions}
	/>

	{#each Object.entries(hiddenFields) as [name, value]}
		<input type="hidden" {name} {value} />
	{/each}

	<label class="label">
		<span class="label-text">
			題目內容
		</span>

		<textarea
			class="textarea min-h-32"
			name="prompt"
			rows="5"
			required
			bind:value={prompt}
		></textarea>

		{#if errors?.prompt}
			<span class="text-sm text-error-700-300">
				{errors.prompt}
			</span>
		{/if}
	</label>

	<section>
		<div
			class="mb-3 flex flex-wrap items-center justify-between gap-3"
		>
			<div>
				<h2 class="text-lg font-semibold">
					選項
				</h2>

				<p class="mt-1 text-sm opacity-60">
					至少 2 個選項，且必須且只能設定 1 個正確答案。
				</p>
			</div>

			<button
				type="button"
				class="btn preset-tonal-primary"
				onclick={addOption}
			>
				新增選項
			</button>
		</div>

		{#if errors?.options}
			<div
				class="card preset-tonal-error-500 mb-4 p-3 text-sm"
				role="alert"
			>
				{errors.options}
			</div>
		{/if}

		<div class="space-y-3">
			{#each options as option, index (option.key)}
				<article
					class="card preset-outlined p-4"
				>
					<div
						class="flex flex-col gap-3 sm:flex-row sm:items-start"
					>
						<div
							class="flex size-9 shrink-0 items-center justify-center rounded-full preset-tonal"
							aria-hidden="true"
						>
							{optionLabel(index)}
						</div>

						<div class="min-w-0 flex-1">
							<textarea
								class="textarea min-h-20 w-full"
								rows="3"
								placeholder={`選項 ${optionLabel(index)}`}
								bind:value={option.content}
							></textarea>

							{#if errors?.optionContent?.[index]}
								<p
									class="mt-1 text-sm text-error-700-300"
								>
									{errors.optionContent[index]}
								</p>
							{/if}

							<label
								class="mt-3 flex cursor-pointer items-center gap-2 text-sm"
							>
								<input
									type="radio"
									name="correctOptionPreview"
									checked={option.isCorrect}
									onchange={() => setCorrect(index)}
								/>

								<span>正確答案</span>
							</label>
						</div>

						<div
							class="flex shrink-0 flex-wrap gap-2 sm:flex-col"
						>
							<button
								type="button"
								class="btn preset-tonal"
								disabled={index === 0}
								onclick={() => moveOption(index, -1)}
							>
								上移
							</button>

							<button
								type="button"
								class="btn preset-tonal"
								disabled={index === options.length - 1}
								onclick={() => moveOption(index, 1)}
							>
								下移
							</button>

							<button
								type="button"
								class="btn preset-tonal-error"
								disabled={options.length <= 2}
								onclick={() => removeOption(index)}
							>
								刪除
							</button>
						</div>
					</div>
				</article>
			{/each}
		</div>

		<p class="mt-3 text-xs opacity-60">
			新增或刪除選項會使此題庫正在進行中的 Practice 失效並要求重新開始；修改文字、正解或順序不會重置進度。
		</p>
	</section>

	<div
		class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"
	>
		{#if onCancel}
			<button
				type="button"
				class="btn preset-tonal"
				onclick={onCancel}
			>
				取消
			</button>
		{:else if cancelHref}
			<a
				href={cancelHref}
				class="btn preset-tonal"
			>
				取消
			</a>
		{/if}

		<button
			type="submit"
			class="btn preset-filled-primary-500"
		>
			{submitLabel}
		</button>
	</div>
</form>
