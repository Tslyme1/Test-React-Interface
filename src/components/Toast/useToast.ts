import { useCallback, useRef, useState } from 'react';
import type { ToastTone } from '@uralmash/design-system';

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<ToastTone | undefined>(undefined);
  const timer = useRef<number>();

  const showToast = useCallback((text: string, nextTone?: ToastTone) => {
    window.clearTimeout(timer.current);
    setMessage(text);
    setTone(nextTone);
    timer.current = window.setTimeout(() => setMessage(null), 3000);
  }, []);

  return { message, tone, showToast };
}
