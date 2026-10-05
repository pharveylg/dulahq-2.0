'use client';

import { useEffect, useState, useTransition } from 'react';
import { uploadBillingQr, removeBillingQr, getBillingQrUrl } from '@/lib/billing-qr-actions';

export default function BillingQrField({ accountId, canEdit }: { accountId: string; canEdit: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    getBillingQrUrl(accountId).then((r) => setUrl(r.url));
  }, [accountId, version]);
  const hasQr = url !== null;

  function handleUpload(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await uploadBillingQr(accountId, formData);
      if (result?.error) setError(result.error);
      else setVersion((v) => v + 1);
    });
  }

  function handleRemove() {
    if (!window.confirm('Remove the payment QR image? Payers will see only the written instructions.')) return;
    setError(null);
    startTransition(async () => {
      const result = await removeBillingQr(accountId);
      if (result?.error) setError(result.error);
      else setVersion((v) => v + 1);
    });
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Payment QR image</div>
      {url ? (
        <img src={url} alt="Payment QR code" style={{ width: 160, maxWidth: '100%', borderRadius: 8, background: '#fff' }} />
      ) : (
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>No QR uploaded.</p>
      )}
      {canEdit && (
        <form action={handleUpload} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="file" name="qr" accept="image/png,image/jpeg,image/webp" required />
          <button className="btn" type="submit" disabled={pending} style={{ fontSize: 12 }}>
            {pending ? 'Uploading…' : hasQr ? 'Replace QR' : 'Upload QR'}
          </button>
          {hasQr && (
            <button className="btn" type="button" disabled={pending} onClick={handleRemove} style={{ fontSize: 12 }}>Remove</button>
          )}
        </form>
      )}
      {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}
