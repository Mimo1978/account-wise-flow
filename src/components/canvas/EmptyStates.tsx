import { Button } from '@/components/ui/button';
import { 
  Building2, 
  Users, 
  FileText, 
  Briefcase,
  Plus,
  ArrowRight
} from 'lucide-react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] px-4 py-16">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        {icon}
      </div>
      <h2 className="text-2xl font-semibold text-foreground mb-2">{title}</h2>
      <p className="text-muted-foreground text-center max-w-md mb-8">{description}</p>
      
      {(primaryAction || secondaryAction) && (
        <div className="flex gap-3">
          {primaryAction && (
            <Button onClick={primaryAction.onClick} size="lg" className="gap-2">
              <Plus className="w-4 h-4" />
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button 
              onClick={secondaryAction.onClick} 
              variant="outline" 
              size="lg"
              className="gap-2"
            >
              {secondaryAction.label}
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function CompaniesEmptyState(props?: {
  onCreateClick?: () => void;
  onImportClick?: () => void;
}) {
  return (
    <EmptyState
      icon={<Building2 className="w-8 h-8 text-primary" />}
      title="No Companies Yet"
      description="Add your first company to get started. You can create one manually or import a list."
      primaryAction={
        props?.onCreateClick
          ? { label: 'Add Company', onClick: props.onCreateClick }
          : undefined
      }
      secondaryAction={
        props?.onImportClick
          ? { label: 'Import CSV', onClick: props.onImportClick }
          : undefined
      }
    />
  );
}

export function ContactsEmptyState(props?: {
  onCreateClick?: () => void;
  onImportClick?: () => void;
}) {
  return (
    <EmptyState
      icon={<Users className="w-8 h-8 text-primary" />}
      title="No Contacts Yet"
      description="Add contacts manually or import them from a CSV file. You can also connect them to companies."
      primaryAction={
        props?.onCreateClick
          ? { label: 'Add Contact', onClick: props.onCreateClick }
          : undefined
      }
      secondaryAction={
        props?.onImportClick
          ? { label: 'Import Contacts', onClick: props.onImportClick }
          : undefined
      }
    />
  );
}

export function TalentEmptyState(props?: {
  onImportClick?: () => void;
}) {
  return (
    <EmptyState
      icon={<Briefcase className="w-8 h-8 text-primary" />}
      title="No Candidates Yet"
      description="Upload CVs to build your candidate database. You can upload one or multiple CVs at once."
      primaryAction={
        props?.onImportClick
          ? { label: 'Upload CVs', onClick: props.onImportClick }
          : undefined
      }
    />
  );
}

export function DocumentsEmptyState(props?: {
  onUploadClick?: () => void;
}) {
  return (
    <EmptyState
      icon={<FileText className="w-8 h-8 text-primary" />}
      title="No Documents Yet"
      description="Upload documents to organize and reference important files for your companies and contacts."
      primaryAction={
        props?.onUploadClick
          ? { label: 'Upload Documents', onClick: props.onUploadClick }
          : undefined
      }
    />
  );
}
