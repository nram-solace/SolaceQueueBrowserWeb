# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Solace Queue Browser is a cross-platform application for browsing messages in Solace message queues. It's built as a React frontend with Tauri desktop wrapper, supporting both browser and desktop deployment modes.

## Development Commands

### Basic Development
- `npm run dev` - Start development server on port 1420 (fixed for Tauri)
- `npm run build` - Production build for browser deployment
- `npm run preview` - Preview build locally
- `npm run publish` - Deploy to GitHub Pages

### Desktop Development
- `npm run tauri dev` - Start Tauri desktop development
- `npm run tauri build` - Build desktop applications

### Dependencies
- `npm install` - Install all dependencies

## Architecture Overview

### Dual Deployment Architecture
The application supports two deployment modes:
- **Browser Mode**: Web application with CORS requirements, deployed to GitHub Pages
- **Desktop Mode**: Native application via Tauri with full broker access

### Core Technologies
- **React 18** with hooks and context providers (no external state management)
- **PrimeReact** for UI components (DataTable, forms, layouts)
- **Vite** for build tooling
- **Tauri 2.x** for desktop wrapper
- **Solace JavaScript Client Library** for queue operations

### Component Structure
Each component follows the pattern: `ComponentName/index.jsx` + `styles.module.css`

Key components:
- `RootLayout`: Main layout with three-panel design
- `BrokerQueueTreeView`: Queue hierarchy navigation
- `MessageList`: Paginated message display using DataTable
- `MessagePayloadView`: JSON payload viewer
- `BrokerConfigDialog`: Connection management

### Solace Integration Architecture

The application implements different browsing strategies:
- **BasicQueueBrowser**: Forward-only browsing
- **QueuedMessagesReplayBrowser**: Head/tail browsing with replay logs
- **LoggedMessagesReplayBrowser**: Time/MessageID-based browsing
- **NullBrowser**: Disconnected state

Browser selection happens in `src/hooks/solace.jsx` based on queue capabilities.

### Dual Client System
- **Desktop Mode**: Uses Tauri HTTP client for SEMP API calls
- **Browser Mode**: Uses Fetch API with CORS handling
- Client selection is automatic based on Tauri environment detection

### State Management
- React Context providers in `src/providers/`
- Custom hooks in `src/hooks/solace.jsx` contain core queue browsing logic
- Configuration stored in localStorage (browser) or file system (desktop)

## Important File Locations

### Core Application Logic
- `src/hooks/solace.jsx`: Main queue browsing and connection management
- `src/providers/`: React context providers for broker config and SEMP client
- `src/utils/solace/semp/`: Auto-generated SEMP API clients

### Configuration
- `vite.config.js`: Build configuration with fixed port 1420
- `src-tauri/tauri.conf.json`: Desktop application configuration
- `publish.js`: GitHub Pages deployment script

### Entry Points
- `src/main.jsx`: React application entry
- `src-tauri/src/main.rs`: Tauri desktop entry

## Development Considerations

### Environment Constraints
- Development server must run on port 1420 for Tauri compatibility
- Browser mode requires CORS-enabled Solace broker
- Desktop mode has no CORS restrictions

### Browser Capabilities
Different queues support different browsing modes based on:
- Queue type and permissions
- Replay log availability
- Broker configuration

### Error Handling
Current error handling uses try-catch with console logging. No formal logging framework is implemented.

### No Testing Framework
The project currently has no automated testing setup. Manual testing is the current approach.

## Code Patterns

### Component Creation
When creating new components, follow existing patterns:
1. Create directory `src/components/ComponentName/`
2. Add `index.jsx` with component logic
3. Add `styles.module.css` for component-specific styles
4. Use PrimeReact components for consistency

### Solace Client Usage
Always use the browser abstraction rather than direct Solace client calls. The browser classes handle connection management and different browsing strategies.

### SEMP API Integration
Use the generated SEMP clients in `src/utils/solace/semp/` rather than making direct API calls. These handle the dual client architecture automatically.