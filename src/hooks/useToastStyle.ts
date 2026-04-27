import { semanticColors } from '@heroui/theme';
import { useTheme } from 'next-themes';

type ToastStyle = {
    background: string;
    color: string;
    wordBreak: 'break-all';
    select: 'text';
};

export const useToastStyle = (): ToastStyle => {
    const { theme } = useTheme();
    const palette: any = theme === 'dark' ? semanticColors.dark : semanticColors.light;

    return {
        background: palette.content1.DEFAULT,
        color: palette.foreground.DEFAULT,
        wordBreak: 'break-all',
        select: 'text',
    };
};
