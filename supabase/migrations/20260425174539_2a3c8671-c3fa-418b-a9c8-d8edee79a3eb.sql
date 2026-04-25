CREATE TABLE IF NOT EXISTS public.jarvis_memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  embedding_text TEXT,
  source_conversation_id TEXT,
  entity_type TEXT,
  entity_id UUID,
  importance INTEGER DEFAULT 5,
  times_recalled INTEGER DEFAULT 0,
  last_recalled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jarvis_memories_workspace ON public.jarvis_memories(workspace_id);
CREATE INDEX IF NOT EXISTS idx_jarvis_memories_user ON public.jarvis_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_jarvis_memories_type ON public.jarvis_memories(memory_type);

ALTER TABLE public.jarvis_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own memories" ON public.jarvis_memories
  FOR ALL USING (auth.uid() = user_id);