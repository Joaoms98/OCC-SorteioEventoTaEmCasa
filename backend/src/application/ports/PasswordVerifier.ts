export interface PasswordVerifier {
  verify(password: string): boolean;
}
