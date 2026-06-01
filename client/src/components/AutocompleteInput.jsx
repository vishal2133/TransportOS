import React, { useState, useEffect, useRef } from 'react';

/**
 * AutocompleteInput
 * Props:
 *  - value: string
 *  - onChange: (string) => void
 *  - suggestions: string[]  — already ranked by frequency
 *  - placeholder: string
 *  - className: string
 *  - style: object  (outer wrapper style)
 *  - inputStyle: object  (style applied directly to <input>)
 *  - required: bool
 */
export default function AutocompleteInput({
  value = '',
  onChange,
  suggestions = [],
  placeholder = '',
  className = '',
  style = {},
  inputStyle = {},
  required = false,
  onKeyDown: onKeyDownProp,
}) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const wrapperRef = useRef(null);

  // Filtered list: if empty query, show top-6; otherwise filter by query
  const filtered = value.trim()
    ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase())).slice(0, 7)
    : suggestions.slice(0, 6);

  useEffect(() => { setHighlighted(-1); }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleKeyDown = (e) => {
    if (open && filtered.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); return; }
      if (e.key === 'Enter' && highlighted >= 0) {
        e.preventDefault();
        onChange(filtered[highlighted]);
        setOpen(false);
        return;
      }
      if (e.key === 'Escape') { setOpen(false); return; }
    }
    if (onKeyDownProp) onKeyDownProp(e);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', ...style }}>
      <input
        type="text"
        className={className}
        value={value}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        style={{ width: '100%', ...inputStyle }}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {open && filtered.length > 0 && (
        <ul style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 400,
          margin: 0,
          padding: 0,
          listStyle: 'none',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderTop: '1px solid rgba(139,92,246,0.2)',
          borderRadius: '0 0 8px 8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          maxHeight: '200px',
          overflowY: 'auto',
        }}>
          {filtered.map((s, i) => (
            <li
              key={s}
              onMouseDown={() => { onChange(s); setOpen(false); }}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '13px',
                color: 'var(--text-main)',
                background: i === highlighted ? 'rgba(139,92,246,0.08)' : 'transparent',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background 0.1s',
              }}
              onMouseEnter={() => setHighlighted(i)}
              onMouseLeave={() => setHighlighted(-1)}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
