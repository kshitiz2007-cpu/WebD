export type RestaurantProduct = {
  id: string;
  name: string;
  description: string;
  category: 'Mains' | 'Pizza' | 'Pasta' | 'Sides';
  price: number;
  image: string;
  badge?: string;
};

export const RESTAURANT_PRODUCTS: RestaurantProduct[] = [
  { id: 'truffle-ramen', name: 'Truffle Ramen', description: 'Silky broth, spring vegetables, chilli oil and a soft-boiled egg.', category: 'Mains', price: 349, image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1000&q=85', badge: 'Bestseller' },
  { id: 'garden-margherita', name: 'Garden Margherita', description: 'Stone-baked crust, fresh basil, mozzarella and slow-cooked tomato.', category: 'Pizza', price: 429, image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=1000&q=85' },
  { id: 'pesto-linguine', name: 'Pesto Linguine', description: 'Hand-tossed linguine with basil pesto, parmesan and toasted nuts.', category: 'Pasta', price: 389, image: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1000&q=85' },
  { id: 'firewood-pizza', name: 'Firewood Pizza', description: 'Crisp-edged pizza with roasted peppers, herbs and house cheese.', category: 'Pizza', price: 459, image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1000&q=85', badge: 'Chef’s pick' },
  { id: 'sesame-noodles', name: 'Sesame Noodles', description: 'Wok-tossed noodles, sesame, greens and a savoury house sauce.', category: 'Mains', price: 329, image: 'https://images.unsplash.com/photo-1569929238190-7c6f3c3d6c5d?auto=format&fit=crop&w=1000&q=85' },
  { id: 'garlic-bread', name: 'Herb Garlic Bread', description: 'Warm sourdough with roasted garlic butter and garden herbs.', category: 'Sides', price: 179, image: 'https://images.unsplash.com/photo-1619531040576-f9416740661b?auto=format&fit=crop&w=1000&q=85' },
];

export const formatINR = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
