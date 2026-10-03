// A guest's delivery code is shown when they place the order and kept for
// this browser tab only (sessionStorage) — nothing about a guest's order is
// left on a shared phone once the tab is closed.
export const guestCodeKey = (orderId: string) => `tw-delivery-code:${orderId}`;
