import { useState } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCampaign, OutreachChannel, OutreachCampaignStatus } from "@/hooks/use-outreach";
import { useOutreachCampaigns } from "@/hooks/use-outreach";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (id: string) => void;
}

interface FormValues {
  name: string;
  description: string;
  channel: OutreachChannel;
  status: OutreachCampaignStatus;
}

export function CreateCampaignModal({ open, onOpenChange, onCreated }: Props) {
  const { mutateAsync, isPending } = useCreateCampaign();
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: { name: "", description: "", channel: "email", status: "draft" },
  });

  const onSubmit = async (values: FormValues) => {
    const campaign = await mutateAsync(values);
    reset();
    onOpenChange(false);
    onCreated?.(campaign.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Campaign</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Campaign Name *</Label>
            <Input
              {...register("name", { required: "Name is required" })}
              placeholder="e.g. Q1 Senior Engineers Outreach"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea {...register("description")} placeholder="Optional description..." rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Primary Channel</Label>
            <Select defaultValue="email" onValueChange={(v) => setValue("channel", v as OutreachChannel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="call">Phone Call</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select defaultValue="draft" onValueChange={(v) => setValue("status", v as OutreachCampaignStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create Campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
