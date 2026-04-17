import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .max(128, 'Le mot de passe est trop long')
  .refine(
    (password) => /[A-Z]/.test(password),
    'Le mot de passe doit contenir au moins une lettre majuscule'
  )
  .refine(
    (password) => /[a-z]/.test(password),
    'Le mot de passe doit contenir au moins une lettre minuscule'
  )
  .refine(
    (password) => /[0-9]/.test(password),
    'Le mot de passe doit contenir au moins un chiffre'
  )
  .refine(
    (password) => /[^A-Za-z0-9]/.test(password),
    'Le mot de passe doit contenir au moins un caractère spécial'
  );

export type PasswordValidation = z.infer<typeof passwordSchema>;

export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const result = passwordSchema.safeParse(password);
  
  if (!result.success) {
    const errors = result.error.errors.map((err) => err.message);
    return { valid: false, errors };
  }
  
  return { valid: true, errors: [] };
}

export function calculatePasswordScore(password: string): {
  score: number; // 0-4
  strength: 'weak' | 'fair' | 'good' | 'strong';
  suggestions: string[];
} {
  const suggestions: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else suggestions.push('Au moins 8 caractères');

  if (/[a-z]/.test(password)) score++;
  else suggestions.push('Au moins une lettre minuscule');

  if (/[A-Z]/.test(password)) score++;
  else suggestions.push('Au moins une lettre majuscule');

  if (/[0-9]/.test(password)) score++;
  else suggestions.push('Au moins un chiffre');

  if (/[^A-Za-z0-9]/.test(password)) score++;
  else suggestions.push('Au moins un caractère spécial (!@#$%^&*...)');

  // Bonus for length
  if (password.length >= 12) score = Math.min(score + 1, 5);
  if (password.length >= 16) score = Math.min(score + 1, 5);

  let strength: 'weak' | 'fair' | 'good' | 'strong';
  if (score <= 2) strength = 'weak';
  else if (score === 3) strength = 'fair';
  else if (score === 4) strength = 'good';
  else strength = 'strong';

  return { score: Math.min(score, 5), strength, suggestions };
}
