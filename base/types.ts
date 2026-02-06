
export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  fontFamily: string;
  colors: {
    bg: string;
    sidebar: string;
    header: string;
    footer: string;
    primary: string;
    text: string;
    card: string;
  };
  styles: {
    borderRadius: string;
    borderWidth: string;
    shadow: string;
    spacing: string;
  };
}
