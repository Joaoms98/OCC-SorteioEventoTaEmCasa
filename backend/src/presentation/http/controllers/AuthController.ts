import type { RequestHandler } from 'express';
import type { AuthenticateAdmin } from '../../../application/use-cases/auth/AuthenticateAdmin.ts';
import { parseInput } from '../validation/parse.ts';
import { loginSchema } from '../validation/schemas.ts';

export class AuthController {
  constructor(private readonly authenticateAdmin: AuthenticateAdmin) {}

  login: RequestHandler = async (req, res) => {
    const input = parseInput(loginSchema, req.body);
    const { token, expiresInSeconds } = await this.authenticateAdmin.execute(input);
    res.json({ token, expiresIn: expiresInSeconds });
  };
}
