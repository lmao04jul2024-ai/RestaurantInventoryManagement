import { Suspense } from 'react';
import OrderDetail from '@/components/shop/order-detail';

export const metadata = { title: 'Order — Restaurant' };

export default function CustomerOrderPage({ params }: { params: { id: string } }) {
  return (
    <Suspense>
      <OrderDetail id={params.id} />
    </Suspense>
  );
}