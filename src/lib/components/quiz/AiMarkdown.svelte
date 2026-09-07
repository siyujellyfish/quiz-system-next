<script lang="ts">
	type InlinePart = {
		type:
			| 'text'
			| 'code'
			| 'strong'
			| 'emphasis'
			| 'link';
		text: string;
		href?: string;
	};

	type MarkdownBlock =
		| {
			type: 'paragraph' | 'heading' | 'quote';
			level?: number;
			parts: InlinePart[];
		}
		| {
			type: 'unordered-list' | 'ordered-list';
			items: InlinePart[][];
		}
		| {
			type: 'code';
			language: string | null;
			content: string;
		};

	type Props = {
		content: string;
	};

	let {
		content
	}: Props = $props();

	function safeHref(
		value: string
	): string | null {
		try {
			const url = new URL(value);

			return url.protocol === 'http:' ||
				url.protocol === 'https:'
				? url.toString()
				: null;
		} catch {
			return null;
		}
	}

	function parseInline(
		text: string
	): InlinePart[] {
		const parts: InlinePart[] = [];
		const pattern =
			/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^\s)]+\))/g;
		let cursor = 0;

		for (const match of text.matchAll(pattern)) {
			const index = match.index ?? 0;
			const token = match[0];

			if (index > cursor) {
				parts.push({
					type: 'text',
					text: text.slice(cursor, index)
				});
			}

			if (
				token.startsWith('`') &&
				token.endsWith('`')
			) {
				parts.push({
					type: 'code',
					text: token.slice(1, -1)
				});
			} else if (
				token.startsWith('**') &&
				token.endsWith('**')
			) {
				parts.push({
					type: 'strong',
					text: token.slice(2, -2)
				});
			} else if (
				token.startsWith('*') &&
				token.endsWith('*')
			) {
				parts.push({
					type: 'emphasis',
					text: token.slice(1, -1)
				});
			} else {
				const linkMatch = token.match(
					/^\[([^\]]+)\]\(([^\s)]+)\)$/
				);
				const href = linkMatch
					? safeHref(linkMatch[2])
					: null;

				if (linkMatch && href) {
					parts.push({
						type: 'link',
						text: linkMatch[1],
						href
					});
				} else {
					parts.push({
						type: 'text',
						text: token
					});
				}
			}

			cursor = index + token.length;
		}

		if (cursor < text.length) {
			parts.push({
				type: 'text',
				text: text.slice(cursor)
			});
		}

		return parts.length > 0
			? parts
			: [
				{
					type: 'text',
					text
				}
			];
	}

	function isBlockStart(
		line: string
	) {
		return (
			line.startsWith('```') ||
			/^#{1,3}\s+/.test(line) ||
			/^>\s?/.test(line) ||
			/^[-*]\s+/.test(line) ||
			/^\d+\.\s+/.test(line)
		);
	}

	function parseMarkdown(
		value: string
	): MarkdownBlock[] {
		const lines = value
			.replace(/\r\n/g, '\n')
			.split('\n');
		const blocks: MarkdownBlock[] = [];
		let index = 0;

		while (index < lines.length) {
			const line = lines[index] ?? '';

			if (!line.trim()) {
				index += 1;
				continue;
			}

			if (line.startsWith('```')) {
				const language =
					line.slice(3).trim() || null;
				const codeLines: string[] = [];
				index += 1;

				while (
					index < lines.length &&
					!(lines[index] ?? '')
						.startsWith('```')
				) {
					codeLines.push(
						lines[index] ?? ''
					);
					index += 1;
				}

				if (index < lines.length) {
					index += 1;
				}

				blocks.push({
					type: 'code',
					language,
					content: codeLines.join('\n')
				});
				continue;
			}

			const heading = line.match(
				/^(#{1,3})\s+(.+)$/
			);

			if (heading) {
				blocks.push({
					type: 'heading',
					level: heading[1].length,
					parts: parseInline(heading[2])
				});
				index += 1;
				continue;
			}

			if (/^>\s?/.test(line)) {
				blocks.push({
					type: 'quote',
					parts: parseInline(
						line.replace(/^>\s?/, '')
					)
				});
				index += 1;
				continue;
			}

			if (/^[-*]\s+/.test(line)) {
				const items: InlinePart[][] = [];

				while (
					index < lines.length &&
					/^[-*]\s+/.test(
						lines[index] ?? ''
					)
				) {
					items.push(
						parseInline(
							(lines[index] ?? '')
								.replace(
									/^[-*]\s+/,
									''
								)
						)
					);
					index += 1;
				}

				blocks.push({
					type: 'unordered-list',
					items
				});
				continue;
			}

			if (/^\d+\.\s+/.test(line)) {
				const items: InlinePart[][] = [];

				while (
					index < lines.length &&
					/^\d+\.\s+/.test(
						lines[index] ?? ''
					)
				) {
					items.push(
						parseInline(
							(lines[index] ?? '')
								.replace(
									/^\d+\.\s+/,
									''
								)
						)
					);
					index += 1;
				}

				blocks.push({
					type: 'ordered-list',
					items
				});
				continue;
			}

			const paragraphLines = [line.trim()];
			index += 1;

			while (
				index < lines.length &&
				(lines[index] ?? '').trim() &&
				!isBlockStart(lines[index] ?? '')
			) {
				paragraphLines.push(
					(lines[index] ?? '').trim()
				);
				index += 1;
			}

			blocks.push({
				type: 'paragraph',
				parts: parseInline(
					paragraphLines.join(' ')
				)
			});
		}

		return blocks;
	}

	let blocks = $derived(
		parseMarkdown(content)
	);
</script>

{#snippet inline(parts: InlinePart[])}
	{#each parts as part}
		{#if part.type === 'code'}
			<code
				class="rounded bg-surface-200-800 px-1.5 py-0.5 font-mono text-[0.9em]"
			>
				{part.text}
			</code>
		{:else if part.type === 'strong'}
			<strong>{part.text}</strong>
		{:else if part.type === 'emphasis'}
			<em>{part.text}</em>
		{:else if part.type === 'link' && part.href}
			<a
				href={part.href}
				target="_blank"
				rel="noreferrer noopener"
				class="anchor"
			>
				{part.text}
			</a>
		{:else}
			{part.text}
		{/if}
	{/each}
{/snippet}

<div class="space-y-3 break-words leading-relaxed">
	{#each blocks as block}
		{#if block.type === 'code'}
			<div class="overflow-x-auto rounded-container bg-surface-950 p-3 text-surface-50">
				{#if block.language}
					<p class="mb-2 text-xs opacity-60">
						{block.language}
					</p>
				{/if}
				<pre class="whitespace-pre font-mono text-xs leading-relaxed"><code>{block.content}</code></pre>
			</div>
		{:else if block.type === 'unordered-list'}
			<ul class="list-disc space-y-1 pl-5">
				{#each block.items as item}
					<li>{@render inline(item)}</li>
				{/each}
			</ul>
		{:else if block.type === 'ordered-list'}
			<ol class="list-decimal space-y-1 pl-5">
				{#each block.items as item}
					<li>{@render inline(item)}</li>
				{/each}
			</ol>
		{:else if block.type === 'quote'}
			<blockquote class="border-l-4 border-surface-400-600 pl-3 opacity-80">
				{@render inline(block.parts)}
			</blockquote>
		{:else if block.type === 'heading'}
			<p
				class:font-bold={block.level === 1}
				class:font-semibold={block.level !== 1}
				class:text-lg={block.level === 1}
			>
				{@render inline(block.parts)}
			</p>
		{:else}
			<p>{@render inline(block.parts)}</p>
		{/if}
	{/each}
</div>
