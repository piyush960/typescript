<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Log Viewer</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
    <style>
        /* Custom styles for the log viewer */
        body {
            font-family: 'Inter', sans-serif;
            background-color: #111827; /* bg-gray-900 */
        }
        .log-viewer-container {
            font-family: 'Fira Code', monospace;
        }
        /* Custom scrollbar for webkit browsers */
        .log-output::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        .log-output::-webkit-scrollbar-track {
            background: #1f2937; /* bg-gray-800 */
        }
        .log-output::-webkit-scrollbar-thumb {
            background: #4b5563; /* bg-gray-600 */
            border-radius: 4px;
        }
        .log-output::-webkit-scrollbar-thumb:hover {
            background: #6b7280; /* bg-gray-500 */
        }
        /* Basic ANSI color support */
        .ansi-black { color: #374151; }
        .ansi-red { color: #ef4444; }
        .ansi-green { color: #22c55e; }
        .ansi-yellow { color: #eab308; }
        .ansi-blue { color: #3b82f6; }
        .ansi-magenta { color: #d946ef; }
        .ansi-cyan { color: #06b6d4; }
        .ansi-white { color: #f9fafb; }
        .ansi-bold { font-weight: bold; }
    </style>
</head>
<body class="text-gray-200">

    <div id="app" class="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <!-- App container -->
        <div class="flex flex-col h-[90vh] bg-gray-800 rounded-xl shadow-2xl border border-gray-700">
            
            <!-- Header -->
            <div class="p-4 border-b border-gray-700">
                <h1 class="text-xl font-bold text-white">Log Viewer</h1>
                <p class="text-sm text-gray-400">Paste your raw log string below to see it formatted.</p>
            </div>

            <!-- Main Content: Input and Output -->
            <div class="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 overflow-hidden">
                
                <!-- Input Area -->
                <div class="flex flex-col">
                    <label for="log-input" class="text-gray-300 font-semibold mb-2">Raw Log Input</label>
                    <textarea 
                        id="log-input"
                        class="w-full flex-1 p-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-300 font-mono text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        placeholder="Paste logs here... e.g., 'INFO: Starting process...\\nERROR: File not found.'"
                    ></textarea>
                </div>

                <!-- Formatted Output -->
                <div class="flex flex-col overflow-hidden">
                    <label class="text-gray-300 font-semibold mb-2">Formatted Output</label>
                    <div id="log-output-container" class="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-1 overflow-hidden">
                        <pre id="log-output" class="log-viewer-container w-full h-full overflow-auto p-3 text-sm whitespace-pre-wrap break-words"></pre>
                    </div>
                </div>
            </div>

        </div>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const logInput = document.getElementById('log-input');
            const logOutput = document.getElementById('log-output');

            // --- Sample Log Data ---
            const sampleLog = '[2025-07-13 17:50:01] \u001b[34m[INFO]\u001b[0m - Application starting...\n' +
                              '[2025-07-13 17:50:02] \u001b[32m[SUCCESS]\u001b[0m - Database connection established.\n' +
                              '\t- Connection Pool Size: 10\n' +
                              '\t- Host: db.example.com\n' +
                              '[2025-07-13 17:50:03] \u001b[33m[WARN]\u001b[0m - Configuration value \'timeout\' is deprecated. Using default of 3000ms.\n' +
                              '[2025-07-13 17:50:04] \u001b[31m[ERROR]\u001b[0m - Failed to load module \'user-service\'.\n' +
                              '\t\\--> Caused by: java.io.FileNotFoundException: /etc/modules/user-service.conf\n' +
                              '[2025-07-13 17:50:05] \u001b[1m\u001b[31m[FATAL]\u001b[0m - Unrecoverable error. Shutting down.';
            
            logInput.value = sampleLog;

            /**
             * Parses a raw log string, handling escape sequences and basic ANSI color codes.
             * @param {string} rawString - The raw log string from the backend.
             * @returns {string} An HTML string with formatted logs.
             */
            function parseLogs(rawString) {
                if (!rawString) {
                    return '<span class="text-gray-500">No logs to display.</span>';
                }

                // 1. Sanitize HTML to prevent XSS attacks
                // Replaces < and > with their HTML entities to prevent rendering of any HTML tags in the log string.
                let sanitizedString = rawString.replace(/</g, '&lt;').replace(/>/g, '&gt;');

                // 2. Process ANSI escape codes for colors
                // This is a simplified parser for basic colors.
                const ansiRegex = /\u001b\[(\d+;)?(\d+)m/g;
                let openTags = [];

                sanitizedString = sanitizedString.replace(ansiRegex, (match, style, color) => {
                    let newHtml = '';
                    const colorCode = parseInt(color, 10);

                    if (colorCode === 0) { // Reset all attributes
                        newHtml = openTags.map(() => '</span>').join('');
                        openTags = [];
                    } else if (colorCode === 1) { // Bold
                        newHtml = '<span class="ansi-bold">';
                        openTags.push('</span>');
                    } else if (colorCode >= 30 && colorCode <= 37) { // Standard colors
                        const colors = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
                        const colorClass = `ansi-${colors[colorCode - 30]}`;
                        newHtml = `<span class="${colorClass}">`;
                        openTags.push('</span>');
                    }
                    
                    return newHtml;
                });
                
                // Close any remaining open tags at the end
                sanitizedString += openTags.map(() => '</span>').join('');

                return sanitizedString;
            }

            function renderLogs() {
                const rawLogs = logInput.value;
                const formattedHtml = parseLogs(rawLogs);
                logOutput.innerHTML = formattedHtml;
            }

            // Initial render
            renderLogs();

            // Re-render on input change
            logInput.addEventListener('input', renderLogs);
        });
    </script>

</body>
</html>
