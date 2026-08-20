type RoleAssignment = {
  companyRole: {
    permissions: {
      effect: string;
      permission: { code: string };
    }[];
  };
};

/**
 * একাধিক CompanyRole-এর permission assignment থেকে effective (ALLOW-but-not-DENY)
 * permission code-এর list বের করে — explicit-DENY সবসময় ALLOW-কে override করে,
 * ঠিক CompanyPermissionsGuard-এর মতোই semantics (guard নিজে এখানে touch করা
 * হয়নি — security-critical, ইতিমধ্যে working path; এই utility শুধু নতুন
 * "list all effective permissions" ব্যবহারের জন্য)।
 */
export function resolvePermissionEffects(
  assignments: RoleAssignment[],
): string[] {
  const effects = new Map<string, Set<string>>();

  for (const assignment of assignments) {
    for (const item of assignment.companyRole.permissions) {
      const set = effects.get(item.permission.code) ?? new Set<string>();
      set.add(item.effect);
      effects.set(item.permission.code, set);
    }
  }

  return [...effects.entries()]
    .filter(([, set]) => set.has('ALLOW') && !set.has('DENY'))
    .map(([code]) => code);
}
