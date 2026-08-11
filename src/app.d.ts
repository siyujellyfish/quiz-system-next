import type {
	SessionUser
} from '$lib/types/auth';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface PageState {}
		// interface Platform {}

		interface Locals {
			user: SessionUser | null;
		}

		interface PageData {
			user?: SessionUser | null;
		}
	}
}

export {};
