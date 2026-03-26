const PACS_COLORS = {
  'P1+': '#dc2626',
  'P1':  '#ea580c',
  'P2':  '#ca8a04',
  'P3':  '#16a34a',
  'P4':  '#64748b',
}

function getPacsColor(pacs) {
  return PACS_COLORS[pacs] ?? '#64748b'
}

function PacsBadge({ pacs }) {
  const color = getPacsColor(pacs)
  return (
    <span style={{
      background: color,
      color: '#fff',
      fontSize: '11px',
      fontWeight: 700,
      padding: '2px 6px',
      borderRadius: '4px',
      letterSpacing: '0.05em',
      minWidth: '36px',
      textAlign: 'center',
      display: 'inline-block',
    }}>
      {pacs ?? '—'}
    </span>
  )
}

function StatusDot({ status }) {
  if (status === 'active') {
    return (
      <>
        <style>{`
          @keyframes greenPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.35; }
          }
        `}</style>
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#22c55e',
          display: 'inline-block',
          animation: 'greenPulse 1.4s ease-in-out infinite',
          flexShrink: 0,
        }} />
      </>
    )
  }
  if (status === 'smart_hold') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#3b82f6',
          display: 'inline-block',
          flexShrink: 0,
        }} />
        <span style={{ fontSize: '10px', color: '#3b82f6', fontWeight: 600, letterSpacing: '0.05em' }}>AI Hold</span>
      </span>
    )
  }
  return (
    <span style={{
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: '#64748b',
      display: 'inline-block',
      flexShrink: 0,
    }} />
  )
}

export default function CallQueue({ calls = [], selectedCallId, onSelect }) {
  return (
    <div style={{
      width: '220px',
      minWidth: '220px',
      background: '#1e293b',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid #0f172a',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 16px 10px',
        borderBottom: '1px solid #0f172a',
      }}>
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#64748b',
          fontVariant: 'small-caps',
        }}>
          Active Calls
        </span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {calls.length === 0 && (
          <div style={{ padding: '16px', color: '#475569', fontSize: '13px' }}>No active calls</div>
        )}
        {calls.map((call) => {
          const isSelected = call.call_id === selectedCallId
          const shortId = call.call_id ? call.call_id.slice(-8) : '—'
          return (
            <div
              key={call.call_id}
              onClick={() => onSelect && onSelect(call.call_id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                cursor: 'pointer',
                borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent',
                background: isSelected ? '#263348' : 'transparent',
                transition: 'background 0.15s',
                userSelect: 'none',
              }}
            >
              <PacsBadge pacs={call.pacs} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', color: '#cbd5e1', fontFamily: "'Courier New', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {shortId}
                </div>
              </div>
              <StatusDot status={call.status} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
