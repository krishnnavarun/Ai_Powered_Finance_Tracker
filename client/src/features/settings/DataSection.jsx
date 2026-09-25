import { useQueryClient } from '@tanstack/react-query';
import { Download, LoaderCircle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { deleteAccount, exportData } from '@/api/users';
import { FormAlert } from '@/components/common/FormAlert';
import { FormField } from '@/components/common/FormField';
import { PasswordInput } from '@/components/common/PasswordInput';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { saveFile } from '@/lib/download';
import { useAuthStore } from '@/store/auth';

function DeleteAccountDialog({ open, onOpenChange }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const clearSession = useAuthStore((state) => state.clearSession);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const confirm = async (event) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await deleteAccount(password);
      queryClient.clear();
      clearSession('logout');
      navigate('/login', { replace: true });
      toast.success('Your account and all its data were deleted');
    } catch (err) {
      setError(err.message);
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            Every wallet, payment, budget, goal, receipt and chat is removed for good. Download your
            data first if you want a copy.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={confirm} className="grid gap-4">
          <FormField label="Your password" error={error ? { message: error } : undefined}>
            {(field) => (
              <PasswordInput
                {...field}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </FormField>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Keep my account
            </Button>
            <Button type="submit" variant="destructive" disabled={!password || pending}>
              {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              Delete everything
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Download all data (JSON) and delete the account.
export function DataSection() {
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const download = async () => {
    setDownloading(true);
    setError(null);
    try {
      const { blob, filename } = await exportData();
      saveFile(blob, filename);
      toast.success(`Downloaded ${filename}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section aria-label="Your data" className="surface grid gap-4 p-5">
      <h2 className="font-semibold">Your data</h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          A copy of everything in your account, as a JSON file.
        </p>
        <Button variant="outline" onClick={download} disabled={downloading}>
          {downloading ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <Download aria-hidden="true" />
          )}
          Download my data
        </Button>
      </div>
      <FormAlert>{error}</FormAlert>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
        <p className="text-sm">
          <span className="font-medium">Delete account.</span>{' '}
          <span className="text-muted-foreground">This can’t be undone.</span>
        </p>
        <Button variant="destructive" onClick={() => setDeleting(true)}>
          <Trash2 aria-hidden="true" />
          Delete account
        </Button>
      </div>
      <DeleteAccountDialog open={deleting} onOpenChange={setDeleting} />
    </section>
  );
}
