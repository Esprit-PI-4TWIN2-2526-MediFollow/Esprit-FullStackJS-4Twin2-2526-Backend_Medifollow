export class AuthDto {
    email: string;
    password: string;
    twoFactorCode?: string;
}

export class FirstLoginPasswordDto {
    onboardingToken: string;
    newPassword: string;
}

export class TwoFactorVerifyDto {
    twoFactorToken: string;
    code: string;
}
