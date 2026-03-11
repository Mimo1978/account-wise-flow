import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Sparkles, ArrowRight, Search, MessageSquare, MousePointerClick } from 'lucide-react';
import { getCommandsForPage, searchCommands, groupCommands, type JarvisCommand } from '@/lib/jarvis-commands';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJarvisMessage?: (message: string) => void;
}

export function JarvisCommandPalette({ open, onOpenChange, onJarvisMessage }: Props) {
  const [search, setSearch] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const allCommands = getCommandsForPage(location.pathname);
  const filtered = searchCommands(allCommands, search);
  const grouped = groupCommands(filtered);

  // Reset search when opening
  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  const executeCommand = useCallback((cmd: JarvisCommand) => {
    onOpenChange(false);

    switch (cmd.action) {
      case 'navigate':
        if (cmd.destination) navigate(cmd.destination);
        break;
      case 'jarvis':
        if (cmd.destination && onJarvisMessage) {
          onJarvisMessage(cmd.destination);
        }
        break;
      case 'click':
        if (cmd.destination) {
          setTimeout(() => {
            const el = document.querySelector(`[data-jarvis-id="${cmd.destination}"]`) as HTMLElement;
            if (el) el.click();
          }, 100);
        }
        break;
    }
  }, [navigate, onOpenChange, onJarvisMessage]);

  const actionIcon = (action: string) => {
    switch (action) {
      case 'navigate': return <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />;
      case 'jarvis': return <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />;
      case 'click': return <MousePointerClick className="w-3.5 h-3.5 text-muted-foreground" />;
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-[600px] overflow-hidden gap-0">
        <Command className="rounded-lg border-0">
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Ask Jarvis anything — or pick a command below</span>
          </div>
          <CommandInput
            placeholder="Type a command or question…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[400px]">
            <CommandEmpty>
              <div className="py-6 text-center">
                <Search className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No commands found. Try a different search.</p>
              </div>
            </CommandEmpty>
            {Object.entries(grouped).map(([group, cmds]) => (
              <CommandGroup key={group} heading={group}>
                {cmds.map(cmd => (
                  <CommandItem
                    key={cmd.id}
                    value={`${cmd.label} ${cmd.keywords.join(' ')}`}
                    onSelect={() => executeCommand(cmd)}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{cmd.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{cmd.description}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {cmd.shortcut && (
                        <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">{cmd.shortcut}</kbd>
                      )}
                      {actionIcon(cmd.action)}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
          <div className="px-4 py-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground text-center">
              <kbd className="px-1 py-0.5 rounded bg-muted font-mono">↑↓</kbd> navigate · <kbd className="px-1 py-0.5 rounded bg-muted font-mono">↵</kbd> select · <kbd className="px-1 py-0.5 rounded bg-muted font-mono">esc</kbd> close
            </p>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
