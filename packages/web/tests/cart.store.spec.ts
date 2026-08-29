import {
  useCartStore,
  cartLineKey,
  cartItemCount,
  cartSubtotal,
  type CartLine,
} from '@/store/cart.store';

const pizza = { menuItemId: 'item-1', name: 'Margherita', price: 10, image: null };
const salad = { menuItemId: 'item-2', name: 'Garden Salad', price: 6.5, image: null };

const lines = (): CartLine[] => useCartStore.getState().lines;

describe('cart store — Week 10 shopping cart (10.2)', () => {
  beforeEach(() => {
    useCartStore.getState().clear();
    localStorage.clear();
  });

  it('adds a new line with a default quantity of 1', () => {
    useCartStore.getState().addLine(pizza);

    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toMatchObject({ ...pizza, quantity: 1, specialInstructions: null });
  });

  it('merges repeated adds of the same item with identical instructions', () => {
    useCartStore.getState().addLine(pizza);
    useCartStore.getState().addLine({ ...pizza, quantity: 2 });

    expect(lines()).toHaveLength(1);
    expect(lines()[0].quantity).toBe(3);
  });

  it('keeps separate lines for the same item with different instructions', () => {
    useCartStore.getState().addLine(pizza);
    useCartStore.getState().addLine({ ...pizza, specialInstructions: 'no onions' });

    expect(lines()).toHaveLength(2);
  });

  it('caps merged quantities at 99', () => {
    useCartStore.getState().addLine({ ...pizza, quantity: 99 });
    useCartStore.getState().addLine(pizza);

    expect(lines()[0].quantity).toBe(99);
  });

  it('updateQuantity edits a line; zero drops it', () => {
    useCartStore.getState().addLine(pizza);
    useCartStore.getState().updateQuantity(pizza.menuItemId, null, 4);
    expect(lines()[0].quantity).toBe(4);

    useCartStore.getState().updateQuantity(pizza.menuItemId, null, 0);
    expect(lines()).toHaveLength(0);
  });

  it('removeLine deletes only the exact item+instructions line', () => {
    useCartStore.getState().addLine(pizza);
    useCartStore.getState().addLine({ ...pizza, specialInstructions: 'extra spicy' });

    useCartStore.getState().removeLine(pizza.menuItemId, 'extra spicy');

    expect(lines()).toHaveLength(1);
    expect(lines()[0].specialInstructions).toBeNull();
  });

  it('clear empties the cart', () => {
    useCartStore.getState().addLine(pizza);
    useCartStore.getState().addLine(salad);
    useCartStore.getState().clear();

    expect(lines()).toEqual([]);
  });

  it('cartLineKey distinguishes on trimmed instructions', () => {
    expect(cartLineKey('a', null)).toBe('a::');
    expect(cartLineKey('a', ' no onions ')).toBe('a::no onions');
  });

  it('cartItemCount sums quantities and cartSubtotal rounds cents', () => {
    useCartStore.getState().addLine({ ...pizza, quantity: 2 });
    useCartStore.getState().addLine(salad);

    expect(cartItemCount(lines())).toBe(3);
    // 2×10 + 6.5 → 26.5 exactly; float trap case via 0.1+0.2.
    expect(cartSubtotal(lines())).toBe(26.5);
    expect(cartSubtotal([{ ...pizza, price: 0.1, quantity: 1 }, { ...salad, price: 0.2, quantity: 1 }])).toBe(0.3);
  });
});