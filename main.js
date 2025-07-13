// log-terminal.component.ts
import { Component, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
selector: 'app-log-terminal',
templateUrl: './log-terminal.component.html',
styleUrls: \['./log-terminal.component.css']
})
export class LogTerminalComponent implements OnChanges {
@Input() rawLogs: string = '';
sanitizedHtml: SafeHtml = '';

constructor(private sanitizer: DomSanitizer) {}

ngOnChanges() {
const html = this.parseAnsiToHtml(this.rawLogs);
this.sanitizedHtml = this.sanitizer.bypassSecurityTrustHtml(html);
}

private parseAnsiToHtml(str: string): string {
// Simple ANSI color map
const ANSI\_COLORS: Record\<number, string> = {
30: '#000000', 31: '#a00', 32: '#0a0', 33: '#aa0', 34: '#00a',
35: '#a0a', 36: '#0aa', 37: '#aaa', 90: '#555', 91: '#f55',
92: '#5f5', 93: '#ff5', 94: '#55f', 95: '#f5f', 96: '#5ff', 97: '#fff'
};
// Escape HTML
let out = str.replace(/&/g, '&').replace(/\</g, '<').replace(/>/g, '>');

```
// Replace ANSI codes
out = out.replace(
  /\x1b\[(\d+(?:;\d+)*)m/g,
  (_match, codes) => {
    const parts = codes.split(';').map(Number);
    // reset
    if (parts.includes(0)) {
      return '</span>';
    }
    // find first color code
    const code = parts.find(c => ANSI_COLORS[c] != null);
    if (code) {
      const color = ANSI_COLORS[code];
      return `<span style="color: ${color}">`;
    }
    return '';
  }
);

// Preserve whitespace and newlines
out = out.replace(/\r?\n/g, '<br>');
out = out.replace(/\t/g, '&emsp;');
return out;
```

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

// Usage in parent template:
// \<app-log-terminal \[rawLogs]="logsFromBackend"></app-log-terminal>
