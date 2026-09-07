import {
	createHmac,
	timingSafeEqual
} from 'node:crypto';

export type AiContextMode =
	| 'practice'
	| 'wrong'
	| 'exam';

export type AiContextTokenPayload = {
	version: 1;
	userId: string;
	questionId: string;
	selectedOptionId: string | null;
	mode: AiContextMode;
	examAttemptId: string | null;
	issuedAt: number;
	expiresAt: number;
};

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function sign(
	encodedPayload: string,
	sessionTokenHash: string
) {
	return createHmac(
		'sha256',
		sessionTokenHash
	)
		.update(encodedPayload, 'utf8')
		.digest('base64url');
}

export function issueAiContextToken(input: {
	sessionTokenHash: string;
	userId: string;
	questionId: string;
	selectedOptionId: string | null;
	mode: AiContextMode;
	examAttemptId?: string | null;
	now?: number;
}) {
	const issuedAt = input.now ?? Date.now();
	const payload: AiContextTokenPayload = {
		version: 1,
		userId: input.userId,
		questionId: input.questionId,
		selectedOptionId:
			input.selectedOptionId,
		mode: input.mode,
		examAttemptId:
			input.examAttemptId ?? null,
		issuedAt,
		expiresAt:
			issuedAt + TOKEN_TTL_MS
	};
	const encodedPayload = Buffer.from(
		JSON.stringify(payload),
		'utf8'
	).toString('base64url');

	return `${encodedPayload}.${sign(
		encodedPayload,
		input.sessionTokenHash
	)}`;
}

function isValidPayload(
	value: unknown,
	now: number
): value is AiContextTokenPayload {
	if (
		typeof value !== 'object' ||
		value === null ||
		Array.isArray(value)
	) {
		return false;
	}

	const payload = value as Record<
		string,
		unknown
	>;
	const mode = payload.mode;

	return (
		payload.version === 1 &&
		typeof payload.userId === 'string' &&
		payload.userId.length > 0 &&
		typeof payload.questionId === 'string' &&
		payload.questionId.length > 0 &&
		(
			payload.selectedOptionId === null ||
			typeof payload.selectedOptionId ===
				'string'
		) &&
		(
			mode === 'practice' ||
			mode === 'wrong' ||
			mode === 'exam'
		) &&
		(
			payload.examAttemptId === null ||
			typeof payload.examAttemptId ===
				'string'
		) &&
		typeof payload.issuedAt === 'number' &&
		Number.isFinite(payload.issuedAt) &&
		typeof payload.expiresAt === 'number' &&
		Number.isFinite(payload.expiresAt) &&
		payload.expiresAt > now &&
		payload.expiresAt > payload.issuedAt &&
		payload.expiresAt - payload.issuedAt <=
			TOKEN_TTL_MS
	);
}

export function verifyAiContextToken(input: {
	token: string;
	sessionTokenHash: string;
	userId: string;
	questionId: string;
	now?: number;
}): AiContextTokenPayload | null {
	const [
		encodedPayload,
		providedSignature,
		...rest
	] = input.token.split('.');

	if (
		!encodedPayload ||
		!providedSignature ||
		rest.length > 0
	) {
		return null;
	}

	const expectedSignature = sign(
		encodedPayload,
		input.sessionTokenHash
	);
	const expectedBuffer = Buffer.from(
		expectedSignature,
		'utf8'
	);
	const providedBuffer = Buffer.from(
		providedSignature,
		'utf8'
	);

	if (
		expectedBuffer.length !==
			providedBuffer.length ||
		!timingSafeEqual(
			expectedBuffer,
			providedBuffer
		)
	) {
		return null;
	}

	let payload: unknown;

	try {
		payload = JSON.parse(
			Buffer.from(
				encodedPayload,
				'base64url'
			).toString('utf8')
		);
	} catch {
		return null;
	}

	if (
		!isValidPayload(
			payload,
			input.now ?? Date.now()
		) ||
		payload.userId !== input.userId ||
		payload.questionId !==
			input.questionId
	) {
		return null;
	}

	return payload;
}
