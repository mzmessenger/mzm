export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: { status?: number; message: string } }
