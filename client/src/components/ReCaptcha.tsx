import { useEffect, useRef } from "react";

declare global {
  interface Window {
    grecaptcha?: any;
    __recaptchaOnLoad?: () => void;
  }
}

let scriptLoading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.grecaptcha && window.grecaptcha.render) return Promise.resolve();
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise<void>((resolve) => {
    const s = document.createElement("script");
    s.src = "https://www.google.com/recaptcha/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.onload = () => {
      const wait = () => {
        if (window.grecaptcha && window.grecaptcha.render) resolve();
        else setTimeout(wait, 50);
      };
      wait();
    };
    document.head.appendChild(s);
  });
  return scriptLoading;
}

/** Google reCAPTCHA v2 checkbox. Calls onChange with the token, or null on expiry. */
export function ReCaptcha({
  siteKey,
  onChange,
}: {
  siteKey: string;
  onChange: (token: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !ref.current || widgetId.current !== null) return;
      widgetId.current = window.grecaptcha.render(ref.current, {
        sitekey: siteKey,
        callback: (token: string) => onChange(token),
        "expired-callback": () => onChange(null),
        "error-callback": () => onChange(null),
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  return <div ref={ref} className="flex justify-center" />;
}
