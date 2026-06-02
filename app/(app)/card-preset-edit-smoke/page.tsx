import { notFound } from 'next/navigation';
import CardPresetEditSmokeClient from './CardPresetEditSmokeClient';

export default function CardPresetEditSmokePage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <CardPresetEditSmokeClient />;
}
