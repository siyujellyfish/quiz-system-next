export function getGuestPracticeStorageKey(
	slug: string
): string {
	return `quiz:guest-practice:${slug}`;
}


export function getExamStorageKey(
	slug: string
): string {
	return `quiz:exam:${slug}`;
}
