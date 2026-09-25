import { Camera, LoaderCircle, ScanLine } from 'lucide-react';
import { useId, useState } from 'react';
import * as aiApi from '@/api/ai';
import { FormAlert } from '@/components/common/FormAlert';
import { Button } from '@/components/ui/button';
import { BlobImage } from '@/features/transactions/ReceiptField';
import { receiptFileError } from '@/features/transactions/receiptFile';
import { readTextOnDevice } from './ocr';
import { useAiStatus } from './useCapture';

// Errors after which reading on the device is still worth a try.
const TRY_ON_DEVICE = ['AI_UNAVAILABLE', 'AI_DISABLED'];

// "Scan receipt" tab: photo → AI vision (or, with AI off, text read on this device)
// → a filled form with the photo already attached.
export function ScanTab({ onDraft }) {
  const inputId = useId();
  const { data: ai } = useAiStatus();
  const aiOn = Boolean(ai?.enabled && ai?.configured);
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null); // null | 'ai' | 0–100 (on-device reading)

  const pick = (event) => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (!chosen) return;
    const problem = receiptFileError(chosen);
    setError(problem);
    setFile(problem ? null : chosen);
  };

  const readOnDevice = async () => {
    setProgress(0);
    const text = await readTextOnDevice(file, setProgress);
    return aiApi.parseReceiptText(text);
  };

  const read = async () => {
    setError(null);
    try {
      let result;
      if (aiOn) {
        setProgress('ai');
        try {
          result = await aiApi.parseReceipt(file);
        } catch (err) {
          if (!TRY_ON_DEVICE.includes(err.code)) throw err;
          result = await readOnDevice();
        }
      } else {
        result = await readOnDevice();
      }
      onDraft({ ...result.draft, receiptFile: file });
    } catch (err) {
      setError(err.message ?? 'Could not read this photo. Try a clearer one.');
    } finally {
      setProgress(null);
    }
  };

  const busy = progress !== null;

  return (
    <div className="grid gap-4">
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        onChange={pick}
        aria-label="Receipt photo"
      />
      <label
        htmlFor={inputId}
        className="group relative flex h-48 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed bg-background/60 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        {file ? (
          <BlobImage blob={file} alt="Receipt to read" />
        ) : (
          <>
            <Camera
              className="size-8 text-primary transition-transform duration-300 group-hover:scale-110"
              aria-hidden="true"
            />
            Take or choose a photo of the receipt
            <span className="text-xs">JPG, PNG or WebP, up to 5 MB</span>
          </>
        )}
        {busy && (
          <span className="absolute inset-x-0 top-0 h-1 animate-[scan_1.6s_ease-in-out_infinite] bg-linear-to-r from-transparent via-gold to-transparent" />
        )}
      </label>

      <p className="text-xs text-muted-foreground">
        {aiOn
          ? 'AI reads the shop, date and total. The photo is also saved with the payment.'
          : 'AI is off, so the photo is read on this device (slower, less exact). Check the form after.'}
      </p>

      <FormAlert>{error}</FormAlert>

      <Button onClick={read} disabled={!file || busy} className="justify-self-end">
        {busy ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <ScanLine aria-hidden="true" />
        )}
        {progress === 'ai'
          ? 'Reading…'
          : typeof progress === 'number'
            ? `Reading on this device… ${progress}%`
            : 'Read receipt'}
      </Button>
    </div>
  );
}
