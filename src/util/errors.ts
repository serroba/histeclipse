/** A readable message for anything a `catch` block can receive. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
