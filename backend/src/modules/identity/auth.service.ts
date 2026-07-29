import {
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { generateBase32Secret, otpauthUrl, verifyTotp } from './totp';

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

// UC-01: Đăng nhập và tạo phiên. UC-02 (một phần): trả hồ sơ quyền.
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateAndLogin(username: string, password: string, otp?: string) {
    const user = await this.users.findOne({ where: { username } });
    // Không tiết lộ lý do chi tiết gây lộ tài khoản.
    if (!user || user.status === 'EXPIRED') {
      throw new UnauthorizedException('AUTH-001: Sai thông tin đăng nhập');
    }
    // Khóa tạm thời do đăng nhập sai nhiều lần (423 Locked).
    if ((user.lockedUntil && user.lockedUntil.getTime() > Date.now()) || user.status === 'LOCKED') {
      throw new HttpException(
        'AUTH-004: Tài khoản tạm khóa do đăng nhập sai nhiều lần. Thử lại sau hoặc liên hệ quản trị.',
        423,
      );
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      const attempts = (user.failedAttempts ?? 0) + 1;
      const patch: Partial<User> = { failedAttempts: attempts };
      if (attempts >= MAX_ATTEMPTS) {
        patch.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
        patch.status = 'LOCKED';
      }
      await this.users.update({ id: user.id }, patch);
      throw new UnauthorizedException('AUTH-001: Sai thông tin đăng nhập');
    }
    // OTP (nếu tài khoản đã bật MFA).
    if (user.mfaSecret) {
      if (!otp) throw new UnauthorizedException('AUTH-005: Tài khoản yêu cầu mã OTP');
      if (!verifyTotp(user.mfaSecret, otp)) {
        throw new UnauthorizedException('AUTH-006: Mã OTP không đúng');
      }
    }
    if (user.failedAttempts > 0 || user.lockedUntil) {
      await this.users.update({ id: user.id }, { failedAttempts: 0, lockedUntil: null });
    }
    return this.issueTokens(user);
  }

  // Đăng ký OTP (TOTP) cho tài khoản hiện tại — trả bí mật + URI nạp Authenticator.
  async enrollMfa(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('DATA-001: Không tìm thấy người dùng');
    const secret = generateBase32Secret();
    user.mfaSecret = secret;
    await this.users.save(user);
    return { secret, otpauthUrl: otpauthUrl(secret, user.username), enabled: true };
  }

  async disableMfa(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('DATA-001: Không tìm thấy người dùng');
    user.mfaSecret = null;
    await this.users.save(user);
    return { enabled: false };
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
      dataScopes: user.dataScopes ?? [],
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
        // Phạm vi dữ liệu đã gán — để FE hiển thị chỉ báo read-only (lọc vẫn thực thi ở server).
        dataScopes: user.dataScopes ?? [],
      },
    };
  }
}
