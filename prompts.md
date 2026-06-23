👨‍💻

# Add Password validations

A password should follow the next rules:

- Minimum length of 8
- Maximum length (add an appropiate maximum validation, I am not sure on what the standard is)
  At least one of the following:
  - lowercase letter (`a-z`) — otherwise `passwordLowercase`
  - uppercase letter (`A-Z`) — otherwise `passwordUppercase`
  - digit (`0-9`) — otherwise `passwordDigit`
  - special character (anything that is not a letter or digit) — otherwise `passwordSpecial`

The front-end is using this function, maybe it could help:

```TYPESCRIPT
export function passwordStrengthValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value) return null;

    const errors: ValidationErrors = {};
    if (!/[a-z]/.test(value)) errors['passwordLowercase'] = true;
    if (!/[A-Z]/.test(value)) errors['passwordUppercase'] = true;
    if (!/\d/.test(value)) errors['passwordDigit'] = true;
    if (!/[^a-zA-Z\d]/.test(value)) errors['passwordSpecial'] = true;

    return Object.keys(errors).length ? errors : null;
  };
}
```

🤖

# Summary

Expanded the shared validatePassword helper in auth.service.ts — the single source of truth that both register and changePassword already call — so the new rules apply to registration and change-password automatically.

Rules enforced (mirroring the frontend's passwordStrengthValidator, same regexes):

- min 8 / max 72 characters
- at least one lowercase [a-z], one uppercase [A-Z], one digit \d, and one special char [^a-zA-Z\d]

## Changes:

- authConfig.ts — added passwordMaxLength: 72.
- auth.service.ts — validatePassword now checks length bounds + the four character classes.
- swagger.ts — updated RegisterInput and ChangePasswordInput password fields (added maxLength: 72, full rule descriptions, and fixed the RegisterInput example — "supersecret" would no longer have passed; now "Supersecret1!").
- README.md — added a reusable Password strength rules table; register and change-password now link to it.

## Three decisions worth flagging:

1. Max length = 72. You asked what the standard is — bcryptjs silently truncates input past 72 bytes, so anything longer is ignored and gives a false sense of strength. Capping at 72 makes the whole password meaningful. (Commented in authConfig.ts.)
2. Fail-fast, not aggregated. The frontend validator collects all broken rules at once; the backend follows this repo's existing validator style and throws the first broken rule as a 400. So a password missing both a digit and an uppercase letter returns one message at a time. The frontend already does the rich per-field validation, so the backend acts as the safety net — but if you'd prefer it to return all violations in one response, I can switch it to aggregate.
3. Error format. The codes you listed (passwordLowercase, etc.) are produced by the frontend validator itself. The backend returns human-readable strings in the standard error field (e.g. Field "password" must contain at least one uppercase letter), consistent with every other endpoint's envelope rather than echoing those codes. Let me know if you actually want the machine codes surfaced in the API response and I'll adjust the shape.
