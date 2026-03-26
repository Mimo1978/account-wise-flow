import { useTheme } from "next-themes";
import { Toaster as Sonner, toast as sonnerToast } from "sonner";
import { flashConfirm } from "@/components/ui/flash-confirm";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      offset={80}
      gap={8}
      duration={4000}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: [
            "group toast",
            "!min-w-[360px] !max-w-[520px]",
            "!rounded-xl",
            "!border !border-border/60",
            "!shadow-[0_8px_40px_rgba(0,0,0,0.35)]",
            "!px-5 !py-4",
            "!text-sm !font-medium",
            "!backdrop-blur-sm",
            "group-[.toaster]:bg-card/95",
            "group-[.toaster]:text-foreground",
          ].join(" "),
          success: [
            "!border-l-[4px] !border-l-emerald-500",
            "group-[.toaster]:bg-card/95",
          ].join(" "),
          error: [
            "!border-l-[4px] !border-l-red-500",
            "group-[.toaster]:bg-card/95",
          ].join(" "),
          warning: [
            "!border-l-[4px] !border-l-amber-500",
            "group-[.toaster]:bg-card/95",
          ].join(" "),
          info: [
            "!border-l-[4px] !border-l-blue-500",
            "group-[.toaster]:bg-card/95",
          ].join(" "),
          description: "group-[.toast]:text-muted-foreground !text-xs !mt-0.5",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          icon: "!mt-0",
        },
        style: {
          fontFamily: "inherit",
        },
      }}
      {...props}
    />
  );
};

const toast = Object.assign(
  (msg: string | React.ReactNode, opts?: any) => {
    flashConfirm(String(msg), "info", opts?.description);
    return sonnerToast(msg, opts);
  },
  {
    success: (msg: string | React.ReactNode, opts?: any) => {
      flashConfirm(String(msg), "success", opts?.description);
      return sonnerToast.success(msg, opts);
    },
    error: (msg: string | React.ReactNode, opts?: any) => {
      flashConfirm(String(msg), "error", opts?.description);
      return sonnerToast.error(msg, opts);
    },
    warning: (msg: string | React.ReactNode, opts?: any) => {
      flashConfirm(String(msg), "warning", opts?.description);
      return sonnerToast.warning(msg, opts);
    },
    info: (msg: string | React.ReactNode, opts?: any) => {
      flashConfirm(String(msg), "info", opts?.description);
      return sonnerToast.info(msg, opts);
    },
    dismiss: sonnerToast.dismiss,
    loading: sonnerToast.loading,
    promise: sonnerToast.promise,
    custom: sonnerToast.custom,
    message: sonnerToast.message,
  }
);

export { Toaster, toast };
