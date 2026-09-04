import { Toast as DsToast } from '@uralmash/design-system';
import type { ToastTone } from '@uralmash/design-system';

export function Toast({ message, tone }: { message: string | null; tone?: ToastTone }) {
  return <DsToast message={message} tone={tone} />;
}
