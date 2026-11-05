import { DriverHome } from '@/components/DriverHome';
import { PassengerHome } from '@/components/PassengerHome';
import { useMode } from '@/lib/mode';

/** One app, two modes (like inDrive): the session's role decides which home screen shows. */
export default function HomeScreen() {
  return useMode() === 'driver' ? <DriverHome /> : <PassengerHome />;
}
