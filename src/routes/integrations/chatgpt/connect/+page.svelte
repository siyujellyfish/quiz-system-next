<script lang="ts">
	import {
		onMount
	} from 'svelte';

	import type {
		PageProps
	} from './$types';

	let {
		data
	}: PageProps = $props();

	let statusText = $state(
		'等待你在 OpenAI 完成授權…'
	);
	let failed = $state(false);
	let polling = $state(false);

	async function copyUserCode() {
		await navigator.clipboard.writeText(
			data.login.userCode
		);
		statusText = '驗證碼已複製。完成授權後本頁會自動更新。';
	}

	async function pollLoginStatus() {
		if (polling || failed) {
			return;
		}

		polling = true;

		try {
			const response = await fetch(
				`/integrations/chatgpt/connect/status?loginId=${encodeURIComponent(
					data.login.loginId
				)}`,
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

			const payload = await response.json() as {
				status: 'pending' | 'succeeded' | 'failed';
				error: string | null;
			};

			if (payload.status === 'succeeded') {
				statusText = 'ChatGPT 已連結，正在返回個人資料…';
				window.location.assign(
					'/profile?chatgptLinked=1'
				);
				return;
			}

			if (payload.status === 'failed') {
				failed = true;
				statusText =
					payload.error ??
					'ChatGPT 授權失敗，請返回個人資料後重新連結。';
			}
		} catch (caughtError) {
			console.error(
				'Unable to check ChatGPT login status',
				caughtError
			);
			statusText = '暫時無法確認授權狀態，將自動重試。';
		} finally {
			polling = false;
		}
	}

	onMount(() => {
		void pollLoginStatus();

		const interval = window.setInterval(
			() => {
				void pollLoginStatus();
			},
			2000
		);

		return () => {
			window.clearInterval(interval);
		};
	});
</script>

<svelte:head>
	<title>連結 ChatGPT | Quiz</title>
</svelte:head>

<div
	class="mx-auto flex min-h-[70vh] w-full max-w-xl items-center p-4 md:p-6"
>
	<section
		class="card preset-outlined w-full p-6"
	>
		<header>
			<h1 class="text-2xl font-bold">
				連結 ChatGPT
			</h1>

			<p class="mt-2 opacity-60">
				使用 OpenAI Codex 的裝置授權流程。授權完成後，Quiz 的 AI 對話會使用你自己的 ChatGPT / Codex 額度。
			</p>
		</header>

		<div class="mt-6 space-y-5">
			<div>
				<p class="text-sm font-medium opacity-60">
					步驟 1
				</p>
				<a
					href={data.login.verificationUrl}
					target="_blank"
					rel="noreferrer"
					class="btn preset-filled-primary-500 mt-2"
				>
					前往 OpenAI 授權
				</a>
			</div>

			<div>
				<p class="text-sm font-medium opacity-60">
					步驟 2：輸入驗證碼
				</p>

				<div
					class="mt-2 flex flex-wrap items-center gap-3 rounded-container bg-surface-100-900 p-4"
				>
					<code class="text-xl font-bold tracking-widest">
						{data.login.userCode}
					</code>

					<button
						type="button"
						class="btn preset-tonal"
						onclick={copyUserCode}
					>
						複製
					</button>
				</div>
			</div>

			<div
				class="rounded-container p-4"
				class:preset-tonal-error-500={failed}
				class:preset-tonal-primary-500={!failed}
				role="status"
			>
				{statusText}
			</div>
		</div>

		<div class="mt-6">
			<a
				href="/profile"
				class="btn preset-tonal"
			>
				返回個人資料
			</a>
		</div>
	</section>
</div>
