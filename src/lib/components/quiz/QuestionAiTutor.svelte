<script lang="ts">
	import {
		page
	} from '$app/state';

	import type {
		PublicQuizQuestion,
		QuizAnswerResult
	} from '$lib/types/quiz';

	type ChatMessage = {
		role: 'user' | 'assistant';
		content: string;
	};

	type Props = {
		question: PublicQuizQuestion;
		answerResult: QuizAnswerResult;
	};

	let {
		question,
		answerResult
	}: Props = $props();

	let opened = $state(false);
	let input = $state('');
	let conversationId = $state<string | null>(null);
	let messages = $state<ChatMessage[]>([]);
	let sending = $state(false);
	let errorMessage = $state<string | null>(null);
	let connectRequired = $state(false);
	let activeQuestionId = $state(question.id);

	$effect(() => {
		if (activeQuestionId === question.id) {
			return;
		}

		activeQuestionId = question.id;
		opened = false;
		resetConversation();
	});

	function getOptionLabel(index: number) {
		return String.fromCharCode(65 + index);
	}

	function buildQuestionContext() {
		const options = question.options
			.map((option, index) => {
				const labels = [];

				if (
					answerResult.correctOptionIds.includes(
						option.id
					)
				) {
					labels.push('正確答案');
				}

				if (
					answerResult.selectedOptionId ===
					option.id
				) {
					labels.push('使用者選擇');
				}

				const suffix = labels.length > 0
					? ` [${labels.join('、')}]`
					: '';

				return `${getOptionLabel(index)}. ${option.content}${suffix}`;
			})
			.join('\n');

		return [
			'題目：',
			question.prompt,
			'',
			'選項：',
			options,
			'',
			`作答結果：${answerResult.correct ? '答對' : '答錯'}`,
			'',
			'題庫靜態解析：',
			answerResult.explanation?.trim() ||
				'此題目前沒有靜態解析。'
		].join('\n');
	}

	async function sendMessage() {
		const message = input.trim();

		if (!message || sending) {
			return;
		}

		input = '';
		errorMessage = null;
		connectRequired = false;
		messages = [
			...messages,
			{
				role: 'user',
				content: message
			}
		];
		sending = true;

		try {
			const response = await fetch(
				'/api/ai/chat',
				{
					method: 'POST',
					headers: {
						'content-type':
							'application/json'
					},
					body: JSON.stringify({
						conversationId,
						message,
						context: conversationId
							? null
							: buildQuestionContext()
					})
				}
			);

			const payload = await response.json() as {
				conversationId?: unknown;
				message?: unknown;
				error?: unknown;
			};

			if (!response.ok) {
				if (response.status === 409) {
					connectRequired = true;
				}

				throw new Error(
					typeof payload.error === 'string'
						? payload.error
						: 'AI 對話暫時無法使用。'
				);
			}

			if (
				typeof payload.conversationId !==
					'string' ||
				typeof payload.message !== 'string'
			) {
				throw new Error(
					'AI 回應格式不正確。'
				);
			}

			conversationId = payload.conversationId;
			messages = [
				...messages,
				{
					role: 'assistant',
					content: payload.message
				}
			];
		} catch (caughtError) {
			errorMessage =
				caughtError instanceof Error
					? caughtError.message
					: 'AI 對話暫時無法使用。';
		} finally {
			sending = false;
		}
	}

	function resetConversation() {
		conversationId = null;
		messages = [];
		input = '';
		errorMessage = null;
		connectRequired = false;
	}
</script>

{#if page.data.user}
	<div
		class="mt-5 border-t border-surface-300-700 pt-5"
	>
		{#if !opened}
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p class="font-semibold">
						還有疑問？
					</p>
					<p class="mt-1 text-sm opacity-60">
						使用你自己的 ChatGPT / Codex 額度針對這題繼續追問。
					</p>
				</div>

				<button
					type="button"
					class="btn preset-filled-primary-500"
					onclick={() => {
						opened = true;
					}}
				>
					詢問 AI
				</button>
			</div>
		{:else}
			<section
				class="rounded-container border border-surface-300-700 bg-surface-50-950 p-4"
				aria-label="AI 題目解析對話"
			>
				<header
					class="flex flex-wrap items-center justify-between gap-3"
				>
					<div>
						<h3 class="font-semibold">
							AI 題目助教
						</h3>
						<p class="mt-1 text-xs opacity-60">
							AI 回答可能有誤，請以題庫內容與可靠來源為準。
						</p>
					</div>

					<div class="flex gap-2">
						{#if messages.length > 0}
							<button
								type="button"
								class="btn preset-tonal"
								disabled={sending}
								onclick={resetConversation}
							>
								清除對話
							</button>
						{/if}

						<button
							type="button"
							class="btn preset-tonal"
							disabled={sending}
							onclick={() => {
								opened = false;
							}}
						>
							收合
						</button>
					</div>
				</header>

				{#if messages.length === 0}
					<div
						class="mt-4 rounded-container bg-surface-100-900 p-3 text-sm opacity-70"
					>
						你可以問「為什麼這個選項不對？」、「這個觀念怎麼記？」或要求 AI 用不同方式解釋。
					</div>
				{:else}
					<div
						class="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1"
						aria-live="polite"
					>
						{#each messages as message}
							<div
								class="rounded-container p-3 text-sm leading-relaxed"
								class:bg-primary-500/15={
									message.role === 'user'
								}
								class:bg-surface-100-900={
									message.role === 'assistant'
								}
							>
								<p class="mb-1 text-xs font-semibold opacity-60">
									{message.role === 'user'
										? '你'
										: 'AI 助教'}
								</p>
								<p class="whitespace-pre-wrap">
									{message.content}
								</p>
							</div>
						{/each}

						{#if sending}
							<div
								class="rounded-container bg-surface-100-900 p-3 text-sm opacity-60"
							>
								AI 正在思考…
							</div>
						{/if}
					</div>
				{/if}

				{#if errorMessage}
					<div
						class="mt-4 rounded-container preset-tonal-error-500 p-3 text-sm"
						role="alert"
					>
						<p>{errorMessage}</p>

						{#if connectRequired}
							<a
								href="/profile"
								class="btn preset-tonal mt-3"
							>
								前往個人資料連結 ChatGPT
							</a>
						{/if}
					</div>
				{/if}

				<form
					class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
					onsubmit={(event) => {
						event.preventDefault();
						void sendMessage();
					}}
				>
					<label class="label min-w-0 flex-1">
						<span class="label-text">
							追問題目
						</span>
						<textarea
							class="textarea min-h-24"
							bind:value={input}
							maxlength="8000"
							placeholder="輸入你不懂的地方…"
							disabled={sending}
						></textarea>
					</label>

					<button
						type="submit"
						class="btn preset-filled-primary-500"
						disabled={
							sending ||
							!input.trim()
						}
					>
						{sending ? '送出中…' : '送出'}
					</button>
				</form>
			</section>
		{/if}
	</div>
{/if}
