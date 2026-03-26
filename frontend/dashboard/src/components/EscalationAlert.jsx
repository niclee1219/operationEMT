export default function EscalationAlert({ alert, onResumeCall }) {
  if (!alert) return null

  return (
    <>
      <style>{`
        @keyframes alertPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.6); }
          50%       { box-shadow: 0 4px 20px 4px rgba(220,38,38,0.35); }
        }
      `}</style>
      <div style={{
        width: '100%',
        boxSizing: 'border-box',
        background: '#dc2626',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        animation: 'alertPulse 1.8s ease-in-out infinite',
        zIndex: 100,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff', letterSpacing: '0.05em' }}>
            ESCALATION ALERT
          </span>
          {alert.severity === 'critical' && (
            <span style={{
              background: '#fff',
              color: '#dc2626',
              fontSize: '10px',
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: '3px',
              letterSpacing: '0.1em',
            }}>
              CRITICAL
            </span>
          )}
          {alert.trigger_phrase && (
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', fontStyle: 'italic' }}>
              "{alert.trigger_phrase}"
            </span>
          )}
        </div>
        <button
          onClick={() => onResumeCall && onResumeCall(alert.call_id)}
          style={{
            background: '#fff',
            color: '#dc2626',
            border: 'none',
            borderRadius: '5px',
            padding: '6px 16px',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          Resume Call
        </button>
      </div>
    </>
  )
}
