export function getGuestPracticeStorageKey(
	slug: string
): string {
	return `quiz:guest-practice:${slug}`;
}