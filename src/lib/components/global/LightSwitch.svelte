<script lang="ts">
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SunIcon from '@lucide/svelte/icons/sun';
	import {
		Portal,
		Switch,
		Tooltip
	} from '@skeletonlabs/skeleton-svelte';
	import { onMount } from 'svelte';

	type Mode =
		| 'light'
		| 'dark';

	const STORAGE_KEY = 'mode';

	let checked = $state(false);

	function getStoredMode(): Mode | null {
		const mode =
			localStorage.getItem(
				STORAGE_KEY
			);

		return mode === 'light' ||
			mode === 'dark'
			? mode
			: null;
	}

	function getSystemMode(
		media: MediaQueryList
	): Mode {
		return media.matches
			? 'dark'
			: 'light';
	}

	function applyMode(
		mode: Mode
	): void {
		document.documentElement
			.setAttribute(
				'data-mode',
				mode
			);

		checked = mode === 'dark';
	}

	onMount(() => {
		const media =
			window.matchMedia(
				'(prefers-color-scheme: dark)'
			);

		const syncMode = () => {
			applyMode(
				getStoredMode() ??
					getSystemMode(media)
			);
		};

		const handleSystemChange = () => {
			if (!getStoredMode()) {
				applyMode(
					getSystemMode(media)
				);
			}
		};

		syncMode();

		media.addEventListener(
			'change',
			handleSystemChange
		);

		return () => {
			media.removeEventListener(
				'change',
				handleSystemChange
			);
		};
	});

	const onCheckedChange = (
		event: { checked: boolean }
	) => {
		const mode: Mode =
			event.checked
				? 'dark'
				: 'light';

		localStorage.setItem(
			STORAGE_KEY,
			mode
		);

		applyMode(mode);
	};
</script>

<Tooltip positioning={{ placement: 'bottom' }}>
	<Tooltip.Trigger>
		{#snippet element(attributes)}
			<span {...attributes} class="inline-flex items-center">
				<Switch {checked} {onCheckedChange}>
					<Switch.Control>
						<Switch.Thumb>
							<Switch.Context>
								{#snippet children(switch_)}
									{#if switch_().checked}
										<MoonIcon class="size-3" />
									{:else}
										<SunIcon class="size-3" />
									{/if}
								{/snippet}
							</Switch.Context>
						</Switch.Thumb>
					</Switch.Control>
					<Switch.HiddenInput />
				</Switch>
			</span>
		{/snippet}
	</Tooltip.Trigger>

	<Portal>
		<Tooltip.Positioner class="z-50">
			<Tooltip.Content
				class="card preset-filled-surface-950-50 p-2 text-xs shadow-xl"
			>
				{checked
					? '切換為亮色模式'
					: '切換為暗色模式'}
			</Tooltip.Content>
		</Tooltip.Positioner>
	</Portal>
</Tooltip>
