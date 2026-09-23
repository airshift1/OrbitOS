const theme = {
    colors: {
        primary: '#4A90E2',
        secondary: '#50E3C2',
        background: '#F5F5F5',
        text: '#333333',
        windowBackground: '#FFFFFF',
        windowBorder: '#CCCCCC',
        taskbarBackground: '#FFFFFF',
        taskbarText: '#333333',
    },
    fonts: {
        main: 'Arial, sans-serif',
        heading: 'Helvetica, sans-serif',
    },
    spacing: {
        small: '8px',
        medium: '16px',
        large: '24px',
    },
};

function applyTheme() {
    const root = document.documentElement;

    Object.entries(theme.colors).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, value);
    });

    Object.entries(theme.spacing).forEach(([key, value]) => {
        root.style.setProperty(`--spacing-${key}`, value);
    });

    // Additional theme application logic can be added here
}

export { theme, applyTheme };