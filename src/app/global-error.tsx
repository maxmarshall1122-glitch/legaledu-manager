"use client";

import "./globals.css";

/**
 * Last-resort boundary (errors in the root layout). It cannot use the i18n
 * provider, so it shows both languages. No internal details are displayed.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="uz">
      <body className="min-h-screen">
        <main className="mx-auto max-w-xl px-4 py-16">
          <h1 className="font-serif text-2xl font-semibold">Xatolik yuz berdi · An error occurred</h1>
          <p className="mt-3 text-sm text-muted">
            Server xatosi. Administrator server jurnalini tekshirishi mumkin. · A server error occurred. The administrator can check the server logs.
          </p>
          <button type="button" onClick={reset} className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Qayta urinish · Try again
          </button>
        </main>
      </body>
    </html>
  );
}
