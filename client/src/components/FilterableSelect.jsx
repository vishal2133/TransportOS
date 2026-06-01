import React, { useState, useEffect, useRef } from 'react';

/**
 * FilterableSelect
 * A text input that acts as a filterable dropdown (for Trucks and Parties).
 * Props:
 *  - value: id string
 *  - onChange: (id) => void
 *  - options: [{ value, label }]
 *  - placeholder: string
 *  - style: object (applied to the <input>)
 */
export default function FilterableSelect({ value, onChange, options = [], placeholder = 'Select...', style = {}, allowCustom = false }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const ref = useRef(null);

  const selected = options.find(o => o.value === value);
  const displayValue = open ? search : (selected ? selected.label : (value || ''));

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : options.slice(0, 8);

  useEffect(() => { setHighlighted(-1); }, [search]);

  const select = (opt) => {
    onChange(opt.value);
    setSearch('');
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    if (e.key === 'Enter') { 
      e.preventDefault(); 
      if (highlighted >= 0 && filtered.length > 0) {
        select(filtered[highlighted]);
      } else if (allowCustom && search.trim()) {
        onChange(search.trim());
        setSearch('');
        setOpen(false);
      }
    }
    if (e.key === 'Escape') setOpen(false);
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (open && allowCustom && search.trim()) {
        // If they didn't click an option, and custom is allowed, save it
        onChange(search.trim());
      }
      setSearch('');
      setOpen(false);
    }, 150);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        type="text"
        className="form-input"
        style={{ width: '100%', ...style }}
        placeholder={placeholder}
        autoComplete="off"
        value={displayValue}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => { setSearch(''); setOpen(true); }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      {open && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 400,
          margin: 0, padding: 0, listStyle: 'none',
          background: 'var(--bg-panel)', border: '1px solid var(--border)',
          borderTop: '1px solid rgba(139,92,246,0.2)',
          borderRadius: '0 0 8px 8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          maxHeight: '180px', overflowY: 'auto',
        }}>
          {filtered.length === 0 && (
            <li style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '12px' }}>No matches</li>
          )}
          {filtered.map((o, i) => (
            <li
              key={o.value}
              onMouseDown={() => select(o)}
              onMouseEnter={() => setHighlighted(i)}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: '13px',
                color: 'var(--text-main)',
                background: i === highlighted
                  ? 'var(--bg-hover)'
                  : o.value === value ? 'rgba(139,92,246,0.06)' : 'transparent',
                fontWeight: o.value === value ? 600 : 400,
                borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              {o.label}
              {o.value === value && <span style={{ float: 'right', color: 'var(--accent)', fontSize: '11px' }}>✓</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
