import { BadRequestException } from '@nestjs/common';

import {
  FeatureConfigFieldDto,
  FeatureConfigFieldType,
} from './dto/feature-config-field.dto';

/**
 * Feature.configSchema তৈরি/আপডেট করার সময় business-rule validation
 * (class-validator decorator দিয়ে expressible নয়) — unique key, SELECT/MULTI_SELECT-এর
 * জন্য options আবশ্যক, min <= max, defaultValue-এর type field.type-এর সাথে মিলবে।
 */
export function normalizeConfigSchema(
  schema: FeatureConfigFieldDto[] | undefined,
): FeatureConfigFieldDto[] | undefined {
  if (schema === undefined) {
    return undefined;
  }

  const seenKeys = new Set<string>();
  const normalized: FeatureConfigFieldDto[] = [];

  for (const field of schema) {
    const key = field.key.trim();

    if (seenKeys.has(key)) {
      throw new BadRequestException(
        `Duplicate configuration field key "${key}"`,
      );
    }
    seenKeys.add(key);

    const isChoiceType =
      field.type === FeatureConfigFieldType.SELECT ||
      field.type === FeatureConfigFieldType.MULTI_SELECT;

    if (isChoiceType && (!field.options || field.options.length === 0)) {
      throw new BadRequestException(
        `Configuration field "${key}" of type ${field.type} requires at least one option`,
      );
    }

    if (
      field.min !== undefined &&
      field.max !== undefined &&
      field.min > field.max
    ) {
      throw new BadRequestException(
        `Configuration field "${key}" has min greater than max`,
      );
    }

    if (field.defaultValue !== undefined) {
      assertValueMatchesFieldType(key, field, field.defaultValue);
    }

    normalized.push({
      ...field,
      key,
      label: field.label.trim(),
    });
  }

  return normalized;
}

/**
 * PlanFeature.limits-এ submit করা value-গুলো assigned Feature-এর configSchema-এর
 * সাথে মিলছে কিনা validate করে — schema না থাকলে (backward-compatible generic mode)
 * কিছুই enforce করা হয় না।
 */
export function validatePlanFeatureLimits(
  configSchema: FeatureConfigFieldDto[] | null | undefined,
  limits: Record<string, unknown> | undefined,
): void {
  if (!configSchema || configSchema.length === 0) {
    return;
  }

  const submitted = limits ?? {};
  const allowedKeys = new Set(configSchema.map((field) => field.key));

  for (const key of Object.keys(submitted)) {
    if (!allowedKeys.has(key)) {
      throw new BadRequestException(`Unknown configuration field "${key}"`);
    }
  }

  for (const field of configSchema) {
    const value = submitted[field.key];

    if (value === undefined || value === null) {
      if (field.required) {
        throw new BadRequestException(
          `Configuration field "${field.label}" is required`,
        );
      }
      continue;
    }

    assertValueMatchesFieldType(field.key, field, value);

    if (field.type === FeatureConfigFieldType.NUMBER) {
      const num = value as number;

      if (field.min !== undefined && num < field.min) {
        throw new BadRequestException(
          `Configuration field "${field.label}" must be at least ${field.min}`,
        );
      }

      if (field.max !== undefined && num > field.max) {
        throw new BadRequestException(
          `Configuration field "${field.label}" must be at most ${field.max}`,
        );
      }
    }
  }
}

function assertValueMatchesFieldType(
  key: string,
  field: FeatureConfigFieldDto,
  value: unknown,
): void {
  switch (field.type) {
    case FeatureConfigFieldType.NUMBER:
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new BadRequestException(
          `Configuration field "${field.label ?? key}" must be a number`,
        );
      }
      return;

    case FeatureConfigFieldType.BOOLEAN:
      if (typeof value !== 'boolean') {
        throw new BadRequestException(
          `Configuration field "${field.label ?? key}" must be a boolean`,
        );
      }
      return;

    case FeatureConfigFieldType.STRING:
      if (typeof value !== 'string') {
        throw new BadRequestException(
          `Configuration field "${field.label ?? key}" must be a string`,
        );
      }
      return;

    case FeatureConfigFieldType.SELECT: {
      const allowed = new Set((field.options ?? []).map((o) => o.value));

      if (typeof value !== 'string' || !allowed.has(value)) {
        throw new BadRequestException(
          `Configuration field "${field.label ?? key}" must be one of the defined options`,
        );
      }
      return;
    }

    case FeatureConfigFieldType.MULTI_SELECT: {
      const allowed = new Set((field.options ?? []).map((o) => o.value));

      if (
        !Array.isArray(value) ||
        value.some((item) => typeof item !== 'string' || !allowed.has(item))
      ) {
        throw new BadRequestException(
          `Configuration field "${field.label ?? key}" must be an array of the defined options`,
        );
      }
      return;
    }
  }
}
