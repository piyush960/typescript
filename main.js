// log-terminal.component.ts
import { Component, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import AnsiUp from 'ansi\_up';

@Component({
selector: 'app-log-terminal',
templateUrl: './log-terminal.component.html',
styleUrls: \['./log-terminal.component.css']
})
export class LogTerminalComponent implements OnChanges {
@Input() rawLogs: string = '';
sanitizedHtml: SafeHtml = '';
private ansiUp = new AnsiUp();

constructor(private sanitizer: DomSanitizer) {}

ngOnChanges() {
// Convert ANSI escape sequences to HTML with colors
const html = this.ansiUp.ansi\_to\_html(this.rawLogs || '');
// Preserve line breaks
const withBreaks = html.replace(/\r?\n/g, '<br>');
this.sanitizedHtml = this.sanitizer.bypassSecurityTrustHtml(withBreaks);
}
}

// log-terminal.component.html
\`<div class="terminal-container">

  <pre class="terminal" [innerHTML]="sanitizedHtml"></pre>

</div>`

// log-terminal.component.css
\`.terminal-container {
background-color: #1e1e1e;
padding: 1rem;
border-radius: 4px;
overflow: auto;
max-height: 400px;
font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
color: #ddd;
font-size: 0.875rem;
}

.terminal {
margin: 0;
white-space: pre-wrap;
word-break: break-word;
}

// Installation:
// npm install ansi\_up --save

// Usage in parent template:
// \<app-log-terminal \[rawLogs]="logsFromBackend"></app-log-terminal>
