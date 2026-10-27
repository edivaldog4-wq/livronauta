export function shouldIgnoreAsaasEvent(library: { plan: string; complimentary_access: boolean }) {
  return library.plan === "unlimited" || library.complimentary_access;
}

export function requiresProActivation(usage: { plan: string; status: string | null; complimentary_access?: boolean } | null | undefined) {
  return Boolean(usage && !usage.complimentary_access && usage.plan === "pro" && usage.status !== "active" && usage.status !== "overdue");
}