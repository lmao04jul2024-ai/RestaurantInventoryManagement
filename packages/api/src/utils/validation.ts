import Joi from 'joi';

export const registerSchema = Joi.object({
  email: Joi.string().email().max(255).required(),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .message('Password must contain at least one uppercase letter, one lowercase letter, and one number')
    .required(),
  firstName: Joi.string().trim().min(1).max(100).required(),
  lastName: Joi.string().trim().min(1).max(100).required(),
  phone: Joi.string().trim().max(20).allow('', null),
  tenantId: Joi.string().uuid().optional(), // fallback when no tenant context resolved
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  tenantId: Joi.string().uuid().optional(),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().min(32).required(),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .message('Password must contain at least one uppercase letter, one lowercase letter, and one number')
    .required(),
});

/**
 * Validates request body against a Joi schema.
 * Throws a structured error handled by the global error handler.
 */
export function validateBody<T>(schema: Joi.ObjectSchema<T>, body: unknown): T {
  const { error, value } = schema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
    const validationError = new Error(details.map((d) => `${d.field}: ${d.message}`).join('; '));
    (validationError as any).statusCode = 400;
    (validationError as any).code = 'VALIDATION_ERROR';
    (validationError as any).details = details;
    throw validationError;
  }

  return value;
}
