"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
};

type CartState = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">) => void;
  setQty: (product_id: string, qty: number) => void;
  remove: (product_id: string) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) =>
        set((s) => {
          const found = s.items.find((i) => i.product_id === item.product_id);
          if (found)
            return {
              items: s.items.map((i) =>
                i.product_id === item.product_id
                  ? { ...i, quantity: Math.min(20, i.quantity + 1) }
                  : i
              ),
            };
          return { items: [...s.items, { ...item, quantity: 1 }] };
        }),
      setQty: (id, qty) =>
        set((s) => ({
          items:
            qty <= 0
              ? s.items.filter((i) => i.product_id !== id)
              : s.items.map((i) => (i.product_id === id ? { ...i, quantity: Math.min(20, qty) } : i)),
        })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.product_id !== id) })),
      clear: () => set({ items: [] }),
    }),
    { name: "tw-cart" } // prices here are display-only; server recalculates everything
  )
);
