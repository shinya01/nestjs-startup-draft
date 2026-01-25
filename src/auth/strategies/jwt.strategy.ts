import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy as JwtStrategyBase } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';
import type { SecretOrKeyProvider } from 'passport-jwt';
import { InvalidTokenException } from '../../common/exceptions';
import { UserService } from 'src/user/user.service';
import {
  CognitoIdentityProviderClient,
  GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { UserDto } from 'src/user/dto/user.dto';

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
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {
    const disableAuth = configService.get<boolean>('app.authDisable');
    if (disableAuth) {
      // 認証無効モード：ダミー設定で初期化
      super({
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        ignoreExpiration: true,
        secretOrKey: 'dummy-secret', // 実際には使われない
      });
      return;
    }
    const jwksUri = configService.get<string>('jwt.jwksUri') || '';
    // const audience = configService.get<string>('jwt.audience') || ''; // Cognitoの場合、audienceチェックをしない
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
      // audience, // Cognitoの場合、audienceチェックをしない
      issuer,
      algorithms: ['RS256'],
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: Claim) {
    // req.user will be set to the return value of this method
    // You can customize the returned object as needed

    const sub = payload.sub;
    // Ensure the token is an access token
    if (!sub || payload.token_use !== 'access') {
      throw new InvalidTokenException();
    }
    // Cognito特有のクライアントID（audience）チェック
    const audience = this.configService.get<string>('jwt.audience') ?? '';
    if (payload.client_id !== audience) {
      throw new InvalidTokenException();
    }
    let user: UserDto | null = null;
    try {
      user = await this.userService.findByExternalId(sub);
    } catch {
      /* empty */
    }
    if (!user) {
      const client = new CognitoIdentityProviderClient({
        region: 'ap-northeast-1',
      });
      const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req) || '';
      const command = new GetUserCommand({
        AccessToken: token, // curlで取得した AccessToken をそのまま渡す
      });
      try {
        const response = await client.send(command);
        const email = response.UserAttributes?.find(
          (attr) => attr.Name === 'email',
        )?.Value;
        const name =
          response.UserAttributes?.find((attr) => attr.Name === 'name')
            ?.Value || email;
        if (!email || !name) {
          throw new InvalidTokenException();
        }
        user = await this.userService.findOrCreateByExternalId(
          sub,
          name,
          email,
        );
      } catch (error) {
        console.log(error);
        throw new InvalidTokenException();
      }
    }
    if (!user) {
      throw new InvalidTokenException();
    }

    return {
      userId: user.id,
      email: user.email,
      roles: payload['cognito:groups'] || [],
    };
  }
}
