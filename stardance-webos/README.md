# Stardance WebOS

Welcome to the Stardance WebOS project! This is a polished browser-based operating system designed for the Hack Club Stardance WebOS 1 mission. The OS features a user-friendly interface with multiple draggable windows, a custom visual theme, and various applications to enhance your experience.

## Project Structure

The project is organized as follows:

```
stardance-webos
├── src
│   ├── main.js               # Entry point of the application
│   ├── styles
│   │   └── main.css          # Styles for the OS
│   ├── components
│   │   ├── desktop.js         # Manages the desktop environment
│   │   ├── taskbar.js         # Creates the taskbar
│   │   ├── window-manager.js   # Manages multiple draggable windows
│   │   ├── app-launcher.js    # Provides a start menu for apps
│   │   └── draggable-window.js  # Implements draggable window behavior
│   ├── apps
│   │   ├── welcome.js         # Introduction app
│   │   ├── files.js           # Simple file manager
│   │   ├── notes.js           # Notes app with localStorage
│   │   └── terminal.js        # Command-line interface app
│   ├── utils
│   │   ├── drag.js            # Drag-and-drop utility functions
│   │   ├── theme.js           # Functions for managing the visual theme
│   │   └── storage.js         # Functions for managing localStorage
│   └── assets
│       └── icons
│           └── .gitkeep       # Keeps the icons directory in version control
├── index.html                 # Main HTML file
├── package.json               # npm configuration file
├── vite.config.js             # Vite configuration file
├── README.md                  # Project documentation
├── .gitignore                 # Git ignore file
└── .editorconfig              # Coding styles configuration
```

## Development Stages

### DEVLOG 1 — Build the basic desktop and window system
- Implemented the Desktop, WindowManager, and DraggableWindow components.
- Set up the main.js to initialize the desktop and window system.

### DEVLOG 2 — Add the main apps and functionality
- Added the Welcome, Files, Notes, and Terminal apps.
- Integrated the AppLauncher and Taskbar components.

### DEVLOG 3 — Polish the UI, responsiveness, and extra feature
- Enhanced the CSS for a custom visual theme.
- Ensured responsiveness and added the Notes app with localStorage persistence.

## Commands and Testing

1. **Run the project locally:** 
   - Use the command: `npm run dev`

2. **Testing requirements:**
   - Open the OS in a browser and verify that multiple draggable windows can be opened.
   - Check that the windows can be minimized, maximized, and closed.
   - Ensure the taskbar is functional and displays the current time.
   - Test the app launcher to confirm all apps can be launched.
   - Verify that the Notes app saves and retrieves notes using localStorage.
   - Resize the browser window to ensure responsive behavior.

## Usage Instructions

To use the Stardance WebOS, simply open the `index.html` file in your browser. You can launch applications from the taskbar or app launcher. Drag windows around the desktop, and use the minimize, maximize, and close buttons to manage your workspace. The Notes app allows you to create and save notes, which will persist even after refreshing the page. Enjoy exploring your custom operating system!