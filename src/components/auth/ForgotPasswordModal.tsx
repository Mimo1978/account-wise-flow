import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, CheckCircle, AlertCircle } from 'lucide-react';

interface ForgotPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email address');
      setLoading(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    const { error: resetError } = await resetPassword(email);

    if (resetError) {
      if (resetError.message.includes('rate limit')) {
        setError('Too many requests. Please wait a moment and try again.');
      } else if (resetError.message.includes('not configured')) {
        setError('Password reset is not configured. Please contact support.');
      } else {
        setError(resetError.message);
      }
    } else {
      setSuccess(true);
    }

    setLoading(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after modal closes
    setTimeout(() => {
      setEmail('');
      setSuccess(false);
      setError(null);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Reset Password
          </DialogTitle>
          <DialogDescription>
            {!success
              ? "Enter your email address and we'll send you a link to reset your password."
              : ''}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="font-semibold text-lg mb-2">Check your email</h3>
            <p className="text-muted-foreground text-sm">
              We've sent a password reset link to{' '}
              <span className="font-medium text-foreground">{email}</span>
            </p>
            <Button onClick={handleClose} className="mt-6" variant="outline">
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Sending...' : 'Send reset link'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
