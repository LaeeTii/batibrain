import { getSupabaseClient } from './client';

export type AccountRequestInput = {
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
};

export type AccountRequestResult = {
  requestId: string | null;
  error: Error | null;
};

export async function submitAccountRequest(input: AccountRequestInput): Promise<AccountRequestResult> {
  try {
    const { data, error } = await getSupabaseClient().rpc('submit_account_creation_request', {
      request_email: input.email,
      request_display_name: input.displayName,
      request_first_name: input.firstName,
      request_last_name: input.lastName,
    });

    return {
      requestId: typeof data === 'string' ? data : null,
      error: error ? new Error(error.message) : null,
    };
  } catch (error) {
    return {
      requestId: null,
      error: error instanceof Error ? error : new Error('La demande de compte n’a pas pu être envoyée.'),
    };
  }
}
