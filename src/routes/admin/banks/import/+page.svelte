<script lang="ts">
	import FileIcon
		from '@lucide/svelte/icons/file';
	import { FileUpload } from '@skeletonlabs/skeleton-svelte';

	import type {
		ActionData
	} from './$types';

	let {
		form
	}: {
		form: ActionData;
	} = $props();
</script>

<svelte:head>
	<title>匯入題庫 | Quiz</title>
</svelte:head>

<div class="mx-auto w-full max-w-4xl p-4 md:p-6">
	<nav
		class="mb-4 text-sm opacity-60"
		aria-label="麵包屑"
	>
		<a href="/admin">管理後台</a>
		<span class="mx-2">/</span>
		<a href="/admin/banks">題庫管理</a>
		<span class="mx-2">/</span>
		<span>匯入題庫</span>
	</nav>

	<header class="mb-8">
		<h1 class="text-3xl font-bold">匯入題庫</h1>
		<p class="mt-2 max-w-2xl opacity-60">
			上傳完整題庫 JSON。檔案內需包含題庫名稱、slug、描述、題目、選項、正確答案與可選的靜態解析。
		</p>
	</header>

	<form
		method="POST"
		action="?/preview"
		enctype="multipart/form-data"
		class="card preset-outlined space-y-6 p-5 md:p-6"
	>
		{#if form?.message}
			<div
				class="card preset-tonal-error-500 p-4 text-sm"
				role="alert"
			>
				{form.message}
			</div>
		{/if}

		<div class="card preset-tonal p-4 text-sm">
			<p class="font-medium">JSON 格式</p>
			<pre class="mt-3 overflow-x-auto whitespace-pre-wrap text-xs opacity-80">{`{
  "version": 1,
  "bank": {
    "name": "CEH v13",
    "slug": "ceh-v13",
    "description": "..."
  },
  "questions": [
    {
      "prompt": "...",
      "explanation": "...",
      "options": [
        { "text": "...", "isCorrect": true }
      ]
    }
  ]
}`}</pre>
		</div>

		<FileUpload
			name="questionFile"
			accept={{
				'application/json': ['.json']
			}}
			maxFileSize={5 * 1024 * 1024}
			maxFiles={1}
			required
		>
			<FileUpload.Label class="label-text">
				完整題庫 JSON
			</FileUpload.Label>

			<FileUpload.Dropzone
				class="mt-2 flex min-h-40 flex-col items-center justify-center gap-3 rounded-container border border-dashed border-surface-300-700 p-6 text-center"
			>
				<FileIcon class="size-9 opacity-60" />
				<div>
					<p class="font-medium">拖放 JSON 檔案到這裡</p>
					<p class="mt-1 text-sm opacity-60">或從裝置選擇檔案</p>
				</div>
				<FileUpload.Trigger class="btn preset-tonal-primary">
					選擇檔案
				</FileUpload.Trigger>
				<FileUpload.HiddenInput />
			</FileUpload.Dropzone>

			<FileUpload.ItemGroup class="mt-3">
				<FileUpload.Context>
					{#snippet children(fileUpload)}
						{#each fileUpload().acceptedFiles as file (file.name)}
							<FileUpload.Item
								{file}
								class="card preset-tonal flex items-center gap-3 p-3"
							>
								<div class="min-w-0 flex-1">
									<FileUpload.ItemName class="truncate text-sm font-medium">
										{file.name}
									</FileUpload.ItemName>
									<FileUpload.ItemSizeText class="text-xs opacity-60">
										{file.size} bytes
									</FileUpload.ItemSizeText>
								</div>
								<FileUpload.ItemDeleteTrigger class="btn preset-tonal" />
							</FileUpload.Item>
						{/each}
					{/snippet}
				</FileUpload.Context>
			</FileUpload.ItemGroup>

			<FileUpload.ClearTrigger class="btn preset-tonal mt-3">
				清除檔案
			</FileUpload.ClearTrigger>

			<p class="mt-2 text-sm opacity-60">
				最大 5 MB。每題至少 2 個選項，且必須且只能有 1 個正確答案。explanation 可為字串或 null。
			</p>
		</FileUpload>

		<div class="flex flex-wrap justify-end gap-3">
			<a href="/admin/banks" class="btn preset-tonal">取消</a>
			<button type="submit" class="btn preset-filled-primary-500">
				驗證並預覽
			</button>
		</div>
	</form>

	{#if form?.preview && form?.payload}
		<section class="card preset-outlined mt-8 p-5 md:p-6">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h2 class="text-2xl font-semibold">匯入預覽</h2>
					<p class="mt-2 opacity-60">
						{form.preview.bank.name} · <span class="font-mono">{form.preview.bank.slug}</span>
					</p>
					{#if form.preview.bank.description}
						<p class="mt-1 text-sm opacity-60">{form.preview.bank.description}</p>
					{/if}
				</div>

				{#if form.mode === 'sync'}
					<span class="badge preset-tonal-warning-500">同步既有題庫</span>
				{:else}
					<span class="badge preset-tonal-success-500">建立新題庫</span>
				{/if}
			</div>

			{#if form.mode === 'sync'}
				<div class="card preset-tonal-warning-500 mt-5 p-4 text-sm">
					此 slug 已存在。匯入時會用「題幹＋選項內容」匹配既有題目，保留原 question UUID 與作答紀錄，並更新解析與正確答案；未匹配的新題目會新增，資料庫中額外的題目不會被刪除。
				</div>
			{/if}

			<div class="mt-6 grid gap-4 sm:grid-cols-3">
				<div class="card preset-tonal p-4">
					<p class="text-sm opacity-60">題目</p>
					<p class="mt-1 text-3xl font-bold">{form.preview.questionCount}</p>
				</div>
				<div class="card preset-tonal p-4">
					<p class="text-sm opacity-60">選項</p>
					<p class="mt-1 text-3xl font-bold">{form.preview.optionCount}</p>
				</div>
				<div class="card preset-tonal p-4">
					<p class="text-sm opacity-60">有解析</p>
					<p class="mt-1 text-3xl font-bold">{form.preview.explanationCount}</p>
				</div>
			</div>

			<div class="mt-6">
				<h3 class="font-semibold">前 {form.preview.sampleQuestions.length} 題預覽</h3>
				<div class="mt-3 grid gap-3">
					{#each form.preview.sampleQuestions as question, index}
						<article class="rounded-container bg-surface-100-900 p-4">
							<p class="text-xs opacity-50">
								#{index + 1} · {question.optionCount} 選項 · {question.hasExplanation ? '有解析' : '無解析'}
							</p>
							<p class="mt-2 line-clamp-3 font-medium">{question.prompt}</p>
						</article>
					{/each}
				</div>
			</div>

			<form method="POST" action="?/commit" class="mt-6 flex justify-end">
				<input type="hidden" name="payload" value={form.payload} />
				<button type="submit" class="btn preset-filled-primary-500">
					{form.mode === 'sync' ? '確認同步' : '確認匯入'} {form.preview.questionCount} 題
				</button>
			</form>
		</section>
	{/if}
</div>
