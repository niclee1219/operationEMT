import { useState } from 'react'

const PACS_CONFIG = {
  'P1+':         { color: '#dc2626', pulse: true,  label: 'P1+' },
  'P1':          { color: '#ea580c', pulse: false, label: 'P1' },
  'P2':          { color: '#ca8a04', pulse: false, label: 'P2' },
  'P3':          { color: '#16a34a', pulse: false, label: 'P3' },
  'P4':          { color: '#64748b', pulse: false, label: 'P4' },
  'False Alarm': { color: '#334155', pulse: false, label: 'FALSE ALARM' },
}

const PACS_OPTIONS = ['P1+', 'P1', 'P2', 'P3', 'P4', 'False Alarm']

function getPacsColor(pacs) {
  return PACS_CONFIG[pacs]?.color ?? '#64748b'
}

function getPacsPulse(pacs) {
  return PACS_CONFIG[pacs]?.pulse ?? false
}

export default function TriagePanel({ pacs, differentials = [], confirmed, onConfirm, onPacsEdit, onTransferNonEmergency }) {
  const [dispatched, setDispatched] = useState(false)
  const [transferred, setTransferred] = useState(false)
  const color = getPacsColor(pacs)
  const shouldPulse = getPacsPulse(pacs)
  const isFalseAlarm = pacs === 'False Alarm'
  const displayLabel = PACS_CONFIG[pacs]?.label ?? (pacs ?? 'PENDING')

  function handleConfirm() {
    setDispatched(true)
    if (onConfirm) onConfirm()
  }

  function handleTransfer() {
    setTransferred(true)
    if (onTransferNonEmergency) onTransferNonEmergency()
  }

  function handlePacsChange(e) {
    if (dispatched || transferred) return
    if (onPacsEdit) onPacsEdit(e.target.value)
  }

  return (
    <>
      <style>{`
        @keyframes pacsPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.7); }
          50%       { box-shadow: 0 0 0 10px rgba(220,38,38,0); }
        }
      `}</style>
      <div style={{
        background: '#1e293b',
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        {/* PACS badge */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <div style={{
            background: color,
            color: '#fff',
            fontSize: isFalseAlarm ? '20px' : '36px',
            fontWeight: 800,
            padding: '10px 20px',
            borderRadius: '10px',
            letterSpacing: '0.05em',
            animation: shouldPulse ? 'pacsPulse 1.6s ease-in-out infinite' : 'none',
            userSelect: 'none',
            textAlign: 'center',
          }}>
            {displayLabel}
          </div>
          {!dispatched && !transferred && (
            <span style={{ fontSize: '11px', color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {confirmed ? 'Verified' : 'Pending Verification'}
            </span>
          )}
        </div>

        {/* PACS override dropdown */}
        <div>
          <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Override PACS
          </label>
          <select
            value={pacs ?? ''}
            onChange={handlePacsChange}
            disabled={dispatched || transferred}
            style={{
              width: '100%',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '5px',
              color: (dispatched || transferred) ? '#475569' : '#e2e8f0',
              padding: '6px 8px',
              fontSize: '13px',
              cursor: (dispatched || transferred) ? 'not-allowed' : 'pointer',
              outline: 'none',
            }}
          >
            <option value="">— Select PACS —</option>
            {PACS_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Differentials */}
        {differentials.length > 0 && (
          <div>
            <div style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#64748b',
              marginBottom: '10px',
            }}>
              Differential Diagnosis
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {differentials.map((d) => {
                const pct = Math.round((d.probability ?? 0) * 100)
                return (
                  <div key={d.condition}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', color: '#cbd5e1' }}>{d.condition}</span>
                      <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>{pct}%</span>
                    </div>
                    <div style={{ height: '4px', background: '#334155', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: color,
                        borderRadius: '2px',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Action buttons */}
        {dispatched ? (
          <div style={{
            textAlign: 'center',
            padding: '10px',
            background: 'rgba(22,163,74,0.15)',
            border: '1px solid #16a34a',
            borderRadius: '6px',
            color: '#22c55e',
            fontWeight: 700,
            fontSize: '14px',
            letterSpacing: '0.05em',
          }}>
            {isFalseAlarm ? 'CLOSED — FALSE ALARM' : 'DISPATCHED'}
          </div>
        ) : transferred ? (
          <div style={{
            textAlign: 'center',
            padding: '10px',
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid #3b82f6',
            borderRadius: '6px',
            color: '#60a5fa',
            fontWeight: 700,
            fontSize: '13px',
            letterSpacing: '0.05em',
          }}>
            TRANSFERRED TO NON-EMERGENCY
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={handleConfirm}
              disabled={!pacs}
              style={{
                padding: '10px',
                borderRadius: '6px',
                border: pacs ? 'none' : '1px solid #334155',
                cursor: pacs ? 'pointer' : 'not-allowed',
                fontWeight: 700,
                fontSize: '14px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                background: pacs ? (isFalseAlarm ? '#334155' : '#16a34a') : '#1e293b',
                color: pacs ? '#fff' : '#475569',
                transition: 'background 0.2s, color 0.2s',
              }}
            >
              {isFalseAlarm ? 'Close as False Alarm' : 'Confirm & Dispatch'}
            </button>
            <button
              onClick={handleTransfer}
              style={{
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid #1d4ed8',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '12px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                background: 'transparent',
                color: '#60a5fa',
                transition: 'background 0.2s',
              }}
            >
              Transfer to Non-Emergency
            </button>
          </div>
        )}
      </div>
    </>
  )
}
