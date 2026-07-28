import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';

// UC-01: Đăng nhập và tạo phiên. UC-02 (một phần): trả hồ sơ quyền.
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateAndLogin(username: string, password: string) {
    const user = await this.users.findOne({ where: { username } });
    // Không tiết lộ lý do chi tiết gây lộ tài khoản.
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('AUTH-001: Sai thông tin đăng nhập');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await this.users.increment({ id: user.id }, 'failedAttempts', 1);
      throw new UnauthorizedException('AUTH-001: Sai thông tin đăng nhập');
    }
    if (user.failedAttempts > 0) {
      await this.users.update({ id: user.id }, { failedAttempts: 0 });
    }
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
      const user = await this.users.findOne({ where: { id: payload.sub } });
      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedException('AUTH-001: Phiên không hợp lệ');
      }
      return this.issueTokens(user);
    } catch {
      throw new UnauthorizedException('AUTH-001: Refresh token không hợp lệ');
    }
  }

  private async issueTokens(user: User) {
    const payload = {
      sub: user.id,
      username: user.username,
      roles: user.roles,
      organizationId: user.organizationId,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.config.get<string>('jwt.accessTtl'),
      }),
      this.jwt.signAsync(
        { sub: user.id },
        {
          secret: this.config.get<string>('jwt.refreshSecret'),
          expiresIn: this.config.get<string>('jwt.refreshTtl'),
        },
      ),
    ]);
    return {
      accessToken,
      refreshToken,
      profile: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        roles: user.roles,
        organizationId: user.organizationId,
      },
    };
  }
}
