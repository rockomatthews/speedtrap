'use client';

import { FormEvent, useRef, useState } from 'react';

import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Fab from '@mui/material/Fab';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const starterMessage: ChatMessage = {
  role: 'assistant',
  content: 'Hey, I can help with booking, pricing, leaderboards, leagues, the menu, memberships, or private events.'
};

const quickPrompts = ['Book a race', 'Pricing', 'Leaderboards', 'Private events'];

export function SiteChatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([starterMessage]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function sendMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages.slice(-10) })
      });
      const json = (await response.json().catch(() => null)) as { reply?: string; error?: string } | null;
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: json?.reply || json?.error || 'I could not answer that cleanly. Try asking about booking, pricing, or leaderboards.'
        }
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: 'I lost connection for a second. Try again, or head to /pricing, /book, or /leaderboards.'
        }
      ]);
    } finally {
      setLoading(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <Box sx={{ position: 'fixed', right: { xs: 14, sm: 20 }, bottom: { xs: 14, sm: 20 }, zIndex: 1400 }}>
      {open ? (
        <Paper
          elevation={12}
          sx={{
            width: { xs: 'calc(100vw - 28px)', sm: 390 },
            maxWidth: 'calc(100vw - 28px)',
            height: { xs: 540, sm: 560 },
            maxHeight: 'calc(100svh - 36px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid rgba(255,210,0,0.52)',
            bgcolor: '#090909',
            boxShadow: '0 18px 70px rgba(0,0,0,0.72)'
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.25}
            sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.12)' }}
          >
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                bgcolor: '#FFD200',
                color: '#050505'
              }}
            >
              <ChatBubbleOutlineIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontWeight: 950, lineHeight: 1.1 }}>Speed Trap Assistant</Typography>
              <Typography color="text.secondary" sx={{ fontSize: 12 }}>
                Booking, pricing, leaders, menu, and events
              </Typography>
            </Box>
            <IconButton aria-label="Close assistant" onClick={() => setOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>

          <Stack spacing={1.25} sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1.5 }}>
            {messages.map((message, index) => {
              const isUser = message.role === 'user';
              return (
                <Box
                  key={`${message.role}-${index}`}
                  sx={{
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '86%',
                    px: 1.4,
                    py: 1,
                    borderRadius: 2,
                    bgcolor: isUser ? '#FFD200' : 'rgba(255,255,255,0.08)',
                    color: isUser ? '#050505' : '#fff',
                    border: isUser ? 'none' : '1px solid rgba(255,255,255,0.10)'
                  }}
                >
                  <Typography sx={{ whiteSpace: 'pre-wrap', fontSize: 14.5, lineHeight: 1.45 }}>{message.content}</Typography>
                </Box>
              );
            })}
            {loading ? (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary', px: 0.5 }}>
                <CircularProgress size={16} />
                <Typography sx={{ fontSize: 13 }}>Checking that for you...</Typography>
              </Stack>
            ) : null}
          </Stack>

          <Box sx={{ px: 1.5, pb: 1 }}>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              {quickPrompts.map((prompt) => (
                <Button key={prompt} size="small" variant="outlined" onClick={() => void sendMessage(prompt)}>
                  {prompt}
                </Button>
              ))}
            </Stack>
          </Box>

          <Box component="form" onSubmit={submit} sx={{ p: 1.5, pt: 0 }}>
            <Stack direction="row" spacing={1}>
              <TextField
                inputRef={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask where to go..."
                size="small"
                fullWidth
                inputProps={{ maxLength: 600 }}
              />
              <IconButton type="submit" aria-label="Send message" disabled={!input.trim() || loading} sx={{ bgcolor: '#FF161F' }}>
                <SendIcon />
              </IconButton>
            </Stack>
          </Box>
        </Paper>
      ) : (
        <Fab color="primary" aria-label="Open Speed Trap assistant" onClick={() => setOpen(true)}>
          <ChatBubbleOutlineIcon />
        </Fab>
      )}
    </Box>
  );
}
