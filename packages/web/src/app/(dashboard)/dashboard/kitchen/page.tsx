import KitchenBoard from '@/components/orders/kitchen-board';

export const metadata = { title: 'Kitchen Display — Restaurant Manager' };

export default function DashboardKitchenPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Kitchen display</h1>
        <p className="mt-1 text-sm text-content-muted">
          Live queue for the pass — work lines left to right, top to bottom.
        </p>
      </div>
      <KitchenBoard />
    </div>
  );
}
