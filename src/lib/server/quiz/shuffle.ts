import {
	randomInt
} from 'node:crypto';


export function shuffle<T>(
	items: readonly T[]
): T[] {
	const result = [...items];

	for (
		let index = result.length - 1;
		index > 0;
		index--
	) {
		const randomIndex = randomInt(
			0,
			index + 1
		);

		[
			result[index],
			result[randomIndex]
		] = [
			result[randomIndex],
			result[index]
		];
	}

	return result;
}