const FIELDS = [
  { key: 'name',      label: 'Name' },
  { key: 'age',       label: 'Age' },
  { key: 'location',  label: 'Location' },
  { key: 'condition', label: 'Condition' },
]

function FieldInput({ fieldKey, label, value, isAI, onChange }) {
  return (
    <>
      <style>{`
        @keyframes aiFlash {
          0%   { background: #fbbf24; }
          50%  { background: rgba(251,191,36,0.15); }
          100% { background: transparent; }
        }
        .ai-flash-input { animation: aiFlash 2s ease-out forwards; }
      `}</style>
      <div>
        <label style={{
          display: 'block',
          fontSize: '11px',
          fontWeight: 600,
          color: '#64748b',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '4px',
        }}>
          {label}
        </label>
        <div style={{ position: 'relative' }}>
          <input
            key={isAI ? `${fieldKey}-ai` : fieldKey}
            className={isAI ? 'ai-flash-input' : ''}
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(fieldKey, e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '5px',
              padding: '7px 10px',
              paddingRight: isAI ? '40px' : '10px',
              color: '#e2e8f0',
              fontSize: '14px',
              fontFamily: 'system-ui, sans-serif',
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => { e.target.style.borderColor = '#3b82f6' }}
            onBlur={(e) => { e.target.style.borderColor = '#334155' }}
          />
          {isAI && (
            <span style={{
              position: 'absolute', right: '8px', top: '50%',
              transform: 'translateY(-50%)',
              background: '#fbbf24', color: '#0f172a',
              fontSize: '10px', fontWeight: 800,
              padding: '1px 5px', borderRadius: '3px',
              pointerEvents: 'none',
            }}>AI</span>
          )}
        </div>
      </div>
    </>
  )
}

function NehrBanner({ status, data }) {
  if (!status) return null

  if (status === 'loading') {
    return (
      <div style={{
        marginTop: '14px',
        padding: '10px 12px',
        background: '#0f172a',
        border: '1px solid #334155',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: '#94a3b8',
        fontSize: '12px',
      }}>
        <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        Pulling data from health records…
      </div>
    )
  }

  if (status === 'loaded' && data) {
    return (
      <div style={{
        marginTop: '14px',
        padding: '10px 12px',
        background: '#0f172a',
        border: '1px solid #0e4429',
        borderRadius: '6px',
        fontSize: '12px',
      }}>
        <div style={{ color: '#22c55e', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.05em' }}>
          ✓ NEHR — Health Records
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', color: '#94a3b8' }}>
          <div><span style={{ color: '#64748b' }}>Blood Type</span><br /><span style={{ color: '#e2e8f0' }}>{data.bloodType}</span></div>
          <div><span style={{ color: '#64748b' }}>Last Admission</span><br /><span style={{ color: '#e2e8f0' }}>{data.lastAdmission}</span></div>
          <div style={{ gridColumn: '1/-1' }}>
            <span style={{ color: '#64748b' }}>Known Conditions</span><br />
            <span style={{ color: '#e2e8f0' }}>{data.knownConditions.join(', ')}</span>
          </div>
          <div><span style={{ color: '#64748b' }}>Allergies</span><br /><span style={{ color: '#f87171' }}>{data.allergies.join(', ')}</span></div>
          <div><span style={{ color: '#64748b' }}>Medications</span><br /><span style={{ color: '#e2e8f0' }}>{data.medications.join(', ')}</span></div>
        </div>
      </div>
    )
  }

  return null
}

export default function PatientForm({ patient = {}, condition = '', aiFields = new Set(), nehrStatus, nehrData, onFieldEdit }) {
  const values = {
    name: patient.name ?? '',
    age: patient.age != null ? String(patient.age) : '',
    location: patient.location ?? '',
    condition: condition ?? '',
  }

  return (
    <div style={{ background: '#1e293b', borderRadius: '8px', padding: '16px' }}>
      <div style={{
        fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: '#64748b', marginBottom: '14px',
      }}>
        Patient Details
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {FIELDS.map(({ key, label }) => (
          <FieldInput
            key={key}
            fieldKey={key}
            label={label}
            value={values[key]}
            isAI={aiFields.has(key)}
            onChange={onFieldEdit}
          />
        ))}
      </div>
      <NehrBanner status={nehrStatus} data={nehrData} />
    </div>
  )
}
