export const ADMIN_EMAILS = new Set([
    process.env.ADMIN1_EMAIL,
    process.env.ADMIN2_EMAIL
].map((email) => String(email || '').trim().toLowerCase()).filter(Boolean));

export const isAdminEmail = (email) => ADMIN_EMAILS.has(
    String(email || '').trim().toLowerCase()
);

export const isAdminUser = (user) => String(user?.role || '').toLowerCase() === 'admin';