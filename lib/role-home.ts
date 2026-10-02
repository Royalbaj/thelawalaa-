// The Accounts app is a separate site with its own sign-in (accounts-app/).
export const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL || "https://accounts.thelawalaa.com";
// Where an accountant who signs in HERE gets sent: that site's login (this
// site's session isn't shared with it), with a note saying why.
export const ACCOUNTS_LOGIN = `${ACCOUNTS_URL}/login?from=main`;

export const ROLE_HOME: Record<string, string> = {
  super_admin: "/admin/dashboard",
  pos_user: "/admin",
  delivery_driver: "/delivery",
  customer: "/account",
  accountant: ACCOUNTS_LOGIN,
};
