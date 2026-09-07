<script lang="ts">
	import {
		page
	} from '$app/state';
	import {
		tick
	} from 'svelte';

	import type {
		PublicQuizQuestion,
		QuizAnswerResult
	} from '$lib/types/quiz';

	import AiMarkdown
		from './AiMarkdown.svelte';

	type ChatMessage = {
		role: 'user' | 'assistant';
		content: string;
	};

	type UsageWindow = {
		usedPercent: number;
		windowMinutes: number | null;
		resetsAt: string | null;
	};

	type CachedUsage = {
		primary: UsageWindow | null;
		secondary: UsageWindow | null;
	};

	type AiStatus = {
		connected: boolean;
		planType: string | null;
		usage: CachedUsage | null;
		usageAvailable: boolean;
		usageError: boolean;
		usageUpdatedAt: string | null;
	};

	type ApiErrorPayload = {
		error?: unknown;
		code?: unknown;
		retryable?: unknown;
		resetAt?: unknown;
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
	let aiContextToken = $state<string | null>(
		answerResult.aiContextToken ?? null
	);
	let messages = $state<ChatMessage[]>([]);
	let sending = $state(false);
	let errorMessage = $state<string | null>(null);
	let retryable = $state(false);
	let lastFailedMessage = $state<string | null>(null);
	let connectionState = $state<
		'idle' | 'loading' | 'connected' | 'disconnected' | 'error'
	>('idle');
	let status = $state<AiStatus | null>(null);
	let activeQuestionId = $state(question.id);
	let messageScroller = $state<HTMLDivElement | null>(null);

	$effect(() => {
		if (activeQuestionId === question.id) {
			return;
		}

		activeQuestionId = question.id;
		opened = false;
		aiContextToken =
			answerResult.aiContextToken ?? null;
		resetConversation();
	});

	$effect(() => {
		messages.length;
		sending;
		errorMessage;
		void scrollToBottom();
	});

	async function scrollToBottom() {
		await tick();

		if (messageScroller) {
			messageScroller.scrollTop =
				messageScroller.scrollHeight;
		}
	}

	function getMessageClass(
		role: ChatMessage['role']
	) {
		return [
			'rounded-container',
			'p-3',
			'text-sm',
			'leading-relaxed',
			role === 'user'
				? 'bg-primary-500/15'
				: 'bg-surface-100-900'
		].join(' ');
	}

	function formatPlanType(
		planType: string | null
	) {
		if (!planType) {
			return null;
		}

		return planType
			.split('_')
			.map((part) =>
				part.charAt(0).toUpperCase() +
				part.slice(1)
			)
			.join(' ');
	}

	function formatUsageWindow(
		windowMinutes: number | null
	) {
		if (windowMinutes === null) {
			return '用量區間';
		}

		if (windowMinutes % 1440 === 0) {
			return `${windowMinutes / 1440} 天`;
		}

		if (windowMinutes % 60 === 0) {
			return `${windowMinutes / 60} 小時`;
		}

		return `${windowMinutes} 分鐘`;
	}

	function formatRemaining(
		usedPercent: number
	) {
		const remaining = Math.max(
			0,
			100 - usedPercent
		);

		return `${remaining.toFixed(
			remaining % 1 === 0 ? 0 : 1
		)}% 可用`;
	}

	function formatResetAt(
		value: string | null
	) {
		if (!value) {
			return null;
		}

		return new Intl.DateTimeFormat(
			'zh-TW',
			{
				dateStyle: 'medium',
				timeStyle: 'short',
				timeZone: 'Asia/Taipei'
			}
		).format(new Date(value));
	}

	function getQuickPrompts() {
		return [
			'為什麼正確答案是這個？',
			...(
				answerResult.correct
					? []
					: ['為什麼我選的答案不對？']
			),
			'幫我比較每個選項',
			'用更簡單的方式解釋',
			'給我一個記憶技巧',
			'出一題相似題讓我練習'
		];
	}

	async function loadConnectionStatus(
		showLoading = true
	) {
		if (showLoading) {
			connectionState = 'loading';
		}

		try {
			const response = await fetch(
				'/api/ai/status',
				{
					headers: {
						accept: 'application/json'
					}
				}
			);

			if (!response.ok) {
				throw new Error(
					`status request failed (${response.status})`
				);
			}

			status = await response.json() as AiStatus;
			connectionState = status.connected
				? 'connected'
				: 'disconnected';
		} catch (caughtError) {
			console.error(
				'Unable to load AskAI status',
				caughtError
			);

			if (showLoading || !status) {
				connectionState = 'error';
			}
		}
	}

	async function openTutor() {
		opened = true;

		if (
			connectionState === 'idle' ||
			connectionState === 'error'
		) {
			await loadConnectionStatus();
		}
	}

	async function ensureAiContextToken() {
		if (aiContextToken) {
			return aiContextToken;
		}

		const response = await fetch(
			'/api/ai/context-token',
			{
				method: 'POST',
				headers: {
					'content-type':
						'application/json',
					accept: 'application/json'
				},
				body: JSON.stringify({
					questionId: question.id
				})
			}
		);
		const payload = await response.json() as {
			aiContextToken?: unknown;
			error?: unknown;
		};

		if (
			!response.ok ||
			typeof payload.aiContextToken !==
				'string'
		) {
			throw new Error(
				typeof payload.error === 'string'
					? payload.error
					: '這一題的 AI 作答授權不存在或已過期，請重新作答後再試。'
			);
		}

		aiContextToken = payload.aiContextToken;
		return aiContextToken;
	}

	function getApiErrorMessage(
		payload: ApiErrorPayload,
		fallback: string
	) {
		const base =
			typeof payload.error === 'string'
				? payload.error
				: fallback;
		const resetAt =
			typeof payload.resetAt === 'string'
				? formatResetAt(payload.resetAt)
				: null;

		return resetAt
			? `${base} 預計重置：${resetAt}（台北時間）。`
			: base;
	}

	async function sendMessageText(
		text: string,
		appendUserMessage = true
	) {
		const message = text.trim();

		if (
			!message ||
			sending ||
			connectionState !== 'connected'
		) {
			return;
		}

		sending = true;
		errorMessage = null;
		retryable = false;
		lastFailedMessage = null;

		try {
			const contextToken = conversationId
				? null
				: await ensureAiContextToken();

			if (appendUserMessage) {
				messages = [
					...messages,
					{
						role: 'user',
						content: message
					}
				];
			}

			const response = await fetch(
				'/api/ai/chat',
				{
					method: 'POST',
					headers: {
						'content-type':
							'application/json',
						accept: 'application/json'
					},
					body: JSON.stringify({
						conversationId,
						questionId: question.id,
						aiContextToken:
							conversationId
								? null
								: contextToken,
						message
					})
				}
			);
			const payload = await response.json() as
				ApiErrorPayload & {
					conversationId?: unknown;
					message?: unknown;
				};

			if (!response.ok) {
				const code =
					typeof payload.code === 'string'
						? payload.code
						: null;

				if (
					code === 'CHATGPT_NOT_CONNECTED' ||
					code === 'CHATGPT_RELINK_REQUIRED'
				) {
					connectionState = 'disconnected';
					status = status
						? {
							...status,
							connected: false
						}
						: null;
				}

				if (
					code === 'CONVERSATION_NOT_FOUND'
				) {
					conversationId = null;
					retryable = true;
				}

				if (code === 'INVALID_AI_CONTEXT') {
					conversationId = null;
					aiContextToken = null;
				}

				retryable = retryable ||
					payload.retryable === true;
				lastFailedMessage = message;
				throw new Error(
					getApiErrorMessage(
						payload,
						'AI 題目助教暫時無法使用。'
					)
				);
			}

			if (
				typeof payload.conversationId !==
					'string' ||
				typeof payload.message !== 'string'
			) {
				lastFailedMessage = message;
				retryable = true;
				throw new Error(
					'AI 回應格式不正確，請重試。'
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
			input = '';
			lastFailedMessage = null;
			retryable = false;
			void loadConnectionStatus(false);
		} catch (caughtError) {
			errorMessage =
				caughtError instanceof Error
					? caughtError.message
					: 'AI 題目助教暫時無法使用。';

			if (!lastFailedMessage) {
				lastFailedMessage = message;
			}
		} finally {
			sending = false;
		}
	}

	async function sendMessage() {
		const message = input.trim();

		if (!message) {
			return;
		}

		input = '';
		await sendMessageText(message);
	}

	async function retryLastMessage() {
		if (!lastFailedMessage) {
			return;
		}

		await sendMessageText(
			lastFailedMessage,
			false
		);
	}

	async function copyAssistantMessage(
		content: string
	) {
		try {
			await navigator.clipboard.writeText(
				content
			);
		} catch (caughtError) {
			console.error(
				'Unable to copy AskAI response',
				caughtError
			);
		}
	}

	function resetConversation() {
		conversationId = null;
		messages = [];
		input = '';
		errorMessage = null;
		retryable = false;
		lastFailedMessage = null;
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
						void openTutor();
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
					class="flex flex-wrap items-start justify-between gap-3"
				>
					<div>
						<h3 class="font-semibold">
							AI 題目助教
						</h3>
						<p class="mt-1 text-xs opacity-60">
							AI 回答可能有誤，請以題庫內容與可靠來源為準。
						</p>

						{#if connectionState === 'connected' && status}
							<p class="mt-2 text-xs opacity-60">
								{#if status.planType}
									ChatGPT {formatPlanType(status.planType)} ·
								{/if}
								{#if status.usage?.primary}
									{formatUsageWindow(status.usage.primary.windowMinutes)} {formatRemaining(status.usage.primary.usedPercent)}
								{:else if status.usageError}
									用量資料可能不是最新
								{:else}
									Codex 用量尚未提供
								{/if}
							</p>
						{/if}
					</div>

					<div class="flex flex-wrap gap-2">
						{#if messages.length > 0}
							<button
								type="button"
								class="btn preset-tonal"
								disabled={sending}
								onclick={resetConversation}
							>
								新對話
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

				{#if connectionState === 'loading'}
					<div class="mt-4 rounded-container bg-surface-100-900 p-4 text-sm opacity-70">
						正在確認 ChatGPT 連結與最近一次 Codex 用量…
					</div>
				{:else if connectionState === 'disconnected'}
					<div class="mt-4 rounded-container preset-tonal-warning-500 p-4 text-sm">
						<p class="font-medium">
							需要先連結 ChatGPT
						</p>
						<p class="mt-1 opacity-70">
							AskAI 使用你自己的 ChatGPT / Codex 額度；連結完成後再回到這題即可使用。
						</p>
						<a
							href="/profile"
							class="btn preset-filled-primary-500 mt-3"
						>
							前往個人資料連結 ChatGPT
						</a>
					</div>
				{:else if connectionState === 'error'}
					<div class="mt-4 rounded-container preset-tonal-error-500 p-4 text-sm">
						<p>
							暫時無法確認 ChatGPT 連結狀態。
						</p>
						<button
							type="button"
							class="btn preset-tonal mt-3"
							onclick={() => {
								void loadConnectionStatus();
							}}
						>
							重新檢查
						</button>
					</div>
				{:else if connectionState === 'connected'}
					{#if messages.length === 0}
						<div class="mt-4">
							<p class="text-sm opacity-70">
								可以直接輸入問題，或從常用追問開始：
							</p>
							<div class="mt-3 flex flex-wrap gap-2">
								{#each getQuickPrompts() as prompt}
									<button
										type="button"
										class="btn preset-tonal text-left text-sm"
										disabled={sending}
										onclick={() => {
											void sendMessageText(prompt);
										}}
									>
										{prompt}
									</button>
								{/each}
							</div>
						</div>
					{/if}

					{#if messages.length > 0 || sending}
						<div
							bind:this={messageScroller}
							class="mt-4 max-h-[32rem] space-y-3 overflow-y-auto pr-1"
							aria-live="polite"
						>
							{#each messages as message, index}
								<div
									class={getMessageClass(message.role)}
								>
									<div class="mb-2 flex items-center justify-between gap-2">
										<p class="text-xs font-semibold opacity-60">
											{message.role === 'user'
												? '你'
												: 'AI 助教'}
										</p>

										{#if message.role === 'assistant'}
											<button
												type="button"
												class="btn preset-tonal px-2 py-1 text-xs"
												onclick={() => {
													void copyAssistantMessage(message.content);
												}}
											>
												複製
											</button>
										{/if}
									</div>

									{#if message.role === 'assistant'}
										<AiMarkdown content={message.content} />
									{:else}
										<p class="whitespace-pre-wrap break-words">
											{message.content}
										</p>
									{/if}
								</div>
							{/each}

							{#if sending}
								<div class="rounded-container bg-surface-100-900 p-3 text-sm opacity-60">
									AI 正在思考並準備回答…
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

							{#if connectionState === 'disconnected'}
								<a
									href="/profile"
									class="btn preset-tonal mt-3"
								>
									重新連結 ChatGPT
								</a>
							{:else if retryable && lastFailedMessage}
								<button
									type="button"
									class="btn preset-tonal mt-3"
									disabled={sending}
									onclick={() => {
										void retryLastMessage();
									}}
								>
									重試上一個問題
								</button>
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
				{/if}
			</section>
		{/if}
	</div>
{/if}
