import { useTheme } from "next-themes";
import { Toaster as Sonner, toast as sonnerToast } from "sonner";
import { flashConfirm } from "@/components/ui/flash-confirm";

type ToasterProps = React.ComponentProps<typeof Sonner>;

export const toast = Object.assign(
  (message: string, opts?: any) => {
    flashConfirm(String(message), "info", opts?.description);
    return sonnerToast(message, opts);
  },
  {
    success: (message: string, opts?: any) => {
      flashConfirm(String(message), "success", opts?.description);
      return sonnerToast.success(message, opts);
    },
    error: (message: string, opts?: any) => {
      flashConfirm(String(message), "error", opts?.description);
      return sonnerToast.error(message, opts);
    },
    warning: (message: string, opts?: any) => {
      flashConfirm(String(message), "warning", opts?.description);
      return sonnerToast.warning(message, opts);
    },
    info: (message: string, opts?: any) => {
      flashConfirm(String(message), "info", opts?.description);
      return sonnerToast.info(message, opts);
    },
    dismiss: sonnerToast.dismiss,
    loading: sonnerToast.loading,
    promise: sonnerToast.promise,
    custom: sonnerToast.custom,
    message: sonnerToast.message,
  }
);

export const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      offset={16}
      gap={8}
      duration={3000}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg !rounded-xl !text-sm",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};
