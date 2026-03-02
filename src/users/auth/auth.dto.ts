export class AuthDto {
    email: string;
    password: string;
}

export class FirstLoginPasswordDto {
    onboardingToken: string;
    newPassword: string;
}
