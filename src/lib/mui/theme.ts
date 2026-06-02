import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      // Brand yellow
      main: '#FFD200',
      contrastText: '#0B0B0B'
    },
    secondary: {
      // Brand red
      main: '#FF161F',
      contrastText: '#FFFFFF'
    },
    background: {
      default: '#0B0B0B',
      paper: '#141414'
    },
    text: {
      primary: '#FFFFFF',
      secondary: 'rgba(255,255,255,0.72)'
    }
  },
  shape: {
    borderRadius: 10
  },
  typography: {
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"'
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none'
        }
      }
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true
      },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 700
        },
        containedPrimary: {
          backgroundColor: '#FFD200',
          color: '#0B0B0B',
          '&:hover': {
            backgroundColor: '#FFDF4D'
          }
        },
        outlinedPrimary: {
          borderColor: '#FF161F',
          backgroundColor: '#FF161F',
          color: '#FFFFFF',
          '&:hover': {
            borderColor: '#E00012',
            backgroundColor: '#E00012'
          }
        },
        containedSecondary: {
          backgroundColor: '#FF161F',
          color: '#FFFFFF',
          '&:hover': {
            backgroundColor: '#E00012'
          }
        },
        outlinedSecondary: {
          borderColor: '#FF161F',
          backgroundColor: '#FF161F',
          color: '#FFFFFF',
          '&:hover': {
            borderColor: '#E00012',
            backgroundColor: '#E00012'
          }
        }
      }
    }
  }
});

