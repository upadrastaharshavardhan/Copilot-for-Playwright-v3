import { useState } from 'react';

export default function CodeBlock({ filename, code }: { filename: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="code-panel">
      <div className="code-panel-head">
        <span className="filename">{filename}</span>
        <button className="copy-btn" onClick={copy}>
          {copied ? 'copied ✓' : 'copy'}
        </button>
      </div>
      <pre>{code}</pre>
    </div>
  );
}
