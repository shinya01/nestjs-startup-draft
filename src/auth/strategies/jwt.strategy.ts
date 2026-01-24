import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy as JwtStrategyBase } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';
import type { SecretOrKeyProvider } from 'passport-jwt';
import { InvalidTokenException } from '../../common/exceptions';

interface Claim {
  sub: string;
  email: string;
  token_use: string;
  auth_time: number;
  iss: string;
  exp: number;
  username: string;
  client_id: string;
  'cognito:groups'?: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(JwtStrategyBase) {
  constructor(configService: ConfigService) {
    const jwksUri = configService.get<string>('jwt.jwksUri') || '';
    const audience = configService.get<string>('jwt.audience') || '';
    const issuer = configService.get<string>('jwt.issuer') || '';
    const jwksSecret: SecretOrKeyProvider = jwksRsa.passportJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri,
    });

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: jwksSecret,
      audience,
      issuer,
      algorithms: ['RS256'],
    });
  }

  validate(payload: Claim) {
    // Ensure the token is an access token
    if (payload.token_use !== 'access') {
      throw new InvalidTokenException();
    }
    // Basic validation of required claims
    if (!payload.sub || !payload.email) {
      throw new InvalidTokenException();
    }
    // req.user will be set to the return value of this method
    // You can customize the returned object as needed
    return {
      userId: payload.sub,
      email: payload.email,
      roles: payload['cognito:groups'] || [],
    };
  }
}
