<script lang="ts">
	type Values = {
		name: string;
		slug: string;
		description: string;
	};

	type Errors = Partial<
		Record<keyof Values, string>
	>;

	type Props = {
		values: Values;
		errors?: Errors;
		message?: string;
		submitLabel: string;
		cancelHref: string;
		formAction?: string;
	};

	let {
		values,
		errors = {},
		message,
		submitLabel,
		cancelHref,
		formAction
	}: Props = $props();
</script>

{#if message}
	<div
		class="card preset-tonal-error-500 mb-6 p-4 text-sm"
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
	<label class="label">
		<span class="label-text">
			題庫名稱
		</span>

		<input
			class="input"
			class:border-error-500={Boolean(errors.name)}
			type="text"
			name="name"
			value={values.name}
			maxlength="128"
			autocomplete="off"
			required
		/>

		{#if errors.name}
			<span class="text-sm text-error-700-300">
				{errors.name}
			</span>
		{/if}
	</label>

	<label class="label">
		<span class="label-text">
			Slug
		</span>

		<input
			class="input font-mono"
			class:border-error-500={Boolean(errors.slug)}
			type="text"
			name="slug"
			value={values.slug}
			maxlength="64"
			pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
			placeholder="例如 csa-v2"
			autocomplete="off"
			required
		/>

		<span class="text-xs opacity-60">
			只能使用小寫英文字母、數字與連字號；此值會出現在公開題庫網址。
		</span>

		{#if errors.slug}
			<span class="text-sm text-error-700-300">
				{errors.slug}
			</span>
		{/if}
	</label>

	<label class="label">
		<span class="label-text">
			描述
		</span>

		<textarea
			class="textarea min-h-32"
			name="description"
			placeholder="題庫用途或內容說明"
		>{values.description}</textarea>

		{#if errors.description}
			<span class="text-sm text-error-700-300">
				{errors.description}
			</span>
		{/if}
	</label>

	<div
		class="flex flex-col-reverse gap-3 border-t border-surface-200-800 pt-6 sm:flex-row sm:justify-end"
	>
		<a
			href={cancelHref}
			class="btn preset-tonal"
		>
			取消
		</a>

		<button
			type="submit"
			class="btn preset-filled-primary-500"
		>
			{submitLabel}
		</button>
	</div>
</form>
