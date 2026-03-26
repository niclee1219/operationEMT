export default function SmartHoldButton({ callId, status, onSmartHold }) {
  const isOnHold = status === 'smart_hold'

  return (
    <>
      <style>{`
        @keyframes holdDotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
      <div style={{
        background: '#1e293b',
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        <button
          onClick={() => !isOnHold && onSmartHold && onSmartHold(callId)}
          disabled={isOnHold}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: '6px',
            border: isOnHold ? '1px solid #334155' : 'none',
            background: isOnHold ? '#0f172a' : '#1d4ed8',
            color: isOnHold ? '#475569' : '#fff',
            fontWeight: 700,
            fontSize: '14px',
            cursor: isOnHold ? 'not-allowed' : 'pointer',
            letterSpacing: '0.04em',
            transition: 'background 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {isOnHold ? (
            <>
              <span style={{
                width: '9px',
                height: '9px',
                borderRadius: '50%',
                background: '#3b82f6',
                display: 'inline-block',
                animation: 'holdDotPulse 1.4s ease-in-out infinite',
                flexShrink: 0,
              }} />
              AI Monitoring Active
            </>
          ) : (
            'Put on Smart Hold'
          )}
        </button>
        <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
          {isOnHold
            ? 'Call is under AI monitoring'
            : 'Transfer to AI monitoring'}
        </div>
      </div>
    </>
  )
}
