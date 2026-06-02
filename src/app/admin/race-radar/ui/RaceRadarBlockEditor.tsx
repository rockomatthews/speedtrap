'use client';

import { useCallback, useEffect, useMemo } from 'react';

import type { PartialBlock } from '@blocknote/core';
import { BlockNoteViewRaw as BlockNoteView, useCreateBlockNote } from '@blocknote/react';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

type EditorValue = {
  blocks: PartialBlock[];
  html: string;
};

function isBlockList(value: unknown): value is PartialBlock[] {
  return Array.isArray(value) && value.every((block) => typeof block === 'object' && block !== null && 'type' in block);
}

function blocksFromLegacyText(value: string): PartialBlock[] {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [{ type: 'paragraph', content: '' }];
  return lines.map((line) => ({ type: 'paragraph', content: line }));
}

async function uploadRaceRadarImage(file: File) {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch('/api/admin/race-radar/uploads', {
    method: 'POST',
    body: form
  });
  const json = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!res.ok || !json?.url) throw new Error(json?.error ?? 'Image upload failed.');
  return json.url;
}

export function RaceRadarBlockEditor({
  initialBlocks,
  legacyBody,
  onChange
}: {
  initialBlocks: unknown;
  legacyBody: string;
  onChange: (value: EditorValue) => void;
}) {
  const startingBlocks = useMemo(
    () => (isBlockList(initialBlocks) ? initialBlocks : blocksFromLegacyText(legacyBody)),
    [initialBlocks, legacyBody]
  );

  const editor = useCreateBlockNote({
    initialContent: startingBlocks,
    uploadFile: uploadRaceRadarImage
  });

  const emitChange = useCallback(async () => {
    const html = await editor.blocksToHTMLLossy(editor.document);
    onChange({ blocks: editor.document, html });
  }, [editor, onChange]);

  useEffect(() => {
    void emitChange();
  }, [emitChange]);

  return (
    <Box>
      <Typography sx={{ mb: 0.75, fontWeight: 800 }}>Body</Typography>
      <Box
        sx={{
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 1,
          minHeight: 340,
          overflow: 'hidden',
          '& .bn-container': {
            minHeight: 340
          },
          '& .bn-editor': {
            minHeight: 340,
            backgroundColor: '#101010',
            color: '#fff'
          }
        }}
      >
        <BlockNoteView editor={editor} theme="dark" onChange={() => void emitChange()} />
      </Box>
    </Box>
  );
}
