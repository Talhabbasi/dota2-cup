export function paidRoleName() {
  return process.env.PAID_ROLE_NAME?.trim() || "Paid";
}

export function unpaidRoleName() {
  return process.env.UNPAID_ROLE_NAME?.trim() || "Unpaid";
}
