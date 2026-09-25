import { useQuery } from '@tanstack/react-query';
import { Camera, LoaderCircle, Paperclip, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { fetchReceipt } from '@/api/transactions';
import { Button } from '@/components/ui/button';
import { receiptFileError } from './receiptFile';
import { transactionKeys } from './useTransactions';

// Shows an image from a Blob/File. The temporary blob: URL is created and released in
// the same effect, so it's always cleaned up (also under StrictMode's double run).
export function BlobImage({ blob, alt }) {
  const imgRef = useRef(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    imgRef.current.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  return <img ref={imgRef} alt={alt} className="h-full w-full object-cover" />;
}

// The saved receipt, loaded with the login token (receipts are private).
function SavedReceipt({ transactionId }) {
  const { data, isPending, isError } = useQuery({
    queryKey: transactionKeys.receipt(transactionId),
    queryFn: () => fetchReceipt(transactionId),
    staleTime: Infinity,
  });
  if (isPending)
    return (
      <LoaderCircle
        className="size-5 animate-spin text-muted-foreground"
        aria-label="Loading receipt"
      />
    );
  if (isError) return <Paperclip className="size-5 text-muted-foreground" aria-label="Receipt" />;
  return <BlobImage blob={data} alt="Saved receipt" />;
}

// Photo picker for a transaction's receipt. `value` is:
//   { file: File } — a new photo chosen (uploaded after the transaction is saved)
//   { remove: true } — remove the saved photo
//   null — no change
export function ReceiptField({ transaction, value, onChange }) {
  const inputId = useId();
  const [error, setError] = useState(null);
  const hasSaved = Boolean(transaction?.receiptUrl) && !value?.remove;
  const showing = value?.file ? 'new' : hasSaved ? 'saved' : 'none';

  const pick = (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // let the same file be picked again after removing it
    if (!file) return;
    const problem = receiptFileError(file);
    setError(problem);
    if (!problem) onChange({ file });
  };

  const clear = () => {
    setError(null);
    onChange(transaction?.receiptUrl ? { remove: true } : null);
  };

  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">Receipt photo (optional)</span>
      <div className="flex items-center gap-3">
        {showing !== 'none' && (
          <div className="relative flex size-16 items-center justify-center overflow-hidden rounded-lg border bg-muted">
            {showing === 'new' ? (
              <BlobImage blob={value.file} alt="New receipt" />
            ) : (
              <SavedReceipt transactionId={transaction.id} />
            )}
          </div>
        )}
        <label
          htmlFor={inputId}
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border bg-background/60 px-3 text-sm font-medium shadow-xs transition-all duration-200 hover:-translate-y-px hover:border-primary/40 hover:bg-accent active:scale-[0.97] has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
        >
          <Camera className="size-4" aria-hidden="true" />
          {showing === 'none' ? 'Add photo' : 'Change photo'}
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="Receipt photo"
            onChange={pick}
          />
        </label>
        {showing !== 'none' && (
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            <X aria-hidden="true" />
            Remove
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
